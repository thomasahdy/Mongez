import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EventBus } from '@nestjs/cqrs';
import { DelegationService } from '../delegation/delegation.service';
import { SlaService } from '../sla/sla.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

// Helper: build a mock workflow instance
const buildInstance = (overrides: Partial<any> = {}): any => ({
  id: 'instance-1',
  definitionId: 'def-1',
  spaceId: 'space-1',
  entityType: 'task',
  entityId: 'task-1',
  requesterId: 'user-requester',
  currentStep: 0,
  status: 'IN_PROGRESS',
  context: null,
  createdAt: new Date(),
  resolvedAt: null,
  definition: {
    id: 'def-1',
    name: 'Budget Approval',
    steps: [
      {
        id: 'step-1',
        order: 0,
        name: 'Finance Review',
        approverType: 'USER',
        approverIds: ['user-approver'],
        approverRole: null,
        isParallel: false,
        requiresAll: false,
        timeoutHours: null,
      },
    ],
  },
  actions: [],
  ...overrides,
});

describe('WorkflowService', () => {
  let service: WorkflowService;
  let repo: jest.Mocked<WorkflowRepository>;
  let notifications: jest.Mocked<NotificationsService>;
  let realtime: jest.Mocked<RealtimeService>;
  let messagingApproval: any;
  let eventBus: jest.Mocked<EventBus>;
  let delegationService: jest.Mocked<DelegationService>;
  let slaService: jest.Mocked<SlaService>;
  let prisma: any;

  beforeEach(() => {
    repo = {
      findDefinitions: jest.fn(),
      createDefinition: jest.fn(),
      findDefinitionById: jest.fn(),
      updateDefinition: jest.fn(),
      createInstance: jest.fn(),
      updateInstance: jest.fn(),
      findInstanceById: jest.fn(),
      findInstanceByIdForUpdateTx: jest.fn(),
      createAction: jest.fn(),
      findPendingForReviewer: jest.fn(),
      findMyRequests: jest.fn(),
    } as any;

    notifications = {
      queueNotification: jest.fn(),
    } as any;

    realtime = {
      emitToUser: jest.fn(),
      emitToSpace: jest.fn(),
    } as any;

    messagingApproval = {
      sendApprovalRequestToUser: jest.fn().mockResolvedValue(undefined),
    } as any;

    eventBus = {
      publish: jest.fn(),
    } as any;

    delegationService = {
      getActiveDelegate: jest.fn().mockResolvedValue(null),
    } as any;

    slaService = {
      recordMetric: jest.fn().mockResolvedValue(undefined),
    } as any;

    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      workflowInstance: {
        update: jest.fn().mockResolvedValue({}),
      },
      workflowAction: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      slaMetric: {
        create: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;

    service = new WorkflowService(
      repo,
      notifications,
      realtime,
      messagingApproval,
      eventBus,
      delegationService,
      slaService,
      prisma as PrismaService,
      { assertMember: jest.fn().mockResolvedValue('OWNER') } as any,
    );
  });

  // ─── createDefinition ────────────────────────────────────────

  describe('createDefinition()', () => {
    it('should throw BadRequestException when steps array is empty', async () => {
      await expect(
        service.createDefinition('space-1', 'user-1', { name: 'Flow', triggerType: 'MANUAL', steps: [] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDefinition('space-1', 'user-1', { name: 'Flow', triggerType: 'MANUAL', steps: [] }),
      ).rejects.toThrow('at least one step');
    });

    it('should create definition when steps are provided', async () => {
      const mockDef = { id: 'def-new', name: 'New Flow' };
      repo.createDefinition.mockResolvedValue(mockDef as any);

      const result = await service.createDefinition('space-1', 'user-1', {
        name: 'New Flow',
        triggerType: 'MANUAL',
        steps: [{ order: 0, name: 'Step 1', approverIds: ['user-1'] }],
      });

      expect(repo.createDefinition).toHaveBeenCalled();
      expect(result).toEqual(mockDef);
    });
  });

  // ─── updateDefinition ────────────────────────────────────────

  describe('updateDefinition()', () => {
    it('should throw NotFoundException when definition not found', async () => {
      repo.findDefinitionById.mockResolvedValue(null);

      await expect(service.updateDefinition('bad-def', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update definition when found', async () => {
      repo.findDefinitionById.mockResolvedValue({ id: 'def-1' } as any);
      repo.updateDefinition.mockResolvedValue({ id: 'def-1', name: 'Updated' } as any);

      const result = await service.updateDefinition('def-1', { name: 'Updated' });

      expect(result).toMatchObject({ name: 'Updated' });
    });
  });

  // ─── startWorkflow ───────────────────────────────────────────

  describe('startWorkflow()', () => {
    const dto = {
      definitionId: 'def-1',
      spaceId: 'space-1',
      entityType: 'task',
      entityId: 'task-1',
    } as any;

    it('should throw NotFoundException when definition not found', async () => {
      repo.findDefinitionById.mockResolvedValue(null);

      await expect(service.startWorkflow('user-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when definition is inactive', async () => {
      repo.findDefinitionById.mockResolvedValue({ isActive: false, spaceId: 'space-1', steps: [{}] } as any);

      await expect(service.startWorkflow('user-1', dto)).rejects.toThrow(BadRequestException);
      await expect(service.startWorkflow('user-1', dto)).rejects.toThrow('inactive');
    });

    it('should throw ForbiddenException when definition belongs to another space', async () => {
      repo.findDefinitionById.mockResolvedValue({
        isActive: true,
        spaceId: 'different-space',
        steps: [{}],
      } as any);

      await expect(service.startWorkflow('user-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('should start workflow, notify reviewers, and emit WebSocket event', async () => {
      const mockDef = {
        id: 'def-1',
        name: 'Budget Approval',
        isActive: true,
        spaceId: 'space-1',
        steps: [{ order: 0, name: 'Review', approverIds: ['user-approver'], approverRole: null }],
      };
      repo.findDefinitionById.mockResolvedValue(mockDef as any);
      repo.createInstance.mockResolvedValue({ id: 'instance-new' } as any);
      repo.updateInstance.mockResolvedValue(buildInstance({ id: 'instance-new' }));
      repo.findInstanceById.mockResolvedValue(buildInstance({ id: 'instance-new' }));

      await service.startWorkflow('user-requester', dto);

      expect(repo.createInstance).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'workflow.approval_request',
            payload: expect.objectContaining({ userId: 'user-approver' }),
          }),
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'user-requester',
        'workflow:started',
        expect.any(Object),
      );
    });
  });

  // ─── submitDecision ──────────────────────────────────────────

  describe('submitDecision()', () => {
    it('should throw NotFoundException when instance not found', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(null);

      await expect(service.submitDecision('instance-1', 'user-1', 'APPROVED')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when workflow already resolved', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(buildInstance({ status: 'APPROVED' }));

      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow('already resolved');
    });

    it('should throw ForbiddenException when actor is not an approver', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(buildInstance());

      await expect(
        service.submitDecision('instance-1', 'user-not-approver', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on duplicate decision for same actor', async () => {
      const instanceWithAction = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'APPROVED' }],
      });
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instanceWithAction);

      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow('already submitted');
    });

    it('should resolve workflow as APPROVED when last step is approved', async () => {
      const instance = buildInstance();
      const instanceAfterAction = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'APPROVED' }],
      });
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterAction.actions);
      repo.findInstanceById.mockResolvedValue({ ...instance, status: 'APPROVED', actions: instanceAfterAction.actions });

      await service.submitDecision('instance-1', 'user-approver', 'APPROVED');

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'instance-1' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'workflow.approved',
            payload: expect.objectContaining({ userId: 'user-requester' }),
          }),
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'user-requester',
        'workflow:resolved',
        expect.objectContaining({ outcome: 'APPROVED' }),
      );
    });

    it('should resolve workflow as REJECTED immediately on rejection', async () => {
      const instance = buildInstance();
      const instanceAfterReject = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'REJECTED' }],
      });
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterReject.actions);
      repo.findInstanceById.mockResolvedValue({ ...instance, status: 'REJECTED', actions: instanceAfterReject.actions });

      await service.submitDecision('instance-1', 'user-approver', 'REJECTED');

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'instance-1' },
          data: expect.objectContaining({ status: 'REJECTED' }),
        })
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'workflow.rejected',
            payload: expect.objectContaining({ userId: 'user-requester' }),
          }),
        }),
      );
    });

    it('should allow approval from an active delegate of a designated approver', async () => {
      const instance = buildInstance();
      const instanceAfterAction = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-delegate', decision: 'APPROVED' }],
      });
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterAction.actions);
      repo.findInstanceById.mockResolvedValue({ ...instance, status: 'APPROVED', actions: instanceAfterAction.actions });

      delegationService.getActiveDelegate.mockResolvedValue('user-delegate');

      await service.submitDecision('instance-1', 'user-delegate', 'APPROVED');

      expect(delegationService.getActiveDelegate).toHaveBeenCalledWith('user-approver', 'space-1');
      expect(prisma.workflowAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorId: 'user-delegate' }),
        })
      );
    });

    it('should not resolve parallel step with requiresAll=true when only one has approved', async () => {
      const instance = buildInstance({
        definition: {
          id: 'def-1',
          name: 'Parallel Flow',
          steps: [
            {
              id: 'step-1',
              order: 0,
              name: 'Parallel Step',
              approverType: 'USER',
              approverIds: ['user-a', 'user-b'],
              approverRole: null,
              isParallel: true,
              requiresAll: true,
              timeoutHours: 24,
            },
          ],
        },
      });

      const instanceAfterAction = buildInstance({
        definition: instance.definition,
        actions: [{ stepOrder: 0, actorId: 'user-a', decision: 'APPROVED' }],
      });

      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterAction.actions);
      repo.findInstanceById.mockResolvedValue(instanceAfterAction);

      await service.submitDecision('instance-1', 'user-a', 'APPROVED');

      expect(prisma.workflowInstance.update).not.toHaveBeenCalled();
    });

    it('should resolve parallel step with requiresAll=false immediately on first approval', async () => {
      const instance = buildInstance({
        definition: {
          id: 'def-1',
          name: 'Parallel Flow',
          steps: [
            {
              id: 'step-1',
              order: 0,
              name: 'Parallel Step',
              approverType: 'USER',
              approverIds: ['user-a', 'user-b'],
              approverRole: null,
              isParallel: true,
              requiresAll: false,
              timeoutHours: 24,
            },
          ],
        },
      });

      const instanceAfterAction = buildInstance({
        definition: instance.definition,
        actions: [{ stepOrder: 0, actorId: 'user-a', decision: 'APPROVED' }],
      });

      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterAction.actions);
      repo.findInstanceById.mockResolvedValue({ ...instance, status: 'APPROVED', actions: instanceAfterAction.actions });

      await service.submitDecision('instance-1', 'user-a', 'APPROVED');

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'instance-1' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
    });

    it('should record SLA metric when a step completes', async () => {
      const stepActivatedAt = new Date(Date.now() - 2 * 3600_000).toISOString(); // 2 hours ago
      const instance = buildInstance({
        context: { _stepActivatedAt: stepActivatedAt },
      });
      const instanceAfterAction = buildInstance({
        context: { _stepActivatedAt: stepActivatedAt },
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'APPROVED' }],
      });

      repo.findInstanceByIdForUpdateTx.mockResolvedValue(instance);
      prisma.workflowAction.findMany.mockResolvedValue(instanceAfterAction.actions);
      repo.findInstanceById.mockResolvedValue({ ...instance, status: 'APPROVED', actions: instanceAfterAction.actions });

      await service.submitDecision('instance-1', 'user-approver', 'APPROVED');

      expect(prisma.slaMetric.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowInstanceId: 'instance-1',
            isViolated: false,
          }),
        })
      );
    });
  });

  // ─── cancelInstance ──────────────────────────────────────────

  describe('cancelInstance()', () => {
    it('should throw NotFoundException when instance not found', async () => {
      repo.findInstanceById.mockResolvedValue(null);

      await expect(service.cancelInstance('instance-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-requester tries to cancel', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance({ requesterId: 'user-requester' }));

      await expect(service.cancelInstance('instance-1', 'user-other')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if instance is already resolved', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance({ status: 'APPROVED' }));

      await expect(service.cancelInstance('instance-1', 'user-requester')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cancel instance and emit workflow:cancelled event', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance());
      repo.updateInstance.mockResolvedValue({ id: 'instance-1', status: 'CANCELLED' } as any);

      await service.cancelInstance('instance-1', 'user-requester');

      expect(repo.updateInstance).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({ status: 'CANCELLED' }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'user-requester',
        'workflow:cancelled',
        expect.any(Object),
      );
    });
  });

  // ─── handleStepTimeout ───────────────────────────────────────

  describe('handleStepTimeout()', () => {
    it('should do nothing when instance not found', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(null);

      await service.handleStepTimeout('instance-1', 0);

      expect(prisma.workflowInstance.update).not.toHaveBeenCalled();
    });

    it('should do nothing when instance has advanced past the timed-out step', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(buildInstance({ currentStep: 1 }));

      await service.handleStepTimeout('instance-1', 0); // Step 0 already passed

      expect(prisma.workflowInstance.update).not.toHaveBeenCalled();
    });

    it('should mark instance as TIMED_OUT and notify requester', async () => {
      repo.findInstanceByIdForUpdateTx.mockResolvedValue(buildInstance({ status: 'IN_PROGRESS', currentStep: 0 }));

      await service.handleStepTimeout('instance-1', 0);

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'instance-1' },
          data: expect.objectContaining({ status: 'TIMED_OUT' }),
        })
      );
      expect(eventBus.publish).toHaveBeenCalled();
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'workflow.timed_out',
            payload: expect.objectContaining({ userId: 'user-requester' }),
          }),
        }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'user-requester',
        'workflow:timed_out',
        expect.any(Object),
      );
    });
  });
});
