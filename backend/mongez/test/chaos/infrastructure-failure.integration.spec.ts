import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { OutboxRelayService } from '../../src/modules/notifications/outbox/outbox-relay.service';
import { AICircuitBreakerService } from '../../src/modules/ai/circuit-breaker/ai-circuit-breaker.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { StorageService } from '../../src/infrastructure/storage/storage.service';
import { TelegramService } from '../../src/modules/telegram/services/telegram.service';
import { WhatsAppService } from '../../src/modules/whatsapp/services/whatsapp.service';
import { UsersService } from '../../src/modules/users/users.service';
import { UserRepository } from '../../src/modules/users/repositories/user.repository';

describe('Infrastructure Failure & Chaos Testing', () => {
  let app: any;
  let cacheService: CacheService;
  let outboxRelay: OutboxRelayService;
  let aiCircuitBreaker: AICircuitBreakerService;
  let prisma: PrismaService;
  let storageService: StorageService;
  let telegramService: TelegramService;
  let whatsAppService: WhatsAppService;
  let usersService: UsersService;
  let userRepository: UserRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = app.get(CacheService);
    outboxRelay = app.get(OutboxRelayService);
    aiCircuitBreaker = app.get(AICircuitBreakerService);
    prisma = app.get(PrismaService);
    storageService = app.get(StorageService);
    telegramService = app.get(TelegramService);
    whatsAppService = app.get(WhatsAppService);
    usersService = app.get(UsersService);
    userRepository = app.get(UserRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Redis Failure', () => {
    it('should fall back to DB query when Redis is down', async () => {
      const originalRedis = (cacheService as any).redis;
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        set: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        setex: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      } as any;
      (cacheService as any).redis = mockRedis;

      const dbQuerySpy = jest.fn().mockResolvedValue({ id: 'data' });
      const result = await cacheService.getOrSet('test-key', dbQuerySpy, 60);

      expect(result).toEqual({ id: 'data' });
      expect(dbQuerySpy).toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalled();

      (cacheService as any).redis = originalRedis;
    });
  });

  describe('PostgreSQL Failure', () => {
    it('should throw clean errors and not crash when DB is down', async () => {
      const spy = jest.spyOn(userRepository, 'findById').mockRejectedValue(new Error('PostgreSQL connection timeout'));

      await expect(usersService.getById('user-1')).rejects.toThrow('PostgreSQL connection timeout');

      spy.mockRestore();
    });
  });

  describe('BullMQ Failure', () => {
    it('should keep outbox events intact and not crash when queue is down', async () => {
      const dummyEvent = await prisma.outboxEvent.create({
        data: {
          aggregateType: 'Task',
          aggregateId: 'task-1',
          eventType: 'task.created',
          payload: { eventId: 'evt-1' },
        },
      });

      const originalAdd = (outboxRelay as any).notificationQueue.add;
      (outboxRelay as any).notificationQueue.add = jest.fn().mockRejectedValue(new Error('BullMQ offline'));

      await expect(outboxRelay.handleOutboxRelay()).resolves.not.toThrow();

      const freshEvent = await prisma.outboxEvent.findUnique({ where: { id: dummyEvent.id } });
      expect(freshEvent?.processedAt).toBeNull();

      (outboxRelay as any).notificationQueue.add = originalAdd;
      await prisma.outboxEvent.delete({ where: { id: dummyEvent.id } });
    });
  });

  describe('AI Service Failure', () => {
    it('should trip circuit breaker and return fallback response when AI is offline', async () => {
      aiCircuitBreaker.reset();
      const failingAction = jest.fn().mockRejectedValue(new Error('AI offline'));

      for (let i = 0; i < 3; i++) {
        await expect(aiCircuitBreaker.call(failingAction)).rejects.toThrow('AI offline');
      }

      expect(aiCircuitBreaker.getState()).toBe('OPEN');

      const result = await aiCircuitBreaker.call(failingAction);
      expect((result as any).degraded).toBe(true);
      expect((result as any).response).toContain('AI is temporarily unavailable');
    });
  });

  describe('Storage (S3) Failure', () => {
    it('should throw storage exception when upload fails', async () => {
      const originalProvider = (storageService as any).activeProvider;
      const mockProvider = {
        upload: jest.fn().mockRejectedValue(new Error('S3 upload refused')),
      } as any;
      (storageService as any).activeProvider = mockProvider;

      await expect(storageService.upload('key', Buffer.from('data'), 'text/plain')).rejects.toThrow('S3 upload refused');

      (storageService as any).activeProvider = originalProvider;
    });
  });

  describe('Telegram API Failure', () => {
    it('should return ok: false instead of crashing when Telegram API is down', async () => {
      const originalPost = (telegramService as any).http.post;
      (telegramService as any).http.post = jest.fn().mockRejectedValue(new Error('Telegram API connection timeout'));

      const result = await telegramService.sendMessage('token', 'chat-id', 'hello');
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBeDefined();

      (telegramService as any).http.post = originalPost;
    });
  });

  describe('WhatsApp API Failure', () => {
    it('should return status: FAILED or error response when WhatsApp API is down', async () => {
      const originalPost = (whatsAppService as any).http.post;
      (whatsAppService as any).http.post = jest.fn().mockRejectedValue(new Error('WhatsApp API error'));

      const mockAccount = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-1',
        wabaId: 'waba-1',
        accessToken: 'token',
        displayName: 'TestDisplayName',
        source: 'db',
      } as any;

      const result = await whatsAppService.sendText(mockAccount, 'phone', 'hello');
      expect(result.status).toBe('FAILED');

      (whatsAppService as any).http.post = originalPost;
    });
  });
});
