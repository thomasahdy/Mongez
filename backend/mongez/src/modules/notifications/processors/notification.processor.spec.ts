import { NotificationProcessor } from './notification.processor';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { EmailChannel } from '../channels/email.channel';
import { WebSocketChannel } from '../channels/websocket.channel';
import { WhatsAppChannel } from '../../messaging/channels/whatsapp.channel';
import { TelegramChannel } from '../../messaging/channels/telegram.channel';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications.service';
import { Queue } from 'bullmq';

const makeJob = (data: any, name = 'process_event') =>
  ({ name, data } as any);

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let cacheService: jest.Mocked<CacheService>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let webSocketChannel: jest.Mocked<WebSocketChannel>;
  let whatsappChannel: jest.Mocked<WhatsAppChannel>;
  let telegramChannel: jest.Mocked<TelegramChannel>;
  let presenceService: jest.Mocked<PresenceService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let notificationPreferenceService: any;
  let messagingAnalytics: any;
  let prisma: any;
  let notificationQueue: jest.Mocked<Queue>;
  let traceContext: any;

  const mockNotif = { id: 'notif-1', userId: 'user-1' };

  const baseEvent = {
    id: 'event-1',
    aggregateType: 'task',
    aggregateId: 'task-1',
    eventType: 'TASK_UPDATED',
    payload: {
      eventId: 'evt-uuid-001',
      spaceId: 'space-1',
      assigneeId: 'user-1',
    },
  };

  beforeEach(() => {
    cacheService = {
      exists: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    emailChannel = { send: jest.fn().mockResolvedValue(undefined) } as any;
    webSocketChannel = { send: jest.fn().mockResolvedValue(undefined) } as any;
    whatsappChannel = { send: jest.fn().mockResolvedValue(true) } as any;
    telegramChannel = { send: jest.fn().mockResolvedValue(true) } as any;

    presenceService = {
      isUserOnline: jest.fn().mockResolvedValue(true),
    } as any;

    notificationsService = {
      createAndNotify: jest.fn().mockResolvedValue(mockNotif),
    } as any;

    notificationPreferenceService = {
      getEnabledChannels: jest.fn().mockResolvedValue(['inApp', 'email', 'push', 'whatsapp', 'telegram']),
    } as any;

    messagingAnalytics = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;

    prisma = {
      userPreference: {
        findUnique: jest.fn().mockResolvedValue({ language: 'en' }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
      },
    } as any;

    notificationQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as any;

    traceContext = {
      run: jest.fn().mockImplementation((id, fn) => fn()),
    } as any;

    processor = new NotificationProcessor(
      cacheService,
      emailChannel,
      webSocketChannel,
      whatsappChannel,
      telegramChannel,
      presenceService,
      notificationsService,
      notificationPreferenceService,
      messagingAnalytics,
      prisma,
      notificationQueue,
      traceContext,
    );
  });

  // ─── process() routing ───────────────────────────────────────

  describe('process()', () => {
    it('should route process_event jobs to handleProcessEvent', async () => {
      const spy = jest.spyOn(processor, 'handleProcessEvent').mockResolvedValue(undefined);
      const job = makeJob(baseEvent, 'process_event');

      await processor.process(job);

      expect(spy).toHaveBeenCalledWith(job);
    });

    it('should route process_digest jobs to handleProcessDigest', async () => {
      const spy = jest.spyOn(processor, 'handleProcessDigest').mockResolvedValue(undefined);
      const job = makeJob({}, 'process_digest');

      await processor.process(job);

      expect(spy).toHaveBeenCalledWith(job);
    });
  });

  // ─── handleProcessEvent: idempotency ─────────────────────────

  describe('handleProcessEvent()', () => {
    it('UT-NOTIF-PROC-001: should skip processing when event was already processed (idempotency)', async () => {
      cacheService.exists.mockResolvedValue(true);

      await processor.handleProcessEvent(makeJob(baseEvent));

      expect(notificationsService.createAndNotify).not.toHaveBeenCalled();
    });

    it('should skip when payload is missing or has no eventId', async () => {
      const jobMissingPayload = makeJob({ ...baseEvent, payload: {} });

      await processor.handleProcessEvent(jobMissingPayload);

      expect(notificationsService.createAndNotify).not.toHaveBeenCalled();
    });

    it('UT-NOTIF-PROC-002: should process event for online user via WebSocket and bypass suppression for CRITICAL priority', async () => {
      presenceService.isUserOnline.mockResolvedValue(true);
      const criticalEvent = {
        ...baseEvent,
        payload: {
          ...baseEvent.payload,
          priority: 'CRITICAL',
        },
      };

      await processor.handleProcessEvent(makeJob(criticalEvent));

      expect(notificationsService.createAndNotify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'TASK_UPDATED' }),
      );
      expect(webSocketChannel.send).toHaveBeenCalledWith(mockNotif, criticalEvent.payload);
      // Phase 1: fan-out to WhatsApp + Telegram channels (critical bypasses suppression)
      expect(whatsappChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'TASK_UPDATED' }),
        criticalEvent.payload,
      );
      expect(telegramChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'TASK_UPDATED' }),
        criticalEvent.payload,
      );
    });

    it('UT-NOTIF-PROC-003: should queue digest for offline user instead of immediate push', async () => {
      presenceService.isUserOnline.mockResolvedValue(false);
      notificationPreferenceService.getEnabledChannels.mockResolvedValue(['email', 'whatsapp', 'telegram']);
      // mock redis on cacheService
      (cacheService as any).redis = {
        rpush: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      };

      await processor.handleProcessEvent(makeJob(baseEvent));

      expect(notificationsService.createAndNotify).not.toHaveBeenCalled();
      expect(notificationQueue.add).toHaveBeenCalledWith(
        'process_digest',
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ delay: 300000 }),
      );
      // Offline users are still pushed to messaging channels (instant WA/TG)
      expect(whatsappChannel.send).toHaveBeenCalled();
      expect(telegramChannel.send).toHaveBeenCalled();
    });

    it('UT-NOTIF-PROC-004: should mark idempotency key with 24h TTL on success', async () => {
      presenceService.isUserOnline.mockResolvedValue(true);

      await processor.handleProcessEvent(makeJob(baseEvent));

      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:notification:evt-uuid-001',
        true,
        86400,
      );
    });

    it('UT-NOTIF-PROC-005: should rethrow error so BullMQ can retry the job', async () => {
      presenceService.isUserOnline.mockResolvedValue(true);
      notificationsService.createAndNotify.mockRejectedValue(new Error('DB write failed'));

      await expect(processor.handleProcessEvent(makeJob(baseEvent))).rejects.toThrow('DB write failed');
      // idempotency key must NOT be set on failure
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should process multi-user events by iterating all assigneeIds', async () => {
      const multiUserEvent = {
        ...baseEvent,
        payload: {
          ...baseEvent.payload,
          assigneeIds: ['user-2', 'user-3'],
        },
      };

      await processor.handleProcessEvent(makeJob(multiUserEvent));

      expect(notificationsService.createAndNotify).toHaveBeenCalledTimes(2);
      expect(notificationsService.createAndNotify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2' }),
      );
      expect(notificationsService.createAndNotify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-3' }),
      );
    });
  });
});
