import { Logger } from '@nestjs/common';
import { NotificationsQueueEventsListener, AIProcessingQueueEventsListener } from './dlq.processor';
import { QUEUE_NAMES } from './queue.constants';

jest.mock('@nestjs/bullmq', () => {
  return {
    QueueEventsListener: () => (target: any) => target,
    QueueEventsHost: class {
      constructor() {}
    },
    OnQueueEvent: () => (target: any, key: string) => target,
  };
});

describe('DLQ Listeners', () => {
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('NotificationsQueueEventsListener', () => {
    it('should log failed jobs with details', () => {
      const listener = new NotificationsQueueEventsListener();
      listener.onQueueFailed('job-123', 'SMTP server timeout');

      expect(loggerSpy).toHaveBeenCalled();
      const logArg = loggerSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);

      expect(parsed.event).toBe('DLQ_JOB_FAILED');
      expect(parsed.queue).toBe(QUEUE_NAMES.NOTIFICATIONS);
      expect(parsed.jobId).toBe('job-123');
      expect(parsed.failedReason).toBe('SMTP server timeout');
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('AIProcessingQueueEventsListener', () => {
    it('should log failed jobs with details', () => {
      const listener = new AIProcessingQueueEventsListener();
      listener.onQueueFailed('job-456', 'LLM quota exceeded');

      expect(loggerSpy).toHaveBeenCalled();
      const logArg = loggerSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);

      expect(parsed.event).toBe('DLQ_JOB_FAILED');
      expect(parsed.queue).toBe(QUEUE_NAMES.AI_PROCESSING);
      expect(parsed.jobId).toBe('job-456');
      expect(parsed.failedReason).toBe('LLM quota exceeded');
      expect(parsed.timestamp).toBeDefined();
    });
  });
});
