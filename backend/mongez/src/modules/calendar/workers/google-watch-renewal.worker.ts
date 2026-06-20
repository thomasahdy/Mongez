import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarRepository } from '../repositories/calendar.repository';
import { GoogleCalendarService } from '../services/google-calendar.service';

@Injectable()
export class GoogleWatchRenewalWorker {
  private readonly logger = new Logger(GoogleWatchRenewalWorker.name);

  constructor(
    private readonly repo: CalendarRepository,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  // Run daily at midnight to renew Google Calendar push channels expiring within 48 hours
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async renewExpiringChannels() {
    this.logger.log('Starting scheduled Google Calendar watch channel renewal check...');
    try {
      const threshold = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours from now
      const expiringSyncs = await this.repo.findExpiringSyncChannels(threshold);

      if (expiringSyncs.length === 0) {
        this.logger.log('No expiring Google Calendar sync channels found.');
        return;
      }

      this.logger.log(`Found ${expiringSyncs.length} channel(s) expiring within 48 hours. Renewing...`);

      for (const sync of expiringSyncs) {
        try {
          this.logger.log(`Renewing channel for user ${sync.userId} in space ${sync.spaceId}`);
          
          // Attempt to stop the old channel
          await this.googleCalendarService.stopWatchChannel(sync.userId, sync.spaceId);
          
          // Register a brand new watch channel
          await this.googleCalendarService.registerWatchChannel(sync.userId, sync.spaceId);
          
          this.logger.log(`Successfully renewed channel for user ${sync.userId} in space ${sync.spaceId}`);
        } catch (err: any) {
          this.logger.error(
            `Failed to renew channel for user ${sync.userId} in space ${sync.spaceId}: ${err.message}`,
            err.stack,
          );
        }
      }
    } catch (err: any) {
      this.logger.error('Google Calendar watch channel renewal worker failed', err.stack);
    }
  }
}
