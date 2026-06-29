import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationChannel } from '../core/interfaces/notification-channel.interface';
import { Notification } from '@prisma/client';
import { BaseEvent } from '../core/contracts/event.contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailChannel implements NotificationChannel, OnModuleInit {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.EMAILS) private readonly emailQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
      const port = this.configService.get<number>('SMTP_PORT') || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined);
      const user = this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER;
      const pass = this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS;
      const secure = this.configService.get<boolean>('SMTP_SECURE') || process.env.SMTP_SECURE === 'true';

      if (host && user && pass) {
        this.logger.log(`Initializing Production SMTP Transporter for ${host}:${port || 587}`);
        this.transporter = nodemailer.createTransport({
          host,
          port: port || 587,
          secure,
          auth: { user, pass },
        });
      } else {
        if (process.env.NODE_ENV === 'production') {
          this.logger.error('SMTP credentials missing in production! Skipping Email Transporter initialization.');
          return;
        }
        this.logger.log('SMTP credentials missing. Initializing Ethereal Test Transporter...');
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log('--- EMAIL CHANNEL READY ---');
        this.logger.log(`Test SMTP User: ${testAccount.user}`);
        this.logger.log(`Test SMTP Pass: ${testAccount.pass}`);
        this.logger.log('---------------------------');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Email Transporter', error);
    }
  }

  // Queue-based asynchronous sending trigger
  async send(notification: Notification, payload: BaseEvent): Promise<boolean> {
    try {
      this.logger.log(`Queueing email sending job for notification ${notification.id} to BullMQ`);
      await this.emailQueue.add(JOB_NAMES.SEND_EMAIL, {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        userId: notification.userId,
        eventId: payload.eventId,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to queue email sending job: ${err.message}`);
      return false;
    }
  }

  // Direct Nodemailer execution method consumed by the background queue processor
  async sendMailDirect(
    userId: string,
    title: string,
    body: string,
    eventId: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized, skipping send.');
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      this.logger.warn(`No email found for user ${userId}, skipping email send.`);
      return false;
    }

    try {
      this.logger.log(`Sending email to ${user.email} for event ${eventId}`);
      const from = this.configService.get<string>('SMTP_FROM') || process.env.SMTP_FROM || '"Mongez Platform" <noreply@mongez.com>';

      const safeName = escapeHtml(user.name || '');
      const safeTitle = escapeHtml(title || '');
      const safeBody = escapeHtml(body || '').replace(/\n/g, '<br/>');

      const info = await this.transporter.sendMail({
        from,
        to: user.email,
        subject: title,
        text: body,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4a90e2;">Mongez Notification</h2>
            <p>Hi ${safeName},</p>
            <p><strong>${safeTitle}</strong></p>
            <p>${safeBody}</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <small style="color: #888;">You're receiving this because you're a member of a Mongez workspace.</small>
          </div>
        `,
      });

      this.logger.log(`Email dispatched! ID: ${info.messageId}`);
      if (info.messageId.includes('ethereal')) {
        this.logger.log(`🔍 Preview: ${nodemailer.getTestMessageUrl(info)}`);
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email direct to user ${userId} for event ${eventId}`, error);
      return false;
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
