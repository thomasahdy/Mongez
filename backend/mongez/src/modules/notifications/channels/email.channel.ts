import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationChannel } from '../core/interfaces/notification-channel.interface';
import { Notification } from '@prisma/client';
import { BaseEvent } from '../core/contracts/event.contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailChannel implements NotificationChannel, OnModuleInit {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

  async send(notification: Notification, payload: BaseEvent): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized, skipping send.');
      return false;
    }

    // Fetch the real recipient email — never use a hardcoded address
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      this.logger.warn(`No email found for user ${notification.userId}, skipping email send.`);
      return false;
    }

    try {
      this.logger.log(`Sending email to ${user.email} for event ${payload.eventId}`);
      const from = this.configService.get<string>('SMTP_FROM') || process.env.SMTP_FROM || '"Mongez Platform" <noreply@mongez.com>';

      const info = await this.transporter.sendMail({
        from,
        to: user.email,
        subject: notification.title,
        text: notification.body,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4a90e2;">Mongez Notification</h2>
            <p>Hi ${user.name},</p>
            <p><strong>${notification.title}</strong></p>
            <p>${notification.body}</p>
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
      this.logger.error(`Failed to send email for notification ${notification.id}`, error);
      return false;
    }
  }
}
