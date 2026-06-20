import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalendarService } from './services/calendar.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  @Get('events')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get unified calendar timeline events' })
  async getEvents(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('sources') sources?: string[],
    @Query('holidayCountry') holidayCountry?: string,
  ) {
    const parsedSources = typeof sources === 'string' ? [sources] : sources;
    return this.calendarService.getUnifiedFeed(spaceId, startDate, endDate, req.user.userId, {
      sources: parsedSources,
      holidayCountry,
    });
  }

  @Post('events')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a custom event' })
  async createEvent(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Body() dto: CreateEventDto,
  ) {
    const event = await this.calendarService.createEvent(spaceId, req.user.userId, dto);
    this.googleCalendarService.pushEventToGoogle(req.user.userId, spaceId, event.id).catch(() => {});
    return event;
  }

  @Patch('events/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a custom event' })
  async updateEvent(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.calendarService.updateEvent(id, spaceId, dto);
    this.googleCalendarService.pushEventToGoogle(req.user.userId, spaceId, id).catch(() => {});
    return event;
  }

  @Delete('events/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a custom event' })
  async deleteEvent(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Param('id') id: string,
  ) {
    const event = await this.calendarService.getEventById(id, spaceId);
    await this.calendarService.deleteEvent(id, spaceId);
    
    if (event?.googleEventId) {
      this.googleCalendarService.deleteEventFromGoogle(req.user.userId, spaceId, event.googleEventId).catch(() => {});
    }
    return { success: true };
  }

  @Post('google/connect')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate Google OAuth connection URL' })
  async connectGoogle(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const url = await this.googleCalendarService.getAuthUrl(req.user.userId, spaceId, redirectUri);
    return { url };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    await this.googleCalendarService.handleCallback(code, state, redirectUri);
    return `
      <html>
        <head>
          <title>Google Calendar Connected</title>
          <script>
            window.close();
          </script>
        </head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #121214; color: #ffffff;">
          <div style="text-align: center; border: 1px solid #29292e; padding: 2rem; border-radius: 12px; background: #1a1a1e;">
            <h2 style="color: #4ade80;">Integration Successful!</h2>
            <p>Google Calendar has been linked. You can close this window now.</p>
          </div>
        </body>
      </html>
    `;
  }

  @Post('google/sync')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Trigger manual Google Calendar sync' })
  async syncGoogle(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
  ) {
    await this.googleCalendarService.syncCalendar(req.user.userId, spaceId);
    return { success: true };
  }

  @Post('google/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Google Calendar push notification webhook receiver' })
  async googleWebhook(
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-resource-state') resourceState: string,
  ) {
    if (channelId && resourceState) {
      await this.googleCalendarService.handleWebhookNotification(channelId, resourceState);
    }
    return { success: true };
  }
}
