import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let service: jest.Mocked<WorkflowService>;

  const mockUser = { userId: 'user-1' };
  const mockRequest = { user: mockUser } as any;

  beforeEach(async () => {
    service = {
      listDefinitions: jest.fn(),
      createDefinition: jest.fn(),
      updateDefinition: jest.fn(),
      startWorkflow: jest.fn(),
      getPendingForReviewer: jest.fn(),
      getMyRequests: jest.fn(),
      getInstanceHistory: jest.fn(),
      submitDecision: jest.fn(),
      cancelInstance: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        { provide: WorkflowService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkflowController>(WorkflowController);
  });

  describe('listDefinitions()', () => {
    it('UT-WORKFLOW-CTRL-001: should list available definitions for space', async () => {
      service.listDefinitions.mockResolvedValue([{ id: 'def-1' }] as any);

      const result = await controller.listDefinitions('space-1');

      expect(service.listDefinitions).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('createDefinition()', () => {
    it('UT-WORKFLOW-CTRL-002: should create a new workflow definition', async () => {
      const dto = { spaceId: 'space-1', name: 'Approve Budget' } as any;
      service.createDefinition.mockResolvedValue({ id: 'def-1', ...dto });

      const result = await controller.createDefinition(mockRequest, dto);

      expect(service.createDefinition).toHaveBeenCalledWith('space-1', 'user-1', dto);
      expect(result.id).toBe('def-1');
    });
  });

  describe('updateDefinition()', () => {
    it('UT-WORKFLOW-CTRL-003: should update workflow definition status', async () => {
      const body = { isActive: false };
      service.updateDefinition.mockResolvedValue({ id: 'def-1', isActive: false } as any);

      const result = await controller.updateDefinition('def-1', body);

      expect(service.updateDefinition).toHaveBeenCalledWith('def-1', body);
      expect(result.isActive).toBe(false);
    });
  });

  describe('startWorkflow()', () => {
    it('UT-WORKFLOW-CTRL-004: should start a workflow instance', async () => {
      const dto = { definitionId: 'def-1', spaceId: 'space-1', entityType: 'task', entityId: 'task-1' };
      service.startWorkflow.mockResolvedValue({ id: 'instance-1' } as any);

      const result = await controller.startWorkflow(mockRequest, dto);

      expect(service.startWorkflow).toHaveBeenCalledWith('user-1', dto);
      expect(result.id).toBe('instance-1');
    });
  });

  describe('getPending()', () => {
    it('UT-WORKFLOW-CTRL-005: should get pending workflows for reviewer', async () => {
      const filters = { page: 1, limit: 10 } as any;
      service.getPendingForReviewer.mockResolvedValue({ data: [], meta: {} } as any);

      const result = await controller.getPending(mockRequest, 'space-1', filters);

      expect(service.getPendingForReviewer).toHaveBeenCalledWith('user-1', 'space-1', filters);
      expect(result.data).toBeDefined();
    });
  });

  describe('getMyRequests()', () => {
    it('UT-WORKFLOW-CTRL-006: should get my requests', async () => {
      const filters = { page: 1, limit: 10 } as any;
      service.getMyRequests.mockResolvedValue({ data: [], meta: {} } as any);

      const result = await controller.getMyRequests(mockRequest, 'space-1', filters);

      expect(service.getMyRequests).toHaveBeenCalledWith('user-1', 'space-1', filters);
      expect(result.data).toBeDefined();
    });
  });

  describe('getInstance()', () => {
    it('UT-WORKFLOW-CTRL-007: should fetch history log of workflow instance', async () => {
      service.getInstanceHistory.mockResolvedValue({ id: 'instance-1' } as any);

      const result = await controller.getInstance('instance-1');

      expect(service.getInstanceHistory).toHaveBeenCalledWith('instance-1');
      expect(result.id).toBe('instance-1');
    });
  });

  describe('approve()', () => {
    it('UT-WORKFLOW-CTRL-008: should submit an APPROVED decision', async () => {
      const dto = { note: 'Looks good' };
      service.submitDecision.mockResolvedValue({ id: 'instance-1', status: 'APPROVED' } as any);

      const result = await controller.approve(mockRequest, 'instance-1', dto);

      expect(service.submitDecision).toHaveBeenCalledWith('instance-1', 'user-1', 'APPROVED', 'Looks good');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('reject()', () => {
    it('UT-WORKFLOW-CTRL-009: should submit a REJECTED decision', async () => {
      const dto = { note: 'Needs edits' };
      service.submitDecision.mockResolvedValue({ id: 'instance-1', status: 'REJECTED' } as any);

      const result = await controller.reject(mockRequest, 'instance-1', dto);

      expect(service.submitDecision).toHaveBeenCalledWith('instance-1', 'user-1', 'REJECTED', 'Needs edits');
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('cancel()', () => {
    it('UT-WORKFLOW-CTRL-010: should cancel a workflow instance', async () => {
      service.cancelInstance.mockResolvedValue({ id: 'instance-1', status: 'CANCELLED' } as any);

      await controller.cancel(mockRequest, 'instance-1');

      expect(service.cancelInstance).toHaveBeenCalledWith('instance-1', 'user-1');
    });
  });
});
