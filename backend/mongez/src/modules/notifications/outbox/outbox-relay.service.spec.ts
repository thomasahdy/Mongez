import { OutboxRelayService } from './outbox-relay.service';
import { OutboxRepository } from './outbox.repository';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let outboxRepo: jest.Mocked<OutboxRepository>;
  let notificationQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    outboxRepo = {
      getUnprocessedEvents: jest.fn(),
      markAsProcessed: jest.fn(),
      createEvent: jest.fn(),
    } as any;

    notificationQueue = {
      add: jest.fn(),
    } as any;

    service = new OutboxRelayService(outboxRepo, notificationQueue);
  });

  it('UT-OUTBOX-001: should query unprocessed events in batch of 50', async () => {
    outboxRepo.getUnprocessedEvents.mockResolvedValue([]);

    await service.handleOutboxRelay();

    expect(outboxRepo.getUnprocessedEvents).toHaveBeenCalledWith(50);
  });

  it('UT-OUTBOX-002: should prevent concurrent cron execution overlapping', async () => {
    outboxRepo.getUnprocessedEvents.mockImplementation(async () => {
      // Simulate slow DB response during which concurrent trigger happens
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [];
    });

    // Start first execution
    const firstPromise = service.handleOutboxRelay();
    // Attempt second execution while first is in-progress
    await service.handleOutboxRelay();

    await firstPromise;

    // Repo query should only be called once because the second was skipped
    expect(outboxRepo.getUnprocessedEvents).toHaveBeenCalledTimes(1);
  });

  it('UT-OUTBOX-003: should add event to BullMQ queue and mark as processed in database', async () => {
    const mockEvent = { id: 'evt-1', type: 'TASK_CREATED', payload: { taskId: 'task-1' } };
    outboxRepo.getUnprocessedEvents.mockResolvedValue([mockEvent] as any);
    notificationQueue.add.mockResolvedValue({ id: 'job-1' } as any);
    outboxRepo.markAsProcessed.mockResolvedValue({} as any);

    await service.handleOutboxRelay();

    expect(notificationQueue.add).toHaveBeenCalledWith('process_event', mockEvent, {
      jobId: 'evt-1',
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    expect(outboxRepo.markAsProcessed).toHaveBeenCalledWith('evt-1');
  });

  it('UT-OUTBOX-004: should leave event unprocessed if BullMQ push fails', async () => {
    const mockEvent = { id: 'evt-1', type: 'TASK_CREATED', payload: { taskId: 'task-1' } };
    outboxRepo.getUnprocessedEvents.mockResolvedValue([mockEvent] as any);
    notificationQueue.add.mockRejectedValue(new Error('BullMQ failure'));
    
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    await service.handleOutboxRelay();

    expect(notificationQueue.add).toHaveBeenCalled();
    expect(outboxRepo.markAsProcessed).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to relay OutboxEvent evt-1'),
      expect.any(Error),
    );

    loggerSpy.mockRestore();
  });

  it('UT-OUTBOX-005: should log error and reset mutex if outbox fetching throws', async () => {
    outboxRepo.getUnprocessedEvents.mockRejectedValue(new Error('DB connection lost'));
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    await service.handleOutboxRelay();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in OutboxRelay loop'),
      expect.any(Error),
    );

    // Verify we can run it again because mutex was reset in finally block
    outboxRepo.getUnprocessedEvents.mockResolvedValue([]);
    await service.handleOutboxRelay();
    expect(outboxRepo.getUnprocessedEvents).toHaveBeenCalledTimes(2);

    loggerSpy.mockRestore();
  });
});
