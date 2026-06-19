import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';

export type IntentType =
  | 'LIST_TASKS'
  | 'COMPLETE_TASK'
  | 'LIST_APPROVALS'
  | 'APPROVE'
  | 'REJECT'
  | 'CREATE_TASK'
  | 'HELP'
  | 'UNKNOWN';

export interface ParsedIntent {
  type: IntentType;
  /** Identifier argument (task identifier or workflow instance id). */
  id?: string;
  /** Free-text title argument for CREATE_TASK. */
  title?: string;
  raw: string;
}

interface IntentRule {
  type: IntentType;
  /** Returns optional argument extracted from the match. */
  match: (normalized: string) => { matched: boolean; arg?: string };
}

/**
 * Deterministic bilingual (AR/EN) command parser. Patterns are matched before
 * any AI fallback — so the common commands never incur an LLM call. The parsed
 * result is cached in Redis keyed by the (normalized) message text.
 */
@Injectable()
export class MessagingIntentService {
  private readonly logger = new Logger(MessagingIntentService.name);
  private readonly cacheTtl = 60 * 60 * 24; // 24h

  private readonly rules: IntentRule[] = [
    {
      type: 'HELP',
      match: (t) => ({ matched: /^(\/help|\/start|مساعدة|الاوامر)$/i.test(t) }),
    },
    {
      type: 'LIST_TASKS',
      match: (t) => ({
        matched:
          /^(\/tasks|\/t|my\s*tasks|list\s*tasks|مهامي|المهام|مهام)$/i.test(t),
      }),
    },
    {
      type: 'LIST_APPROVALS',
      match: (t) => ({
        matched:
          /^(\/approvals|\/pending|موافقاتي|طلبات\s*الموافقة|الموافقات)$/i.test(
            t,
          ),
      }),
    },
    {
      type: 'COMPLETE_TASK',
      match: (t) => {
        const m = t.match(/^(?:\/done|\/complete|تم|انجز|أنجز|اكتمل)\s+(.+)$/i);
        return m ? { matched: true, arg: m[1].trim() } : { matched: false };
      },
    },
    {
      type: 'APPROVE',
      match: (t) => {
        const m = t.match(/^(?:\/approve|موافق|اعتمد|أوافق)\s+(.+)$/i);
        return m ? { matched: true, arg: m[1].trim() } : { matched: false };
      },
    },
    {
      type: 'REJECT',
      match: (t) => {
        const m = t.match(/^(?:\/reject|رفض|ارفض)\s+(.+)$/i);
        return m ? { matched: true, arg: m[1].trim() } : { matched: false };
      },
    },
    {
      type: 'CREATE_TASK',
      match: (t) => {
        const m = t.match(
          /^(?:\/create|\/new|انشاء|إنشاء|اضافة|إضافة)\s+(.+)$/i,
        );
        return m ? { matched: true, arg: m[1].trim() } : { matched: false };
      },
    },
  ];

  constructor(private readonly cache: CacheService) {}

  async parse(rawText: string): Promise<ParsedIntent> {
    const normalized = (rawText || '').trim().replace(/\s+/g, ' ');
    const cacheKey = `messaging:intent:${this.hash(normalized)}`;

    const cached = await this.cache.get<ParsedIntent>(cacheKey);
    if (cached) return { ...cached, raw: rawText };

    let result: ParsedIntent = { type: 'UNKNOWN', raw: rawText };

    for (const rule of this.rules) {
      const { matched, arg } = rule.match(normalized);
      if (matched) {
        if (rule.type === 'CREATE_TASK') {
          result = { type: rule.type, title: arg, raw: rawText };
        } else if (
          rule.type === 'COMPLETE_TASK' ||
          rule.type === 'APPROVE' ||
          rule.type === 'REJECT'
        ) {
          result = { type: rule.type, id: arg, raw: rawText };
        } else {
          result = { type: rule.type, raw: rawText };
        }
        break;
      }
    }

    // Don't cache UNKNOWN — the message could be a later-matching free-form text.
    if (result.type !== 'UNKNOWN') {
      await this.cache.set(cacheKey, result, this.cacheTtl).catch((err) => {
        this.logger.warn(`Intent cache write failed: ${err.message}`);
      });
    }

    return result;
  }

  private hash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16);
  }
}
