import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from '@prisma/client';
import { NotificationChannel } from '../../notifications/core/interfaces/notification-channel.interface';
import { BaseEvent } from '../../notifications/core/contracts/event.contracts';
import { WhatsAppRepository } from '../../whatsapp/repositories/whatsapp.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import {
  normalizeLang,
  renderNotification,
} from '../templates/messaging-i18n';

/**
 * NotificationChannel implementation that fans out to WhatsApp via the
 * dedicated `whatsapp` BullMQ queue. Idempotent and safe to no-op when the
 * recipient has no registered/opted-in WhatsAppContact or no account is
 * configured (dev fallback posture).
 */
@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(
    private readonly repo: WhatsAppRepository,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
  ) {}

  async send(
    notification: Notification,
    _payload: BaseEvent,
  ): Promise<boolean> {
    const spaceId = notification.spaceId;

    const contact = await this.repo.findContact(notification.userId, spaceId);
    if (!contact || !contact.optedIn || !contact.isVerified) {
      // Not registered, opted out, or not verified — silently skip.
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
    const content =
      lang === 'ar'
        ? `${rendered.title}\n${rendered.body}`.trim()
        : `${rendered.title}\n${rendered.body}`.trim();

    try {
      await this.whatsappQueue.add(
        JOB_NAMES.SEND_WHATSAPP,
        {
          spaceId,
          userId: notification.userId,
          toPhone: contact.phoneNumber,
          content,
          type: notification.type,
          notificationId: notification.id,
          entityType: notification.entityType,
          entityId: notification.entityId,
          metadata: notification.metadata,
        },
        {
          jobId: `wa:${notification.id}`,
          removeOnComplete: true,
        },
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to enqueue WhatsApp message for notification ${notification.id}`,
      );
      return false;
    }
  }
}
