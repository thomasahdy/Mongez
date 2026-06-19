import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowService } from '../../workflow/workflow.service';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import {
  MessagingLang,
  msg,
  encodeApprovalCallback,
} from '../i18n/messaging-i18n';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';
export type MessagingChannelKind = 'WHATSAPP' | 'TELEGRAM';

export interface ApprovalResolveResult {
  ok: boolean;
  reply: string;
}

export interface SendApprovalRequest {
  spaceId: string;
  userId: string;
  instanceId: string;
  title: string;
  body?: string;
}

/**
 * Orchestrates approval interactions across WhatsApp and Telegram:
 *  - resolve():   invoked from inbound button / command to APPROVE/REJECT a
 *                 running WorkflowInstance via the WorkflowEngine.
 *  - build*():    render the channel-specific interactive payloads (Telegram
 *                 inline keyboard, WhatsApp quick-reply buttons).
 *  - sendApprovalRequest(): proactively push an interactive approval message
 *                 to a user on a given channel (used by future workflow hooks).
 */
@Injectable()
export class MessagingApprovalService {
  private readonly logger = new Logger(MessagingApprovalService.name);

  constructor(
    @Inject(forwardRef(() => WorkflowService)) private readonly workflow: WorkflowService,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TELEGRAM) private readonly telegramQueue: Queue,
  ) {}

  async resolve(
    instanceId: string,
    userId: string,
    decision: ApprovalDecision,
    lang: MessagingLang,
  ): Promise<ApprovalResolveResult> {
    try {
      await this.workflow.submitDecision(instanceId, userId, decision);
      return {
        ok: true,
        reply: msg(
          decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          lang,
          instanceId,
        ),
      };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) {
        return {
          ok: false,
          reply: msg('APPROVAL_NOT_FOUND', lang, instanceId),
        };
      }
      this.logger.error(
        `Failed to resolve approval ${instanceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { ok: false, reply: msg('APPROVAL_NOT_FOUND', lang, instanceId) };
    }
  }

  /** Telegram inline keyboard payload for an approval request. */
  buildTelegramInlineKeyboard(instanceId: string, lang: MessagingLang) {
    return {
      inline_keyboard: [
        [
          {
            text: msg('APPROVAL_BUTTON_APPROVE', lang),
            callback_data: encodeApprovalCallback('approve', instanceId),
          },
          {
            text: msg('APPROVAL_BUTTON_REJECT', lang),
            callback_data: encodeApprovalCallback('reject', instanceId),
          },
        ],
      ],
    };
  }

  /** WhatsApp quick-reply buttons payload for an approval request. */
  buildWhatsappButtons(instanceId: string, lang: MessagingLang) {
    return [
      {
        id: encodeApprovalCallback('approve', instanceId),
        title: msg('APPROVAL_BUTTON_APPROVE', lang),
      },
      {
        id: encodeApprovalCallback('reject', instanceId),
        title: msg('APPROVAL_BUTTON_REJECT', lang),
      },
    ];
  }

  /**
   * Proactively push an interactive approval request to a user. Telegram gets
   * an inline keyboard (no template friction); WhatsApp gets a quick-reply
   * button message (requires a pre-approved template in production).
   */
  async sendApprovalRequest(
    channel: MessagingChannelKind,
    req: SendApprovalRequest,
    lang: MessagingLang,
  ) {
    const prompt = msg('APPROVAL_PROMPT', lang, req.title, req.body || '');

    if (channel === 'TELEGRAM') {
      await this.telegramQueue.add(
        JOB_NAMES.SEND_TELEGRAM,
        {
          spaceId: req.spaceId,
          userId: req.userId,
          text: prompt,
          replyMarkup: this.buildTelegramInlineKeyboard(req.instanceId, lang),
          approvalId: req.instanceId,
        },
        {
          jobId: `tg:approval:${req.instanceId}:${req.userId}`,
          removeOnComplete: true,
        },
      );
      return;
    }

    await this.whatsappQueue.add(
      JOB_NAMES.SEND_WHATSAPP,
      {
        spaceId: req.spaceId,
        toPhone: null, // resolved by the processor via the contact lookup
        userId: req.userId,
        interactive: {
          bodyText: prompt,
          buttons: this.buildWhatsappButtons(req.instanceId, lang),
        },
        approvalId: req.instanceId,
      },
      {
        jobId: `wa:approval:${req.instanceId}:${req.userId}`,
        removeOnComplete: true,
      },
    );
  }
}
