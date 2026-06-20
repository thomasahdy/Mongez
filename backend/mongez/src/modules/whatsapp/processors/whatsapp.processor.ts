import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import {
  WhatsAppService,
  InteractiveButton,
} from '../services/whatsapp.service';
import { WhatsAppRepository } from '../repositories/whatsapp.repository';

interface SendWhatsappJob {
  spaceId: string;
  /** Recipient phone (E.164). When absent, resolved from the user's contact. */
  toPhone?: string | null;
  /** Used to resolve the recipient contact when `toPhone` is absent. */
  userId?: string;
  content?: string;
  type?: string;
  notificationId?: string;
  entityId?: string;
  entityType?: string;
  interactive?: { bodyText: string; buttons: InteractiveButton[] };
  metadata?: any;
}

/**
 * Consumes the `whatsapp` queue: resolves the space account, records an
 * outbound WhatsAppMessage row, dispatches it via the Meta Cloud API, then
 * records the final delivery status. Retries are handled by BullMQ backoff.
 */
@Processor(QUEUE_NAMES.WHATSAPP)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly service: WhatsAppService,
    private readonly repo: WhatsAppRepository,
  ) {
    super();
  }

  async process(job: Job<SendWhatsappJob>): Promise<void> {
    if (job.name !== JOB_NAMES.SEND_WHATSAPP) return;
    const data = job.data;

    // Resolve the recipient phone: explicit > contact lookup by user.
    let toPhone = data.toPhone;
    if (!toPhone && data.userId) {
      const contact = await this.repo.findContact(data.userId, data.spaceId);
      toPhone = contact?.phoneNumber || null;
    }
    if (!toPhone) {
      this.logger.log(
        `No WhatsApp recipient for space ${data.spaceId} — skipping.`,
      );
      return;
    }

    const account = await this.service.resolveAccount(data.spaceId);
    if (!account) {
      this.logger.warn(
        `No WhatsApp account configured for space ${data.spaceId} — skipping (dev fallback).`,
      );
      return;
    }

    // 1. Record the outbound message as PENDING.
    const message = await this.repo.createMessage({
      spaceId: data.spaceId,
      direction: 'OUTBOUND',
      fromPhone: account.phoneNumberId,
      toPhone,
      content: data.interactive?.bodyText || data.content || '',
      status: 'PENDING',
      metadata: {
        notificationId: data.notificationId,
        type: data.type,
        entityId: data.entityId,
        entityType: data.entityType,
        interactive: !!data.interactive,
      },
    });

    // 2. Dispatch via Meta Cloud API.
    let result: any;

    if (data.interactive) {
      result = await this.service.sendInteractiveButtons(
        account,
        toPhone,
        data.interactive.bodyText,
        data.interactive.buttons,
      );
    } else if (data.type === 'APPROVAL_REQUESTED' || data.type === 'WORKFLOW_APPROVAL_REQUEST') {
      const meta = data.metadata || {};
      const workflowName = String(meta.title || meta.workflowName || 'Workflow');
      const taskName = String(meta.body || meta.taskName || 'Task Review');
      const requesterName = String(meta.actorName || meta.requesterName || 'System');

      result = await this.service.sendTemplate(
        account,
        toPhone,
        'approval_request',
        undefined,
        [workflowName, taskName, requesterName]
      );

      if (result.status !== 'SENT') {
        this.logger.warn(`Template approval_request failed, falling back to plain text`);
        result = await this.service.sendText(account, toPhone, data.content || '');
      }
    } else if (data.type === 'TASK_ASSIGNED' || data.type === 'TASK_DUE') {
      const meta = data.metadata || {};
      const boardName = String(meta.boardName || 'General');
      const taskName = String(meta.taskIdentifier || meta.title || 'Task');
      const dueDate = String(meta.dueDate || 'No due date');
      const assignerName = String(meta.actorName || 'Someone');

      result = await this.service.sendTemplate(
        account,
        toPhone,
        'task_notification',
        undefined,
        [boardName, taskName, dueDate, assignerName]
      );

      if (result.status !== 'SENT') {
        this.logger.warn(`Template task_notification failed, falling back to plain text`);
        result = await this.service.sendText(account, toPhone, data.content || '');
      }
    } else if (data.type === 'otp_verification') {
      result = await this.service.sendTemplate(
        account,
        toPhone,
        'otp_verification',
        data.content
      );
      if (result.status !== 'SENT') {
        result = await this.service.sendText(account, toPhone, data.content || '');
      }
    } else {
      result = await this.service.sendText(account, toPhone, data.content || '');
    }

    // 3. Record the outcome.
    if (result.status === 'SENT' && result.waMessageId) {
      await this.repo.updateMessage(message.id, {
        status: 'SENT',
        waMessageId: result.waMessageId,
        metadata: { ...(message.metadata as any), raw: result.raw },
      });
      return;
    }

    // FAILED — persist error, rethrow so BullMQ honours backoff/retries.
    await this.repo.updateMessage(message.id, {
      status: 'FAILED',
      errorCode: result.errorCode || 'UNKNOWN',
      metadata: { ...(message.metadata as any), raw: result.raw },
    });

    throw new Error(
      `WhatsApp send failed (code=${result.errorCode || 'UNKNOWN'})`,
    );
  }
}
