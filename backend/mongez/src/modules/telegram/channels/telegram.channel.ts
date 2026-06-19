import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from '@prisma/client';
import { NotificationChannel } from '../../notifications/core/interfaces/notification-channel.interface';
import { BaseEvent } from '../../notifications/core/contracts/event.contracts';
import { TelegramRepository } from '../repositories/telegram.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import {
  normalizeLang,
  renderNotification,
  encodeApprovalCallback,
} from '../../messaging/i18n/messaging-i18n';

const APPROVAL_TYPES = new Set([
  'APPROVAL_REQUESTED',
  'WORKFLOW_APPROVAL_REQUEST',
]);

/**
 * NotificationChannel implementation that fans out to Telegram via the
 * `telegram` BullMQ queue. Approval notifications are enriched with an inline
 * keyboard (Approve / Reject) carrying the workflow instance id — no template
 * approval needed, so this works out-of-the-box.
 */
@Injectable()
export class TelegramChannel implements NotificationChannel {
  private readonly logger = new Logger(TelegramChannel.name);

  constructor(
    private readonly repo: TelegramRepository,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.TELEGRAM) private readonly telegramQueue: Queue,
  ) {}

  async send(
    notification: Notification,
    _payload: BaseEvent,
  ): Promise<boolean> {
    const spaceId = notification.spaceId;

    const contact = await this.repo.findContact(notification.userId, spaceId);
    if (!contact || !contact.optedIn) {
      return false;
    }

    const pref = await this.prisma.userPreference.findUnique({
      where: { userId: notification.userId },
      select: { language: true },
    });
    const lang = normalizeLang(pref?.language);
    const rendered = renderNotification(notification.type, lang, {
      title: notification.title,
      body: notification.body,
    });
    const text = `${rendered.title}\n${rendered.body}`.trim();

    // Attach inline keyboard for approval requests.
    let replyMarkup: any = undefined;
    const instanceId =
      notification.entityType === 'workflow' ? notification.entityId : null;
    if (APPROVAL_TYPES.has(notification.type) && instanceId) {
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: lang === 'ar' ? 'موافق' : 'Approve',
              callback_data: encodeApprovalCallback('approve', instanceId),
            },
            {
              text: lang === 'ar' ? 'رفض' : 'Reject',
              callback_data: encodeApprovalCallback('reject', instanceId),
            },
          ],
        ],
      };
    }

    try {
      await this.telegramQueue.add(
        JOB_NAMES.SEND_TELEGRAM,
        {
          spaceId,
          userId: notification.userId,
          chatId: contact.chatId,
          text,
          replyMarkup,
          type: notification.type,
          notificationId: notification.id,
        },
        {
          jobId: `tg:${notification.id}`,
          removeOnComplete: true,
        },
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to enqueue Telegram message for notification ${notification.id}`,
      );
      return false;
    }
  }
}
