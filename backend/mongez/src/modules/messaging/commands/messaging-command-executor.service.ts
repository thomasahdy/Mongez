import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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
import { MessagingApprovalService } from '../approvals/messaging-approval.service';
import { ApprovalDelegationService } from '../approvals/approval-delegation.service';
import { MessagingLang, normalizeLang, msg } from '../templates/messaging-i18n';
import { MessagingAuditService } from './messaging-audit.service';
import { MessagingRateLimitGuard } from './guards/messaging-rate-limit.guard';
import { CacheService } from '../../../infrastructure/cache/cache.service';

interface PendingApprovalItem {
  id: string;
  entityType?: string | null;
  definition?: { name?: string | null } | null;
  requester?: { name?: string | null } | null;
  context?: Record<string, unknown> | null;
}

/** An individual item in the Inbox review queue. */
interface InboxItem {
  kind: 'approval' | 'mention' | 'task';
  id: string;
  title: string;
  subtitle: string;
  /** For approvals: the WorkflowInstance ID */
  instanceId?: string;
  /** For mentions: the comment ID */
  commentId?: string;
  /** For tasks: the task ID */
  taskId?: string;
}

/** Session stored in Redis for a user's active inbox review. */
interface InboxSession {
  items: InboxItem[];
  currentIndex: number;
  lang: MessagingLang;
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
  /** Telegram inline keyboard markup to attach to the reply. */
  replyMarkup?: Record<string, unknown>;
}

const OPEN_STATUSES: TaskStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
];

