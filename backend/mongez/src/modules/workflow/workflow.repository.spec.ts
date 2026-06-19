import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowRepository } from './workflow.repository';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('WorkflowRepository', () => {
  let repository: WorkflowRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      workflowDefinition: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      workflowStep: {
        create: jest.fn(),
      },
      workflowInstance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      workflowAction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<WorkflowRepository>(WorkflowRepository);
  });

  describe('findDefinitions()', () => {
    it('UT-WORKFLOW-REPO-001: should query active definitions for a space', async () => {
      prisma.workflowDefinition.findMany.mockResolvedValue([{ id: 'def-1' }] as any);

      const result = await repository.findDefinitions('space-1');

      expect(prisma.workflowDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { spaceId: 'space-1', isActive: true } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createDefinition()', () => {
    it('UT-WORKFLOW-REPO-002: should transactionally create a definition and steps', async () => {
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          workflowDefinition: {
            create: jest.fn().mockResolvedValue({ id: 'def-1' }),
            findUnique: jest.fn().mockResolvedValue({ id: 'def-1', name: 'Flow' }),
          },
          workflowStep: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await repository.createDefinition('space-1', 'user-1', 'Flow', 'MANUAL', [
        { name: 'Step 1', approverType: 'USER', approverIds: ['user-1'] },
      ]);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result?.name).toBe('Flow');
    });
  });

  describe('updateDefinition()', () => {
    it('UT-WORKFLOW-REPO-003: should update definition details', async () => {
      prisma.workflowDefinition.update.mockResolvedValue({ id: 'def-1', isActive: false } as any);

      await repository.updateDefinition('def-1', { isActive: false });

      expect(prisma.workflowDefinition.update).toHaveBeenCalledWith({
        where: { id: 'def-1' },
        data: { isActive: false },
      });
    });
  });

  describe('findInstanceById()', () => {
    it('UT-WORKFLOW-REPO-004: should query instance with definition, steps, and actions', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({ id: 'instance-1' } as any);

      const result = await repository.findInstanceById('instance-1');

      expect(prisma.workflowInstance.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'instance-1' } }),
      );
      expect(result?.id).toBe('instance-1');
    });
  });

  describe('createInstance()', () => {
    it('UT-WORKFLOW-REPO-005: should create a new workflow instance', async () => {
      prisma.workflowInstance.create.mockResolvedValue({ id: 'inst-1' } as any);

      const result = await repository.createInstance({
        definitionId: 'def-1',
        spaceId: 'space-1',
        entityType: 'task',
        entityId: 'task-1',
        requesterId: 'user-1',
      });

      expect(prisma.workflowInstance.create).toHaveBeenCalled();
      expect(result.id).toBe('inst-1');
    });
  });

  describe('createAction()', () => {
    it('UT-WORKFLOW-REPO-006: should record approval action', async () => {
      prisma.workflowAction.create.mockResolvedValue({ id: 'act-1' } as any);

      await repository.createAction({
        instanceId: 'inst-1',
        stepOrder: 0,
        actorId: 'user-1',
        decision: 'APPROVED',
      });

      expect(prisma.workflowAction.create).toHaveBeenCalled();
    });
  });

  describe('findTimedOutSteps()', () => {
    it('UT-WORKFLOW-REPO-007: should filter workflow instances that have timed out', async () => {
      const pastDate = new Date(Date.now() - 5 * 3600 * 1000); // 5 hours ago
      const mockInstance = {
        id: 'inst-1',
        currentStep: 0,
        createdAt: pastDate,
        status: 'IN_PROGRESS',
        definition: {
          steps: [
            {
              order: 0,
              timeoutHours: 2, // 2h limit -> expired
            },
          ],
        },
        actions: [],
      };

      prisma.workflowInstance.findMany.mockResolvedValue([mockInstance] as any);

      const result = await repository.findTimedOutSteps();

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('inst-1');
    });

    it('UT-WORKFLOW-REPO-008: should not return instances that are within timeout period', async () => {
      const recentDate = new Date();
      const mockInstance = {
        id: 'inst-2',
        currentStep: 0,
        createdAt: recentDate,
        status: 'IN_PROGRESS',
        definition: {
          steps: [
            {
              order: 0,
              timeoutHours: 2, // 2h limit -> not expired
            },
          ],
        },
        actions: [],
      };

      prisma.workflowInstance.findMany.mockResolvedValue([mockInstance] as any);

      const result = await repository.findTimedOutSteps();

      expect(result).toHaveLength(0);
    });
  });
});
