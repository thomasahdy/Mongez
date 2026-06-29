import { DecisionsService, WorkflowResolvedDecisionListener } from './decisions.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WorkflowResolvedEvent } from '../workflow/events/workflow-events';

describe('Decisions Module', () => {
  let service: DecisionsService;
  let listener: WorkflowResolvedDecisionListener;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      decisionRecord: {
        findMany: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      workflowInstance: {
        findUnique: jest.fn(),
      },
    } as any;

    service = new DecisionsService(prisma);
    listener = new WorkflowResolvedDecisionListener(prisma);
  });

  describe('DecisionsService', () => {
    it('should get all decision records for a space', async () => {
      const mockList = [{ id: 'dec-1' }];
      prisma.decisionRecord.findMany.mockResolvedValue(mockList as any);

      const result = await service.getDecisions('space-1');

      expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });

    it('should delete a decision record by id', async () => {
      prisma.decisionRecord.delete.mockResolvedValue({ id: 'dec-1' } as any);

      const result = await service.deleteDecision('dec-1');

      expect(prisma.decisionRecord.delete).toHaveBeenCalledWith({
        where: { id: 'dec-1' },
      });
      expect(result).toEqual({ id: 'dec-1' });
    });
  });

  describe('WorkflowResolvedDecisionListener', () => {
    it('should handle WorkflowResolvedEvent and create a DecisionRecord for BUDGET with 1-year expiration', async () => {
      const mockInstance = {
        id: 'inst-1',
        spaceId: 'space-1',
        entityType: 'BUDGET',
        entityId: 'budget-1',
        requesterId: 'user-1',
        definition: { name: 'Budget Approval' },
        actions: [{ actorId: 'user-2', note: 'Approved' }],
        context: { amount: 5000 },
      };

      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance as any);
      prisma.decisionRecord.upsert.mockResolvedValue({ id: 'dec-1' } as any);

      const event = new WorkflowResolvedEvent({ id: 'inst-1' } as any, 'APPROVED');
      await listener.handle(event);

      expect(prisma.workflowInstance.findUnique).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        include: {
          definition: true,
          actions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      expect(prisma.decisionRecord.upsert).toHaveBeenCalledWith({
        where: { workflowInstanceId: 'inst-1' },
        update: expect.objectContaining({
          outcome: 'APPROVED',
          decidedById: 'user-2',
          summary: 'Approved',
          validUntil: expect.any(Date),
          metadata: { amount: 5000 },
        }),
        create: expect.objectContaining({
          spaceId: 'space-1',
          workflowInstanceId: 'inst-1',
          entityType: 'BUDGET',
          entityId: 'budget-1',
          title: 'Budget Approval',
          outcome: 'APPROVED',
          decidedById: 'user-2',
          summary: 'Approved',
          confidence: 1.0,
          metadata: { amount: 5000 },
          validUntil: expect.any(Date),
        }),
      });

      // Assert that validUntil is roughly 365 days from now
      const validUntil: Date = (prisma.decisionRecord.upsert.mock.calls[0][0] as any).create.validUntil;
      const daysDiff = Math.round((validUntil.getTime() - Date.now()) / (24 * 3600 * 1000));
      expect(daysDiff).toBe(365);
    });

    it('should handle WorkflowResolvedEvent for TASK and create a DecisionRecord with 90-day expiration', async () => {
      const mockInstance = {
        id: 'inst-2',
        spaceId: 'space-1',
        entityType: 'TASK',
        entityId: 'task-1',
        requesterId: 'user-1',
        definition: { name: 'Task Approval' },
        actions: [],
        context: {},
      };

      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance as any);
      prisma.decisionRecord.upsert.mockResolvedValue({ id: 'dec-2' } as any);

      const event = new WorkflowResolvedEvent({ id: 'inst-2' } as any, 'REJECTED');
      await listener.handle(event);

      expect(prisma.decisionRecord.upsert).toHaveBeenCalledWith({
        where: { workflowInstanceId: 'inst-2' },
        update: expect.objectContaining({
          outcome: 'REJECTED',
          decidedById: 'user-1',
          summary: 'Workflow Task Approval resolved as REJECTED.',
          validUntil: expect.any(Date),
        }),
        create: expect.objectContaining({
          entityType: 'TASK',
          decidedById: 'user-1',
          summary: 'Workflow Task Approval resolved as REJECTED.',
          validUntil: expect.any(Date),
        }),
      });

      const validUntil: Date = (prisma.decisionRecord.upsert.mock.calls[0][0] as any).create.validUntil;
      const daysDiff = Math.round((validUntil.getTime() - Date.now()) / (24 * 3600 * 1000));
      expect(daysDiff).toBe(90);
    });

    it('should handle WorkflowResolvedEvent for CUSTOM and create a DecisionRecord with 180-day expiration', async () => {
      const mockInstance = {
        id: 'inst-3',
        spaceId: 'space-1',
        entityType: 'CUSTOM',
        entityId: 'custom-1',
        requesterId: 'user-1',
        definition: { name: 'Custom Workflow' },
        actions: [],
        context: {},
      };

      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance as any);
      prisma.decisionRecord.upsert.mockResolvedValue({ id: 'dec-3' } as any);

      const event = new WorkflowResolvedEvent({ id: 'inst-3' } as any, 'APPROVED');
      await listener.handle(event);

      expect(prisma.decisionRecord.upsert).toHaveBeenCalledWith({
        where: { workflowInstanceId: 'inst-3' },
        update: expect.objectContaining({
          outcome: 'APPROVED',
          validUntil: expect.any(Date),
        }),
        create: expect.objectContaining({
          entityType: 'CUSTOM',
          validUntil: expect.any(Date),
        }),
      });

      const validUntil: Date = (prisma.decisionRecord.upsert.mock.calls[0][0] as any).create.validUntil;
      const daysDiff = Math.round((validUntil.getTime() - Date.now()) / (24 * 3600 * 1000));
      expect(daysDiff).toBe(180);
    });

    it('should safely log error and not throw when database operation fails', async () => {
      prisma.workflowInstance.findUnique.mockRejectedValue(new Error('DB connection failure'));

      const event = new WorkflowResolvedEvent({ id: 'inst-error' } as any, 'APPROVED');
      
      // Should not throw
      await expect(listener.handle(event)).resolves.not.toThrow();
    });
  });
});
