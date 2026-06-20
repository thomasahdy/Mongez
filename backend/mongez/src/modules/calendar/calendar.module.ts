import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './services/calendar.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { CalendarRepository } from './repositories/calendar.repository';
import { GoogleWatchRenewalWorker } from './workers/google-watch-renewal.worker';
import { CalendarEventHandlers } from './listeners/timeline-event.listener';

@Module({
  imports: [CqrsModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    GoogleCalendarService,
    CalendarRepository,
    GoogleWatchRenewalWorker,
    ...CalendarEventHandlers,
  ],
  exports: [CalendarService, GoogleCalendarService],
})
export class CalendarModule {}
