import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

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

  beforeEach(() => {
    repo = {
      findDefinitions: jest.fn(),
      createDefinition: jest.fn(),
      findDefinitionById: jest.fn(),
      updateDefinition: jest.fn(),
      createInstance: jest.fn(),
      updateInstance: jest.fn(),
      findInstanceById: jest.fn(),
      createAction: jest.fn(),
      findPendingForReviewer: jest.fn(),
      findMyRequests: jest.fn(),
    } as any;

    notifications = {
      queueNotification: jest.fn(),
    } as any;

    realtime = {
      emitToUser: jest.fn(),
    } as any;

    service = new WorkflowService(repo, notifications, realtime);
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
      expect(notifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-approver', type: 'WORKFLOW_APPROVAL_REQUEST' }),
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
      repo.findInstanceById.mockResolvedValue(null);

      await expect(service.submitDecision('instance-1', 'user-1', 'APPROVED')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when workflow already resolved', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance({ status: 'APPROVED' }));

      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow('already resolved');
    });

    it('should throw ForbiddenException when actor is not an approver', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance());

      await expect(
        service.submitDecision('instance-1', 'user-not-approver', 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on duplicate decision for same actor', async () => {
      const instanceWithAction = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'APPROVED' }],
      });
      repo.findInstanceById.mockResolvedValue(instanceWithAction);

      await expect(
        service.submitDecision('instance-1', 'user-approver', 'APPROVED'),
      ).rejects.toThrow('already submitted');
    });

    it('should resolve workflow as APPROVED when last step is approved', async () => {
      const instance = buildInstance();
      const instanceAfterAction = buildInstance({
        actions: [{ stepOrder: 0, actorId: 'user-approver', decision: 'APPROVED' }],
      });
      repo.findInstanceById
        .mockResolvedValueOnce(instance)        // first call for validation
        .mockResolvedValueOnce(instanceAfterAction) // reload after createAction
        .mockResolvedValueOnce(instanceAfterAction); // final return

      repo.createAction.mockResolvedValue(undefined as any);
      repo.updateInstance.mockResolvedValue({ ...instance, status: 'APPROVED' } as any);

      await service.submitDecision('instance-1', 'user-approver', 'APPROVED');

      expect(repo.updateInstance).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({ status: 'APPROVED' }),
      );
      expect(notifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-requester', type: 'WORKFLOW_APPROVED' }),
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
      repo.findInstanceById
        .mockResolvedValueOnce(instance)
        .mockResolvedValueOnce(instanceAfterReject)
        .mockResolvedValueOnce(instanceAfterReject);

      repo.createAction.mockResolvedValue(undefined as any);
      repo.updateInstance.mockResolvedValue({ ...instance, status: 'REJECTED' } as any);

      await service.submitDecision('instance-1', 'user-approver', 'REJECTED');

      expect(repo.updateInstance).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({ status: 'REJECTED' }),
      );
      expect(notifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WORKFLOW_REJECTED' }),
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
      repo.findInstanceById.mockResolvedValue(null);

      await service.handleStepTimeout('instance-1', 0);

      expect(repo.updateInstance).not.toHaveBeenCalled();
    });

    it('should do nothing when instance has advanced past the timed-out step', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance({ currentStep: 1 }));

      await service.handleStepTimeout('instance-1', 0); // Step 0 already passed

      expect(repo.updateInstance).not.toHaveBeenCalled();
    });

    it('should mark instance as TIMED_OUT and notify requester', async () => {
      repo.findInstanceById.mockResolvedValue(buildInstance({ status: 'IN_PROGRESS', currentStep: 0 }));
      repo.updateInstance.mockResolvedValue({ id: 'instance-1', status: 'TIMED_OUT' } as any);

      await service.handleStepTimeout('instance-1', 0);

      expect(repo.updateInstance).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({ status: 'TIMED_OUT' }),
      );
      expect(notifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-requester', type: 'WORKFLOW_TIMED_OUT' }),
      );
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'user-requester',
        'workflow:timed_out',
        expect.any(Object),
      );
    });
  });
});
