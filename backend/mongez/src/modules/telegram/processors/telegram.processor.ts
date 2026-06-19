import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  QUEUE_NAMES,
  JOB_NAMES,
} from '../../../infrastructure/queue/queue.constants';
import { TelegramService } from '../services/telegram.service';
import { TelegramRepository } from '../repositories/telegram.repository';

interface SendTelegramJob {
  spaceId: string;
  chatId: string;
  text: string;
  replyMarkup?: any;
  type?: string;
  notificationId?: string;
}

/**
 * Consumes the `telegram` queue: resolves the space bot, records an outbound
 * TelegramMessage row, dispatches via the Bot API, then records the final
 * delivery status. Retries handled by BullMQ backoff.
 */
@Processor(QUEUE_NAMES.TELEGRAM)
export class TelegramProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(
    private readonly service: TelegramService,
    private readonly repo: TelegramRepository,
  ) {
    super();
  }

  async process(job: Job<SendTelegramJob>): Promise<void> {
    if (job.name !== JOB_NAMES.SEND_TELEGRAM) return;
    const data = job.data;

    const account = await this.service.resolveAccount(data.spaceId);
    if (!account) {
      this.logger.warn(
        `No Telegram bot configured for space ${data.spaceId} — skipping (dev fallback).`,
      );
      return;
    }

    const message = await this.repo.createMessage({
      spaceId: data.spaceId,
      direction: 'OUTBOUND',
      chatId: data.chatId,
      content: data.text,
      status: 'PENDING',
      metadata: {
        notificationId: data.notificationId,
        type: data.type,
        hasReplyMarkup: !!data.replyMarkup,
      },
    });

    const result = await this.service.sendMessage(
      account.botToken,
      data.chatId,
      data.text,
      {
        replyMarkup: data.replyMarkup,
      },
    );

    if (result.ok && result.tgMessageId != null) {
      await this.repo.updateMessage(message.id, {
        status: 'SENT',
        metadata: {
          ...(message.metadata as any),
          tgMessageId: result.tgMessageId,
          raw: result.raw,
        },
      });
      return;
    }

    await this.repo.updateMessage(message.id, {
      status: 'FAILED',
      errorCode: result.errorCode || 'UNKNOWN',
      metadata: { ...(message.metadata as any), raw: result.raw },
    });
    throw new Error(
      `Telegram send failed (code=${result.errorCode || 'UNKNOWN'})`,
    );
  }
}
