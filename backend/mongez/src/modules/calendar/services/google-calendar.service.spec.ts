import { GoogleCalendarService } from './google-calendar.service';
import { CalendarRepository } from '../repositories/calendar.repository';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid-123',
}));

// Mock googleapis
const mockOAuth2Client = {
  setCredentials: jest.fn(),
  generateAuthUrl: jest.fn().mockReturnValue('http://auth-url'),
  getToken: jest.fn().mockResolvedValue({
    tokens: {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expiry_date: 123456789,
    },
  }),
  refreshAccessToken: jest.fn().mockResolvedValue({
    credentials: {
      access_token: 'refreshed-access-token',
      expiry_date: 987654321,
    },
  }),
};

const mockCalendarEvents = {
  watch: jest.fn().mockResolvedValue({
    data: {
      resourceId: 'resource-123',
      expiration: '1700000000000',
    },
  }),
  list: jest.fn().mockResolvedValue({
    data: {
      items: [
        {
          id: 'g-event-1',
          status: 'confirmed',
          summary: 'Sync Session',
          description: 'Team sync',
          start: { dateTime: '2026-06-20T10:00:00Z' },
          end: { dateTime: '2026-06-20T11:00:00Z' },
          visibility: 'public',
        },
        {
          id: 'g-event-2',
          status: 'cancelled',
        },
      ],
      nextSyncToken: 'next-sync-token-123',
    },
  }),
  insert: jest.fn().mockResolvedValue({
    data: { id: 'g-event-new' },
  }),
  update: jest.fn().mockResolvedValue({
    data: { id: 'g-event-updated' },
  }),
  delete: jest.fn().mockResolvedValue({}),
};

