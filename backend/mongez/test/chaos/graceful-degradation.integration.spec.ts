import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { OutboxRelayService } from '../../src/modules/notifications/outbox/outbox-relay.service';
import { OutboxRepository } from '../../src/modules/notifications/outbox/outbox.repository';
import { AICircuitBreakerService } from '../../src/modules/ai/circuit-breaker/ai-circuit-breaker.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../src/infrastructure/queue/queue.constants';

describe('Chaos & Graceful Degradation (Integration)', () => {
  let app: any;
  let cacheService: CacheService;
  let outboxRelay: OutboxRelayService;
  let outboxRepository: OutboxRepository;
  let aiCircuitBreaker: AICircuitBreakerService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = app.get(CacheService);
    outboxRelay = app.get(OutboxRelayService);
    outboxRepository = app.get(OutboxRepository);
    aiCircuitBreaker = app.get(AICircuitBreakerService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1: Redis Down (Cache Fallback)', () => {
    it('should fall back to database query when Redis is unavailable', async () => {
      // 1. Get original redis instance to restore later
      const originalRedis = (cacheService as any).redis;

      // 2. Mock redis to throw on get/set simulating redis crash
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        set: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        setex: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      } as any;
      (cacheService as any).redis = mockRedis;

      // 3. Define a factory that queries DB (simulating actual query)
      const dbQuerySpy = jest.fn().mockResolvedValue({ id: 'data-from-db' });

      // 4. Execute getOrSet
      const result = await cacheService.getOrSet('test-key', dbQuerySpy, 60);

      // 5. Assert fallback succeeded
      expect(result).toEqual({ id: 'data-from-db' });
      expect(dbQuerySpy).toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalled();

      // Restore original redis client
      (cacheService as any).redis = originalRedis;
    });
  });

  describe('Scenario 2: BullMQ Down (Outbox Relay Resiliency)', () => {
    it('should fail to relay but keep outbox events intact and avoid API crashes when BullMQ is offline', async () => {
      // 1. Create a dummy outbox event in DB
      const dummyEvent = await prisma.outboxEvent.create({
        data: {
          aggregateType: 'Task',
          aggregateId: 'task-chaos-001',
          eventType: 'task.created',
          payload: { eventId: 'evt-chaos-abc' },
        },
      });

      // 2. Mock BullMQ Queue to fail on add() simulating BullMQ crash
      const originalAdd = (outboxRelay as any).notificationQueue.add;
      (outboxRelay as any).notificationQueue.add = jest.fn().mockRejectedValue(new Error('BullMQ connection lost'));

      // 3. Run outbox relay
      // Expect that it does NOT crash the application/process
      await expect(outboxRelay.handleOutboxRelay()).resolves.not.toThrow();

      // 4. Assert that the outbox event remains unprocessed
      const freshEvent = await prisma.outboxEvent.findUnique({
        where: { id: dummyEvent.id },
      });
      expect(freshEvent?.processedAt).toBeNull();

      // Cleanup & restore
      (outboxRelay as any).notificationQueue.add = originalAdd;
      await prisma.outboxEvent.delete({ where: { id: dummyEvent.id } });
    });
  });

  describe('Scenario 3: AI Service Down (Circuit Breaker Tripping)', () => {
    it('should trip the circuit to OPEN after failures and return fallback response without calling AI client', async () => {
      // 1. Reset circuit breaker to closed state
      aiCircuitBreaker.reset();

      // 2. Define an AI action that fails
      const failingAIAction = jest.fn().mockRejectedValue(new Error('AI Provider Offline'));

      // 3. Make consecutive failing calls to trip circuit breaker (threshold is 3 failures)
      for (let i = 0; i < 3; i++) {
        await expect(aiCircuitBreaker.call(failingAIAction)).rejects.toThrow('AI Provider Offline');
      }

      // 4. Verify the state transitioned to OPEN
      expect(aiCircuitBreaker.getState()).toBe('OPEN');

      // 5. Run the action again. It should return degraded fallback response
      const result = await aiCircuitBreaker.call(failingAIAction);
      expect(result).toBeDefined();
      expect((result as any).degraded).toBe(true);
      expect((result as any).response).toContain('AI is temporarily unavailable');
      expect(failingAIAction).toHaveBeenCalledTimes(3); // Only 3 times, 4th time bypassed due to OPEN state
    });
  });
});
