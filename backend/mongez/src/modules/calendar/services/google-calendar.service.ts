import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarRepository } from '../repositories/calendar.repository';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { CalendarEventSource, CalendarEventVisibility } from '@prisma/client';

type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repo: CalendarRepository,
    private readonly encryption: EncryptionService,
    private readonly calendarService: CalendarService,
    private readonly prisma: PrismaService,
  ) {}

  private getOAuth2Client(redirectUri?: string): GoogleOAuth2Client {
    const clientId = this.config.get<string>('auth.google.clientId') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.config.get<string>('auth.google.clientSecret') || process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = redirectUri || this.config.get<string>('auth.google.callbackUrl') || 'http://localhost:3000/api/calendar/google/callback';
    
    return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
  }

  async getAuthenticatedClient(userId: string, spaceId: string): Promise<GoogleOAuth2Client> {
    const sync = await this.repo.getGoogleSync(userId, spaceId);
    if (!sync || !sync.accessTokenEncrypted || !sync.refreshTokenEncrypted) {
      throw new Error('Google Calendar integration is not configured for this user and space.');
    }

    const oauth2Client = this.getOAuth2Client();
    const accessToken = this.encryption.decrypt(sync.accessTokenEncrypted);
    const refreshToken = this.encryption.decrypt(sync.refreshTokenEncrypted);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const isExpired = sync.tokenExpiresAt ? new Date().getTime() >= new Date(sync.tokenExpiresAt).getTime() - 5 * 60 * 1000 : true;

    if (isExpired) {
      this.logger.log(`Google access token for user ${userId} expired or expiring soon. Refreshing...`);
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        const newAccessToken = credentials.access_token;
        const newExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);

        await this.repo.upsertGoogleSync(userId, spaceId, {
          accessTokenEncrypted: newAccessToken ? this.encryption.encrypt(newAccessToken) : undefined,
          tokenExpiresAt: newExpiry,
        });

        oauth2Client.setCredentials(credentials);
      } catch (err: any) {
        this.logger.error(`Failed to refresh Google OAuth token for user ${userId}: ${err.message}`);
        throw err;
      }
    }

    return oauth2Client;
  }

  async getSyncStatus(userId: string, spaceId: string) {
    const sync = await this.repo.getGoogleSync(userId, spaceId);
    return {
      connected: !!sync && sync.isActive && !!sync.refreshTokenEncrypted,
      lastSyncAt: sync?.lastSyncAt || null,
    };
  }

  async getAuthUrl(userId: string, spaceId: string, redirectUri?: string): Promise<string> {
    const oauth2Client = this.getOAuth2Client(redirectUri);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: JSON.stringify({ userId, spaceId }),
    });
  }

  async handleCallback(code: string, stateStr: string, redirectUri?: string): Promise<any> {
    const state = JSON.parse(stateStr);
    const { userId, spaceId } = state;

    const oauth2Client = this.getOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    const { access_token, refresh_token, expiry_date } = tokens;

    const updatedSync = await this.repo.upsertGoogleSync(userId, spaceId, {
      accessTokenEncrypted: access_token ? this.encryption.encrypt(access_token) : null,
      refreshTokenEncrypted: refresh_token ? this.encryption.encrypt(refresh_token) : undefined,
      tokenExpiresAt: expiry_date ? new Date(expiry_date) : null,
      isActive: true,
    });

    // Start watch subscription
    try {
      oauth2Client.setCredentials(tokens);
      await this.registerWatchChannel(userId, spaceId, oauth2Client);
    } catch (err: any) {
      this.logger.error(`Failed to register watch channel during setup for user ${userId}: ${err.message}`);
    }

    // Trigger initial sync
    try {
      await this.syncCalendar(userId, spaceId);
    } catch (err: any) {
      this.logger.error(`Failed to execute initial sync for user ${userId}: ${err.message}`);
    }

    return updatedSync;
  }

  async registerWatchChannel(userId: string, spaceId: string, authClient?: any) {
    const client = authClient || (await this.getAuthenticatedClient(userId, spaceId));
    const calendar = google.calendar({ version: 'v3', auth: client });
    const channelId = uuidv4();
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const webhookUrl = `${apiBaseUrl}/api/calendar/google/webhook`;

    this.logger.log(`Registering Google watch channel ${channelId} for user ${userId}`);
    const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    await this.repo.upsertGoogleSync(userId, spaceId, {
      channelId,
      resourceId: response.data.resourceId,
      channelExpiry: response.data.expiration ? new Date(Number(response.data.expiration)) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
  }

  async stopWatchChannel(userId: string, spaceId: string, authClient?: any) {
    const sync = await this.repo.getGoogleSync(userId, spaceId);
    if (sync?.channelId && sync?.resourceId) {
      const client = authClient || (await this.getAuthenticatedClient(userId, spaceId));
      const calendar = google.calendar({ version: 'v3', auth: client });
      try {
        await calendar.channels.stop({
          requestBody: {
            id: sync.channelId,
            resourceId: sync.resourceId,
          },
        });
      } catch (err: any) {
        this.logger.error(`Failed to stop watch channel for user ${userId}: ${err.message}`);
      }
    }
  }

  async syncCalendar(userId: string, spaceId: string) {
    const oauth2Client = await this.getAuthenticatedClient(userId, spaceId);
    const sync = await this.repo.getGoogleSync(userId, spaceId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const params: any = {
      calendarId: 'primary',
      singleEvents: true,
    };

    if (sync?.syncToken) {
      params.syncToken = sync.syncToken;
    } else {
      params.timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    }

    let response;
    try {
      response = await calendar.events.list(params);
    } catch (err: any) {
      if (err.code === 410) {
        this.logger.warn(`Google Calendar syncToken expired for user ${userId}. Re-indexing...`);
        delete params.syncToken;
        params.timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        response = await calendar.events.list(params);
      } else {
        throw err;
      }
    }

    const items = response.data.items || [];
    const nextSyncToken = response.data.nextSyncToken;

    for (const item of items) {
      if (item.status === 'cancelled') {
        await this.prisma.calendarEvent.updateMany({
          where: { spaceId, googleEventId: item.id },
          data: { isDeleted: true },
        });
        continue;
      }

      const startDate = item.start?.dateTime ? new Date(item.start.dateTime) : (item.start?.date ? new Date(item.start.date) : new Date());
      const endDate = item.end?.dateTime ? new Date(item.end.dateTime) : (item.end?.date ? new Date(item.end.date) : startDate);
      const hijriDate = this.calendarService.gregorianToHijri(startDate);

      const eventData = {
        title: item.summary || 'Google Calendar Event',
        description: item.description || '',
        startDate,
        endDate,
        allDay: !item.start?.dateTime,
        location: item.location || '',
        source: CalendarEventSource.GOOGLE,
        googleEventId: item.id,
        hijriDate,
        visibility: item.visibility === 'private' ? CalendarEventVisibility.PRIVATE : CalendarEventVisibility.PUBLIC,
        metadata: {
          status: item.status,
          htmlLink: item.htmlLink,
          iCalUID: item.iCalUID,
        },
      };

      const existingEvent = await this.prisma.calendarEvent.findFirst({
        where: { spaceId, googleEventId: item.id },
      });

      if (existingEvent) {
        await this.prisma.calendarEvent.update({
          where: { id: existingEvent.id },
          data: eventData,
        });
      } else {
        await this.prisma.calendarEvent.create({
          data: {
            ...eventData,
            spaceId,
            createdById: userId,
          },
        });
      }
    }

    await this.repo.upsertGoogleSync(userId, spaceId, {
      syncToken: nextSyncToken || null,
      lastSyncAt: new Date(),
    });
  }

  async handleWebhookNotification(channelId: string, resourceState: string) {
    this.logger.log(`Google Calendar webhook notification received. Channel: ${channelId}, State: ${resourceState}`);
    if (resourceState === 'sync') {
      this.logger.log('Google Sync channel check received, skipping update.');
      return;
    }

    const sync = await this.repo.findGoogleSyncByChannel(channelId);
    if (!sync) {
      this.logger.warn(`Google watch channel ${channelId} not found in database.`);
      return;
    }

    await this.syncCalendar(sync.userId, sync.spaceId);
  }

  // --- Push local updates to Google Calendar ---
  async pushEventToGoogle(userId: string, spaceId: string, eventId: string) {
    try {
      const sync = await this.repo.getGoogleSync(userId, spaceId);
      if (!sync || !sync.isActive) return;

      const event = await this.prisma.calendarEvent.findUnique({
        where: { id: eventId },
        include: { participants: true },
      });

      if (!event || event.isDeleted) return;

      const oauth2Client = await this.getAuthenticatedClient(userId, spaceId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const gEventBody = {
        summary: event.title,
        description: event.description || '',
        start: event.allDay ? { date: event.startDate.toISOString().substring(0, 10) } : { dateTime: event.startDate.toISOString() },
        end: event.allDay ? { date: event.endDate.toISOString().substring(0, 10) } : { dateTime: event.endDate.toISOString() },
        location: event.location || '',
        attendees: event.participants.map((p) => ({
          email: p.email,
          displayName: p.displayName || '',
          responseStatus: p.status.toLowerCase() === 'pending' ? 'needsAction' : p.status.toLowerCase(),
        })),
      };

      if (event.googleEventId) {
        await calendar.events.update({
          calendarId: 'primary',
          eventId: event.googleEventId,
          requestBody: gEventBody,
        });
      } else {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: gEventBody,
        });

        if (response.data.id) {
          await this.prisma.calendarEvent.update({
            where: { id: eventId },
            data: { googleEventId: response.data.id },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to push local event ${eventId} to Google Calendar: ${err.message}`);
    }
  }

  async deleteEventFromGoogle(userId: string, spaceId: string, googleEventId: string) {
    try {
      const sync = await this.repo.getGoogleSync(userId, spaceId);
      if (!sync || !sync.isActive) return;

      const oauth2Client = await this.getAuthenticatedClient(userId, spaceId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });
    } catch (err: any) {
      this.logger.error(`Failed to delete Google Calendar event ${googleEventId}: ${err.message}`);
    }
  }
}