const mockCalendarChannels = {
  stop: jest.fn().mockResolvedValue({}),
};

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client),
    },
    calendar: jest.fn().mockImplementation(() => ({
      events: mockCalendarEvents,
      channels: mockCalendarChannels,
    })),
  },
}));

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;
  let config: jest.Mocked<ConfigService>;
  let repo: jest.Mocked<CalendarRepository>;
  let encryption: jest.Mocked<EncryptionService>;
  let calendarService: jest.Mocked<CalendarService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    config = {
      get: jest.fn().mockReturnValue('test-value'),
    } as any;

    repo = {
      getGoogleSync: jest.fn(),
      upsertGoogleSync: jest.fn(),
      findGoogleSyncByChannel: jest.fn(),
    } as any;

    encryption = {
      encrypt: jest.fn((val) => `enc-${val}`),
      decrypt: jest.fn((val) => val.replace('enc-', '')),
    } as any;

    calendarService = {
      gregorianToHijri: jest.fn().mockReturnValue('1448-01-05'),
    } as any;

    prisma = {
      calendarEvent: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;

    service = new GoogleCalendarService(config, repo, encryption, calendarService, prisma);
  });

  describe('getAuthenticatedClient()', () => {
    it('should throw error if integration is not configured', async () => {
      repo.getGoogleSync.mockResolvedValue(null);
      await expect(service.getAuthenticatedClient('user-1', 'space-1')).rejects.toThrow(
        'Google Calendar integration is not configured',
      );
    });

    it('should return client with set credentials if token is not expired', async () => {
      const syncRecord = {
        accessTokenEncrypted: 'enc-valid-token',
        refreshTokenEncrypted: 'enc-refresh-token',
        tokenExpiresAt: new Date(Date.now() + 3600_000), // 1hr future
      };

      repo.getGoogleSync.mockResolvedValue(syncRecord as any);

      const client = await service.getAuthenticatedClient('user-1', 'space-1');

      expect(client).toBeDefined();
      expect(encryption.decrypt).toHaveBeenCalledWith('enc-valid-token');
      expect(encryption.decrypt).toHaveBeenCalledWith('enc-refresh-token');
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
      });
    });

    it('should refresh access token if token is expired', async () => {
      const syncRecord = {
        accessTokenEncrypted: 'enc-expired-token',
        refreshTokenEncrypted: 'enc-refresh-token',
        tokenExpiresAt: new Date(Date.now() - 3600_000), // 1hr past
      };

      repo.getGoogleSync.mockResolvedValue(syncRecord as any);

      const client = await service.getAuthenticatedClient('user-1', 'space-1');

      expect(client).toBeDefined();
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(repo.upsertGoogleSync).toHaveBeenCalledWith('user-1', 'space-1', {
        accessTokenEncrypted: 'enc-refreshed-access-token',
        tokenExpiresAt: expect.any(Date),
      });
    });
  });

  describe('getAuthUrl()', () => {
    it('should generate Google OAuth consent URL', async () => {
      const url = await service.getAuthUrl('user-1', 'space-1', 'http://redirect');
      expect(url).toBe('http://auth-url');
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          state: JSON.stringify({ userId: 'user-1', spaceId: 'space-1' }),
        }),
      );
    });
  });

  describe('handleCallback()', () => {
    it('should fetch tokens, save sync settings, register watch channel, and trigger sync', async () => {
      repo.getGoogleSync.mockResolvedValue({
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
      } as any);

      repo.upsertGoogleSync.mockResolvedValue({ id: 'sync-1' } as any);

      const stateStr = JSON.stringify({ userId: 'user-1', spaceId: 'space-1' });
      await service.handleCallback('code-123', stateStr);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('code-123');
      expect(repo.upsertGoogleSync).toHaveBeenCalledWith(
        'user-1',
        'space-1',
        expect.objectContaining({
          accessTokenEncrypted: 'enc-new-access-token',
          isActive: true,
        }),
      );
      // Register watch channel assertion
      expect(mockCalendarEvents.watch).toHaveBeenCalled();
      // Sync calendar events assertion
      expect(mockCalendarEvents.list).toHaveBeenCalled();
    });
  });

  describe('stopWatchChannel()', () => {
    it('should stop watch channel if active channel details exist', async () => {
      repo.getGoogleSync.mockResolvedValue({
        channelId: 'channel-123',
        resourceId: 'resource-123',
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
      } as any);

      await service.stopWatchChannel('user-1', 'space-1');

      expect(mockCalendarChannels.stop).toHaveBeenCalledWith({
        requestBody: {
          id: 'channel-123',
          resourceId: 'resource-123',
        },
      });
    });
  });

  describe('syncCalendar()', () => {
    it('should sync events from Google to local database', async () => {
      repo.getGoogleSync.mockResolvedValue({
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
        syncToken: 'old-sync-token',
      } as any);

      prisma.calendarEvent.findFirst.mockResolvedValue(null);

      await service.syncCalendar('user-1', 'space-1');

      expect(mockCalendarEvents.list).toHaveBeenCalledWith(
        expect.objectContaining({
          syncToken: 'old-sync-token',
        }),
      );

      // Verify task deletions for cancelled event
      expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1', googleEventId: 'g-event-2' },
        data: { isDeleted: true },
      });

      // Verify task creation for active event
      expect(prisma.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Sync Session',
            googleEventId: 'g-event-1',
            spaceId: 'space-1',
          }),
        }),
      );

      // Verify upsert Google sync state updates with nextSyncToken
      expect(repo.upsertGoogleSync).toHaveBeenCalledWith('user-1', 'space-1', {
        syncToken: 'next-sync-token-123',
        lastSyncAt: expect.any(Date),
      });
    });
  });

  describe('handleWebhookNotification()', () => {
    it('should run syncCalendar if status state is change event', async () => {
      repo.findGoogleSyncByChannel.mockResolvedValue({
        userId: 'user-1',
        spaceId: 'space-1',
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
      } as any);

      repo.getGoogleSync.mockResolvedValue({
        userId: 'user-1',
        spaceId: 'space-1',
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
      } as any);

      await service.handleWebhookNotification('channel-123', 'exists');

      expect(repo.findGoogleSyncByChannel).toHaveBeenCalledWith('channel-123');
      expect(mockCalendarEvents.list).toHaveBeenCalled();
    });

    it('should skip syncCalendar if state is sync check message', async () => {
      await service.handleWebhookNotification('channel-123', 'sync');
      expect(repo.findGoogleSyncByChannel).not.toHaveBeenCalled();
    });
  });

  describe('pushEventToGoogle()', () => {
    it('should insert new event to Google Calendar if not synced previously', async () => {
      repo.getGoogleSync.mockResolvedValue({
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
        isActive: true,
      } as any);

      prisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'event-1',
        title: 'Meeting 1',
        startDate: new Date(),
        endDate: new Date(),
        allDay: false,
        location: '',
        participants: [{ email: 'participant@example.com', displayName: 'User', status: 'PENDING' }],
      } as any);

      await service.pushEventToGoogle('user-1', 'space-1', 'event-1');

      expect(mockCalendarEvents.insert).toHaveBeenCalled();
      expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { googleEventId: 'g-event-new' },
      });
    });

    it('should update existing event in Google Calendar', async () => {
      repo.getGoogleSync.mockResolvedValue({
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
        isActive: true,
      } as any);

      prisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'event-1',
        googleEventId: 'g-event-existing',
        title: 'Meeting 1',
        startDate: new Date(),
        endDate: new Date(),
        allDay: false,
        location: '',
        participants: [],
      } as any);

      await service.pushEventToGoogle('user-1', 'space-1', 'event-1');

      expect(mockCalendarEvents.update).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'g-event-existing',
        }),
      );
    });
  });

  describe('deleteEventFromGoogle()', () => {
    it('should call events.delete on Google Calendar', async () => {
      repo.getGoogleSync.mockResolvedValue({
        accessTokenEncrypted: 'enc-token',
        refreshTokenEncrypted: 'enc-refresh',
        isActive: true,
      } as any);

      await service.deleteEventFromGoogle('user-1', 'space-1', 'g-event-1');

      expect(mockCalendarEvents.delete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'g-event-1',
      });
    });
  });
});