const INBOX_SESSION_TTL = 60 * 30; // 30 minutes

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
    private readonly delegation: ApprovalDelegationService,
    private readonly audit: MessagingAuditService,
    private readonly rateLimiter: MessagingRateLimitGuard,
    private readonly cache: CacheService,
  ) {}

  async handleInbound(message: InboundMessage): Promise<InboundResult> {
    const lang = await this.resolveLanguage(message.userId);

    // Enforce rate limit (10 commands per minute)
    const isAllowed = await this.rateLimiter.checkRateLimit(message.userId);
    if (!isAllowed) {
      return {
        reply: lang === 'ar'
          ? '⚠️ لقد تجاوزت حد الطلبات. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.'
          : '⚠️ Rate limit exceeded. Please wait a minute before trying again.',
      };
    }

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

      case 'INBOX':
        return this.handleInbox(message, lang);

      case 'DELEGATE':
        return { reply: await this.handleDelegate(message, parsed, lang) };

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

    try {
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
      if (!assignment) return msg('TASK_FORBIDDEN', lang);

      const update: UpdateTaskDto = { status: TaskStatus.DONE };
      await this.tasks.updateTask(task.id, update, message.userId, message.spaceId);

      // Record audit
      await this.audit.recordAction({
        userId: message.userId,
        spaceId: message.spaceId,
        action: 'task.completed',
        entityType: 'task',
        entityId: task.id,
        channel: message.channel,
      });

      return msg('TASK_DONE', lang, task.identifier || arg);
    } catch (err) {
      this.logger.error(`completeTask failed for ${arg}: ${errorMessage(err)}`);

      // Typed error handling
      if (err instanceof NotFoundException) {
        return msg('TASK_NOT_FOUND', lang, arg);
      }
      if (err instanceof ForbiddenException) {
        return msg('TASK_FORBIDDEN', lang);
      }
      if (err instanceof BadRequestException) {
        return msg('TASK_INVALID_TRANSITION', lang);
      }

      return msg('TASK_ERROR_GENERIC', lang);
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

    if (result.ok) {
      await this.audit.recordAction({
        userId: message.userId,
        spaceId: message.spaceId,
        action: decision === 'APPROVED' ? 'workflow.approved' : 'workflow.rejected',
        entityType: 'WorkflowInstance',
        entityId: instanceId,
        channel: message.channel,
      });
    }

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

    // Select most recently updated board (not most recently created)
    const board = await this.prisma.board.findFirst({
      where: { deletedAt: null, department: { spaceId: space.id } },
      orderBy: { updatedAt: 'desc' },
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

      // Record audit
      if (task?.id) {
        await this.audit.recordAction({
          userId: message.userId,
          spaceId: space.id,
          action: 'task.created',
          entityType: 'task',
          entityId: task.id,
          channel: message.channel,
        });
      }

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

    // Inbox navigation callbacks: inbox:start, inbox:next, inbox:skip, etc.
    if (payload.startsWith('inbox:')) {
      return this.handleInboxCallback(message, payload, lang);
    }

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

    if (result.ok) {
      await this.audit.recordAction({
        userId: message.userId,
        spaceId: message.spaceId,
        action: decision === 'approve' ? 'workflow.approved' : 'workflow.rejected',
        entityType: 'WorkflowInstance',
        entityId: instanceId,
        channel: message.channel,
      });
    }

    return { reply: result.reply, callbackAnswer: result.reply };
  }

  // ── Inbox Zero Review Deck ────────────────────────────────────

  private inboxSessionKey(userId: string): string {
    return `messaging:inbox:${userId}`;
  }

  /**
   * /inbox command: Build the summary card with counts and a "Start Review" button.
   */
  private async handleInbox(
    message: InboundMessage,
    lang: MessagingLang,
  ): Promise<InboundResult> {
    const items = await this.buildInboxQueue(message);

    if (items.length === 0) {
      return { reply: msg('INBOX_EMPTY', lang) };
    }

    // Count items by kind
    const approvalCount = items.filter((i) => i.kind === 'approval').length;
    const mentionCount = items.filter((i) => i.kind === 'mention').length;
    const taskCount = items.filter((i) => i.kind === 'task').length;

    // Store session in cache
    const session: InboxSession = { items, currentIndex: 0, lang };
    await this.cache
      .set(this.inboxSessionKey(message.userId), session, INBOX_SESSION_TTL)
      .catch((err) => this.logger.warn(`Inbox session save failed: ${errorMessage(err)}`));

    const summaryText = msg('INBOX_SUMMARY', lang, approvalCount, mentionCount, taskCount);

    return {
      reply: summaryText,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: lang === 'ar' ? 'بدء المراجعة ⚡' : 'Start Review ⚡',
              callback_data: 'inbox:start',
            },
          ],
        ],
      },
    };
  }

  /**
   * Handle inbox navigation callbacks (inbox:start, inbox:next, inbox:skip, inbox:approve:*, etc.)
   */
  private async handleInboxCallback(
    message: InboundMessage,
    payload: string,
    lang: MessagingLang,
  ): Promise<InboundResult> {
    const session = await this.cache.get<InboxSession>(
      this.inboxSessionKey(message.userId),
    );

    if (!session || !session.items.length) {
      return { reply: msg('INBOX_EMPTY', lang), callbackAnswer: msg('INBOX_EMPTY', lang) };
    }

    const action = payload.replace('inbox:', '');

    if (action === 'start' || action === 'next') {
      return this.renderCurrentInboxCard(session, message);
    }

    if (action === 'skip') {
      session.currentIndex++;
      if (session.currentIndex >= session.items.length) {
        await this.cache.del(this.inboxSessionKey(message.userId)).catch(() => {});
        return { reply: msg('INBOX_CLEARED', lang), callbackAnswer: msg('INBOX_CLEARED', lang) };
      }
      await this.cache
        .set(this.inboxSessionKey(message.userId), session, INBOX_SESSION_TTL)
        .catch(() => {});
      return this.renderCurrentInboxCard(session, message);
    }

    // inbox:approve:<instanceId>
    if (action.startsWith('approve:')) {
      const instanceId = action.slice('approve:'.length);
      const result = await this.approvals.resolve(instanceId, message.userId, 'APPROVED', lang);
      if (result.ok) {
        await this.audit.recordAction({
          userId: message.userId,
          spaceId: message.spaceId,
          action: 'workflow.approved',
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          channel: message.channel,
        });
      }
      return this.advanceInbox(session, message, result.reply);
    }

    // inbox:reject:<instanceId>
    if (action.startsWith('reject:')) {
      const instanceId = action.slice('reject:'.length);
      const result = await this.approvals.resolve(instanceId, message.userId, 'REJECTED', lang);
      if (result.ok) {
        await this.audit.recordAction({
          userId: message.userId,
          spaceId: message.spaceId,
          action: 'workflow.rejected',
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          channel: message.channel,
        });
      }
      return this.advanceInbox(session, message, result.reply);
    }

    // inbox:read:<commentId>  — mark mention as read
    if (action.startsWith('read:')) {
      const commentId = action.slice('read:'.length);
      await this.prisma.mention
        .updateMany({
          where: { commentId, mentionedId: message.userId },
          data: { isRead: true },
        })
        .catch(() => {});
      const ack = lang === 'ar' ? '✓ تم التحديد كمقروء' : '✓ Marked as read';
      return this.advanceInbox(session, message, ack);
    }

    // inbox:done:<taskId>  — mark task as done
    if (action.startsWith('done:')) {
      const taskId = action.slice('done:'.length);
      try {
        const update: UpdateTaskDto = { status: TaskStatus.DONE };
        await this.tasks.updateTask(taskId, update, message.userId, message.spaceId);
        await this.audit.recordAction({
          userId: message.userId,
          spaceId: message.spaceId,
          action: 'task.completed',
          entityType: 'task',
          entityId: taskId,
          channel: message.channel,
        });
      } catch {
        // Swallow — advance anyway
      }
      const ack = lang === 'ar' ? '✅ تم إنهاء المهمة' : '✅ Task completed';
      return this.advanceInbox(session, message, ack);
    }

    return { reply: msg('UNKNOWN', lang) };
  }

  /**
   * Advance the inbox to the next item or show the "Cleared" card.
   */
  private async advanceInbox(
    session: InboxSession,
    message: InboundMessage,
    ackText: string,
  ): Promise<InboundResult> {
    session.currentIndex++;
    if (session.currentIndex >= session.items.length) {
      await this.cache.del(this.inboxSessionKey(message.userId)).catch(() => {});
      const cleared = msg('INBOX_CLEARED', session.lang);
      return { reply: `${ackText}\n\n${cleared}`, callbackAnswer: ackText };
    }
    await this.cache
      .set(this.inboxSessionKey(message.userId), session, INBOX_SESSION_TTL)
      .catch(() => {});
    const nextCard = this.renderInboxItem(session);
    return {
      reply: `${ackText}\n\n${nextCard.text}`,
      callbackAnswer: ackText,
      replyMarkup: nextCard.markup,
    };
  }

  /**
   * Render the current card in the inbox session.
   */
  private async renderCurrentInboxCard(
    session: InboxSession,
    message: InboundMessage,
  ): Promise<InboundResult> {
    if (session.currentIndex >= session.items.length) {
      await this.cache.del(this.inboxSessionKey(message.userId)).catch(() => {});
      return { reply: msg('INBOX_CLEARED', session.lang), callbackAnswer: msg('INBOX_CLEARED', session.lang) };
    }

    const card = this.renderInboxItem(session);
    return {
      reply: card.text,
      callbackAnswer: session.lang === 'ar' ? 'جارٍ المراجعة...' : 'Reviewing...',
      replyMarkup: card.markup,
    };
  }

  /**
   * Build the text and inline keyboard for the current inbox item.
   */
  private renderInboxItem(session: InboxSession): { text: string; markup: Record<string, unknown> } {
    const item = session.items[session.currentIndex];
    const idx = session.currentIndex + 1;
    const total = session.items.length;
    const lang = session.lang;

    if (item.kind === 'approval') {
      const text = msg('INBOX_REVIEW_APPROVAL', lang, idx, total, item.title, item.subtitle, '');
      return {
        text,
        markup: {
          inline_keyboard: [
            [
              { text: lang === 'ar' ? 'موافق ✅' : 'Approve ✅', callback_data: `inbox:approve:${item.instanceId}` },
              { text: lang === 'ar' ? 'رفض ❌' : 'Reject ❌', callback_data: `inbox:reject:${item.instanceId}` },
              { text: lang === 'ar' ? 'تخطي ➡️' : 'Skip ➡️', callback_data: 'inbox:skip' },
            ],
          ],
        },
      };
    }

    if (item.kind === 'mention') {
      const text = msg('INBOX_REVIEW_MENTION', lang, idx, total, item.subtitle, item.title);
      return {
        text,
        markup: {
          inline_keyboard: [
            [
              { text: lang === 'ar' ? 'تم القراءة ✓' : 'Mark Read ✓', callback_data: `inbox:read:${item.commentId}` },
              { text: lang === 'ar' ? 'تخطي ➡️' : 'Skip ➡️', callback_data: 'inbox:skip' },
            ],
          ],
        },
      };
    }

    // task
    const text = msg('INBOX_REVIEW_TASK', lang, idx, total, item.id, item.title);
    return {
      text,
      markup: {
        inline_keyboard: [
          [
            { text: lang === 'ar' ? 'إنهاء ✅' : 'Done ✅', callback_data: `inbox:done:${item.taskId}` },
            { text: lang === 'ar' ? 'تخطي ➡️' : 'Skip ➡️', callback_data: 'inbox:skip' },
          ],
        ],
      },
    };
  }

  /**
   * Build the unified inbox queue: Approvals → Mentions → Due Today tasks.
   */
  private async buildInboxQueue(message: InboundMessage): Promise<InboxItem[]> {
    const items: InboxItem[] = [];

    // 1. Pending approvals
    try {
      const filters = new WorkflowFilterDto();
      filters.page = 1;
      filters.limit = 20;
      const pending = await this.workflow.getPendingForReviewer(
        message.userId,
        message.spaceId,
        filters,
      );
      const approvals = (pending.data ?? []) as PendingApprovalItem[];
      for (const a of approvals) {
        items.push({
          kind: 'approval',
          id: a.id.slice(-8),
          title: a.definition?.name || a.entityType || 'Approval',
          subtitle: a.requester?.name || '',
          instanceId: a.id,
        });
      }
    } catch (err) {
      this.logger.warn(`Inbox: failed to load approvals: ${errorMessage(err)}`);
    }

    // 2. Unread mentions
    try {
      const mentions = await this.prisma.mention.findMany({
        where: {
          mentionedId: message.userId,
          isRead: false,
          comment: { deletedAt: null },
        },
        include: {
          comment: {
            select: {
              id: true,
              content: true,
              author: { select: { name: true } },
              task: { select: { identifier: true, title: true } },
            },
          },
        },
        take: 10,
      });

      for (const m of mentions) {
        const snippet = m.comment.content.length > 80
          ? m.comment.content.slice(0, 80) + '…'
          : m.comment.content;
        items.push({
          kind: 'mention',
          id: m.commentId,
          title: snippet,
          subtitle: m.comment.author?.name || 'Someone',
          commentId: m.commentId,
        });
      }
    } catch (err) {
      this.logger.warn(`Inbox: failed to load mentions: ${errorMessage(err)}`);
    }

    // 3. Tasks due today
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const assignments = await this.prisma.taskAssignment.findMany({
        where: {
          userId: message.userId,
          task: {
            deletedAt: null,
            isArchived: false,
            status: { in: OPEN_STATUSES },
            dueDate: { gte: todayStart, lte: todayEnd },
            board: { department: { spaceId: message.spaceId } },
          },
        },
        include: {
          task: { select: { id: true, identifier: true, title: true } },
        },
        take: 10,
      });

      for (const a of assignments) {
        items.push({
          kind: 'task',
          id: a.task.identifier,
          title: a.task.title,
          subtitle: '',
          taskId: a.task.id,
        });
      }
    } catch (err) {
      this.logger.warn(`Inbox: failed to load due tasks: ${errorMessage(err)}`);
    }

    return items;
  }

  // ── Delegation ────────────────────────────────────────────────

  /**
   * /delegate <name> <end-date>  — set up approval delegation.
   * Example: /delegate sara 2026-07-01
   */
  private async handleDelegate(
    message: InboundMessage,
    parsed: ParsedIntent,
    lang: MessagingLang,
  ): Promise<string> {
    const argText = parsed.title?.trim();
    if (!argText) {
      return lang === 'ar'
        ? '⚠️ الاستخدام: /delegate <اسم> <تاريخ_انتهاء>\nمثال: /delegate sara 2026-07-01'
        : '⚠️ Usage: /delegate <name> <end-date>\nExample: /delegate sara 2026-07-01';
    }

    const parts = argText.split(/\s+/);
    const nameQuery = parts.slice(0, -1).join(' ') || parts[0];
    const dateStr = parts.length > 1 ? parts[parts.length - 1] : null;

    // Parse end date
    let endsAt: Date;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      endsAt = new Date(dateStr + 'T23:59:59.999Z');
    } else {
      // Default: 7 days from now
      endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 7);
    }

    // Find the target user by name (fuzzy match within the space)
    const targetUser = await this.prisma.user.findFirst({
      where: {
        memberships: { some: { spaceId: message.spaceId } },
        name: { contains: nameQuery, mode: 'insensitive' },
        id: { not: message.userId },
      },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return msg('DELEGATION_NOT_FOUND', lang);
    }

    await this.delegation.createDelegation(
      message.userId,
      targetUser.id,
      message.spaceId,
      endsAt,
    );

    // Get current user's name
    const currentUser = await this.prisma.user.findUnique({
      where: { id: message.userId },
      select: { name: true },
    });

    return msg(
      'DELEGATION_SET',
      lang,
      currentUser?.name || 'You',
      targetUser.name,
      endsAt.toISOString().split('T')[0],
    );
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
