import { AuditService } from './audit.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TraceContextService } from '../../infrastructure/logging/trace-context.service';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

describe('AuditService', () => {
  let service: AuditService;
  let auditQueue: jest.Mocked<Queue>;
  let prisma: any;
  let traceContext: jest.Mocked<TraceContextService>;

  beforeEach(() => {
    auditQueue = {
      add: jest.fn(),
    } as any;

    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      membership: {
        findMany: jest.fn(),
      },
    };

    traceContext = {
      correlationId: 'test-correlation-id',
    } as any;

    service = new AuditService(auditQueue, prisma as PrismaService, traceContext);
  });

  describe('log()', () => {
    it('UT-AUDIT-LOG-001: should drop invalid input and log a warning', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      service.log({ userId: '', action: 'UPDATE', entityType: 'TASK', entityId: 't-1' });
      expect(auditQueue.add).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid audit input dropped'));

      loggerSpy.mockRestore();
    });

    it('UT-AUDIT-LOG-002: should enqueue valid input with correlation ID', async () => {
      auditQueue.add.mockResolvedValue({ id: 'job-1' } as any);

      service.log({ userId: 'u-1', action: 'UPDATE', entityType: 'TASK', entityId: 't-1' });

      expect(auditQueue.add).toHaveBeenCalledWith(
        'log-activity',
        expect.objectContaining({
          userId: 'u-1',
          action: 'UPDATE',
          entityType: 'TASK',
          entityId: 't-1',
          correlationId: 'test-correlation-id',
        }),
        { removeOnComplete: 500 },
      );
    });

    it('UT-AUDIT-LOG-003: should log error if queueing fails', async () => {
      auditQueue.add.mockRejectedValue(new Error('Queue full'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      service.log({ userId: 'u-1', action: 'UPDATE', entityType: 'TASK', entityId: 't-1' });

      // We must wait for the promise to reject in the background
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to enqueue audit log: Queue full'));

      loggerSpy.mockRestore();
    });
  });

  describe('record()', () => {
    it('UT-AUDIT-REC-001: should create audit log record in database', async () => {
      prisma.auditLog.create.mockResolvedValue({});

      await service.record({
        userId: 'u-1',
        action: 'UPDATE',
        entityType: 'TASK',
        entityId: 't-1',
        diff: { status: 'DONE' },
        ipAddress: '127.0.0.1',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          action: 'UPDATE',
          entityType: 'TASK',
          entityId: 't-1',
          diff: { status: 'DONE' },
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('UT-AUDIT-REC-002: should log error but not throw when database insert fails', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('DB disconnect'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      await expect(
        service.record({ userId: 'u-1', action: 'UPDATE', entityType: 'TASK', entityId: 't-1' }),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to record audit log: DB disconnect'));

      loggerSpy.mockRestore();
    });
  });

  describe('findBySpace()', () => {
    it('UT-AUDIT-SPACE-001: should find audit logs scoped to users who are members of space', async () => {
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u-1' }, { userId: 'u-2' }]);
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);

      const result = await service.findBySpace('space-1', {
        action: 'CREATE',
        entityType: 'TASK',
        page: 1,
        limit: 10,
      });

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1' },
        select: { userId: true },
      });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ['u-1', 'u-2'] },
          action: 'CREATE',
          entityType: 'TASK',
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual([{ id: 'log-1' }]);
    });
  });

  describe('findByUser()', () => {
    it('UT-AUDIT-USER-001: should find audit logs for user with pagination', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-2' }]);

      const result = await service.findByUser('user-1', { page: 2, limit: 15 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { timestamp: 'desc' },
        skip: 15,
        take: 15,
      });
      expect(result).toEqual([{ id: 'log-2' }]);
    });
  });
});
