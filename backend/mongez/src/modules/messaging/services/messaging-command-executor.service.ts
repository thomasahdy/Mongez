import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { UpdateTaskDto } from '../../tasks/dto/update-task.dto';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto';
import { WorkflowService } from '../../workflow/workflow.service';
import { WorkflowFilterDto } from '../../workflow/dto/workflow-filter.dto';
import {
  MessagingIntentService,
  ParsedIntent,
} from './messaging-intent.service';
import { MessagingApprovalService } from './messaging-approval.service';
import { MessagingLang, normalizeLang, msg } from '../i18n/messaging-i18n';

interface PendingApprovalItem {
  id: string;
  entityType?: string | null;
  definition?: { name?: string | null } | null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface InboundMessage {
  channel: 'WHATSAPP' | 'TELEGRAM';
  spaceId: string;
  userId: string;
  text: string;
  /** Telegram callback_data (button press), takes precedence over `text`. */
  callbackPayload?: string;
}

export interface InboundResult {
  reply: string;
  /** For callback button presses, a toast text to acknowledge the click. */
  callbackAnswer?: string;
}

const OPEN_STATUSES: TaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
];

/**
 * Executes intents matched by the MessagingIntentService against the real
 * domain services (TasksService / WorkflowService) and returns a single
 * localized reply string. This is the shared command core used by both the
 * WhatsApp and Telegram webhook handlers.
 */
