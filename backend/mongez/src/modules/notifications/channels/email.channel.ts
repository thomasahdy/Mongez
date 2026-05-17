import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationChannel } from '../core/interfaces/notification-channel.interface';
import { Notification } from '@prisma/client';
import { BaseEvent } from '../core/contracts/event.contracts';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailChannel implements NotificationChannel, OnModuleInit {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: nodemailer.Transporter;

  async onModuleInit() {
    // For testing/reference, we automatically generate an Ethereal test account.
    // In a production environment, you would use configService to get SMTP details.
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log('--- EMAIL CHANNEL READY ---');
      this.logger.log(`Test SMTP User: ${testAccount.user}`);
      this.logger.log(`Test SMTP Pass: ${testAccount.pass}`);
      this.logger.log('---------------------------');
    } catch (error) {
      this.logger.error('Failed to initialize Email Transporter', error);
    }
  }

  async send(notification: Notification, payload: BaseEvent): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized, skipping send.');
      return false;
    }

    try {
      this.logger.log(`Sending Real Email to User ${notification.userId} for Event ${payload.eventId}`);
      
      const info = await this.transporter.sendMail({
        from: '"Mongez Platform" <noreply@mongez.com>',
        to: 'user-test@example.com', // Fetch user.email from DB in production
        subject: notification.title,
        text: notification.body,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4a90e2;">Mongez Notification</h2>
            <p><strong>${notification.title}</strong></p>
            <p>${notification.body}</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <small style="color: #888;">This is a test notification from the Mongez Event Platform.</small>
          </div>
        `,
      });

      this.logger.log(`Email successfully dispatched! ID: ${info.messageId}`);
      this.logger.log(`🔍 VIEW EMAIL HERE: ${nodemailer.getTestMessageUrl(info)}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to dispatch Email for Notification ${notification.id}`, error);
      return false;
    }
  }
}