@Injectable()
export class MessagingCommandExecutor {
  private readonly logger = new Logger(MessagingCommandExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TasksService)) private readonly tasks: TasksService,
    @Inject(forwardRef(() => WorkflowService)) private readonly workflow: WorkflowService,
    private readonly intent: MessagingIntentService,
    private readonly approvals: MessagingApprovalService,
  ) {}

  async handleInbound(message: InboundMessage): Promise<InboundResult> {
    const lang = await this.resolveLanguage(message.userId);

    // Button callback (Telegram inline keyboard) → approval resolution.
    if (message.callbackPayload) {
      return this.handleCallback(message, lang);
    }

    const parsed = await this.intent.parse(message.text);
    return this.dispatch(parsed, message, lang);
  }

  // ── Dispatch ───────────────────────────────────────────────────

  private async dispatch(
    parsed: ParsedIntent,
    message: InboundMessage,
    lang: MessagingLang,
  ): Promise<InboundResult> {
    switch (parsed.type) {
      case 'HELP':
        return { reply: msg('HELP', lang) };

      case 'LIST_TASKS':
        return { reply: await this.listTasks(message, lang) };

      case 'COMPLETE_TASK':
        return { reply: await this.completeTask(message, parsed, lang) };

      case 'LIST_APPROVALS':
        return { reply: await this.listApprovals(message, lang) };

      case 'APPROVE':
        return {
          reply: await this.resolveApproval(message, parsed, 'APPROVED', lang),
        };

      case 'REJECT':
        return {
          reply: await this.resolveApproval(message, parsed, 'REJECTED', lang),
        };

      case 'CREATE_TASK':
        return { reply: await this.createTask(message, parsed, lang) };

      default:
        return { reply: msg('UNKNOWN', lang) };
    }
  }

  // ── Intents ────────────────────────────────────────────────────

  private async listTasks(
    message: InboundMessage,
    lang: MessagingLang,
  ): Promise<string> {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        userId: message.userId,
        task: {
          deletedAt: null,
          isArchived: false,
          status: { in: OPEN_STATUSES },
          board: { department: { spaceId: message.spaceId } },
        },
      },
      include: {
        task: {
          select: {
            id: true,
            identifier: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { task: { createdAt: 'desc' } },
      take: 10,
    });

    if (!assignments.length) return msg('NO_TASKS', lang);

    const lines = assignments.map(
      (a) => `• ${a.task.identifier} — ${a.task.title} [${a.task.status}]`,
    );
    return [msg('TASKS_HEADER', lang, assignments.length), ...lines].join('\n');
  }

  private async completeTask(
    message: InboundMessage,
    parsed: ParsedIntent,
    lang: MessagingLang,
  ): Promise<string> {
    const arg = parsed.id?.trim();
    if (!arg) return msg('MISSING_ID', lang, '/done');

    const task = await this.prisma.task.findFirst({
      where: {
        OR: [{ identifier: arg }, { id: arg }],
        deletedAt: null,
        board: { department: { spaceId: message.spaceId } },
      },
      select: { id: true, identifier: true },
    });

    if (!task) return msg('TASK_NOT_FOUND', lang, arg);

    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: message.userId } },
    });
    if (!assignment) return msg('TASK_DONE_FORBIDDEN', lang);

    try {
      const update: UpdateTaskDto = { status: TaskStatus.DONE };
      await this.tasks.updateTask(task.id, update, message.userId, message.spaceId);
      return msg('TASK_DONE', lang, task.identifier || arg);
    } catch (err) {
      this.logger.error(`completeTask failed for ${arg}: ${errorMessage(err)}`);
      return msg('TASK_NOT_FOUND', lang, arg);
    }
  }

  private async listApprovals(
    message: InboundMessage,
    lang: MessagingLang,
  ): Promise<string> {
    const filters = new WorkflowFilterDto();
    filters.page = 1;
    filters.limit = 5;
    const pending = await this.workflow.getPendingForReviewer(
      message.userId,
      message.spaceId,
      filters,
    );

    const items = (pending.data ?? []) as PendingApprovalItem[];
    if (!items.length) return msg('NO_APPROVALS', lang);

    const lines = items.map((inst) => {
      const ref = inst.id.length > 8 ? inst.id.slice(-8) : inst.id;
      const name = inst.definition?.name || inst.entityType || 'approval';
      return `• #${ref} — ${name}`;
    });
    return [
      msg('APPROVALS_HEADER', lang, pending.meta?.total ?? items.length),
      ...lines,
    ].join('\n');
  }

  private async resolveApproval(
    message: InboundMessage,
    parsed: ParsedIntent,
    decision: 'APPROVED' | 'REJECTED',
    lang: MessagingLang,
  ): Promise<string> {
    const arg = parsed.id?.trim();
    if (!arg)
      return msg(
        'MISSING_ID',
        lang,
        decision === 'APPROVED' ? '/approve' : '/reject',
      );

    const instanceId = await this.resolveInstanceId(arg, message);
    if (!instanceId) return msg('APPROVAL_NOT_FOUND', lang, arg);

    const result = await this.approvals.resolve(
      instanceId,
      message.userId,
      decision,
      lang,
    );
    return result.reply;
  }

  private async createTask(
    message: InboundMessage,
    parsed: ParsedIntent,
    lang: MessagingLang,
  ): Promise<string> {
    const title = parsed.title?.trim();
    if (!title) return msg('MISSING_ID', lang, '/create');

    const space = await this.prisma.space.findUnique({
      where: { id: message.spaceId },
      select: { id: true, prefix: true },
    });
    if (!space) return msg('UNKNOWN', lang);

    const board = await this.prisma.board.findFirst({
      where: { deletedAt: null, department: { spaceId: space.id } },
      orderBy: { createdAt: 'asc' },
      include: {
        columns: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    const column = board?.columns?.[0];
    if (!board || !column) {
      return lang === 'ar'
        ? '⚠️ لا يوجد لوح/عمود افتراضي لإنشاء المهمة.'
        : '⚠️ No default board/column available to create the task.';
    }

    try {
      const dto: CreateTaskDto = {
        title,
        boardId: board.id,
        columnId: column.id,
        spaceId: space.id,
        spacePrefix: space.prefix,
        status: TaskStatus.TODO,
        assigneeIds: [message.userId],
      };
      const task = await this.tasks.createTask(dto, message.userId, space.id, space.prefix);
      const id = task?.identifier || title;
      return lang === 'ar'
        ? `✅ تم إنشاء المهمة ${id}.`
        : `✅ Created task ${id}.`;
    } catch (err) {
      this.logger.error(`createTask failed: ${errorMessage(err)}`);
      return msg('UNKNOWN', lang);
    }
  }

  // ── Callback (inline button) ───────────────────────────────────

  private async handleCallback(
    message: InboundMessage,
    lang: MessagingLang,
  ): Promise<InboundResult> {
    const payload = message.callbackPayload || '';
    const sep = payload.indexOf(':');
    if (sep < 0) return { reply: msg('UNKNOWN', lang) };
    const decision = payload.slice(0, sep);
    const instanceId = payload.slice(sep + 1);

    if (decision !== 'approve' && decision !== 'reject') {
      return { reply: msg('UNKNOWN', lang) };
    }

    const result = await this.approvals.resolve(
      instanceId,
      message.userId,
      decision === 'approve' ? 'APPROVED' : 'REJECTED',
      lang,
    );
    return { reply: result.reply, callbackAnswer: result.reply };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async resolveInstanceId(
    arg: string,
    message: InboundMessage,
  ): Promise<string | null> {
    // Exact id reference
    const exact = await this.prisma.workflowInstance.findFirst({
      where: { id: arg, spaceId: message.spaceId },
      select: { id: true },
    });
    if (exact) return exact.id;

    // Suffix match against instances pending this user's review
    const filters = new WorkflowFilterDto();
    filters.page = 1;
    filters.limit = 20;
    const pending = await this.workflow.getPendingForReviewer(
      message.userId,
      message.spaceId,
      filters,
    );
    const items = (pending.data ?? []) as PendingApprovalItem[];
    const match = items.find((i) => i.id === arg || i.id.endsWith(arg));
    return match?.id ?? null;
  }

  private async resolveLanguage(userId: string): Promise<MessagingLang> {
    const pref = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { language: true },
    });
    return normalizeLang(pref?.language);
  }
}
