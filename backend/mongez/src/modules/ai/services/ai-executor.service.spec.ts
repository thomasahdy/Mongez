import { Test, TestingModule } from '@nestjs/testing';
import { AIExecutorService } from './ai-executor.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { TaskStatus } from '@prisma/client';
import { WorkflowService } from '../../workflow/workflow.service';

describe('AIExecutorService', () => {
  let service: AIExecutorService;
  let prismaService: PrismaService;
  let tasksService: TasksService;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let workflowService: WorkflowService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    aIProposedAction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskAssignment: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskJournal: {
      create: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
  };

  const mockTasksService = {
    createTask: jest.fn(),
  };

  const mockNotificationsService = {
    queueNotification: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockWorkflowService = {
    startWorkflow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIExecutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TasksService, useValue: mockTasksService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: WorkflowService, useValue: mockWorkflowService },
      ],
    }).compile();

    service = module.get<AIExecutorService>(AIExecutorService);
    prismaService = module.get<PrismaService>(PrismaService);
    tasksService = module.get<TasksService>(TasksService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute task status update successfully', async () => {
    const action = {
      id: 'action-1',
      spaceId: 'space-1',
      commandType: 'UpdateTask',
      status: 'PENDING',
      payload: {
        taskId: 'task-1',
        newStatus: 'IN_PROGRESS',
      },
    };

    mockPrisma.aIProposedAction.findUnique.mockResolvedValue(action);
    mockPrisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: 'TODO' });
    mockPrisma.task.update.mockResolvedValue({ id: 'task-1', status: 'IN_PROGRESS' });

    const result = await service.execute('action-1', 'reviewer-1');

    expect(result.success).toBe(true);
    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'IN_PROGRESS' },
    });
    expect(mockPrisma.taskJournal.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-1',
        changes: { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
        userId: 'reviewer-1',
      },
    });
    expect(mockPrisma.aIProposedAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        executedBy: 'reviewer-1',
        executionStatus: 'SUCCESS',
      }),
    });
    expect(auditService.log).toHaveBeenCalled();
  });

  it('should execute task reassignment successfully', async () => {
    const action = {
      id: 'action-2',
      spaceId: 'space-1',
      commandType: 'AssignTask',
      status: 'PENDING',
      payload: {
        taskId: 'task-1',
        newAssigneeId: 'assignee-2',
      },
    };

    mockPrisma.aIProposedAction.findUnique.mockResolvedValue(action);
    mockPrisma.taskAssignment.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.taskAssignment.create.mockResolvedValue({ taskId: 'task-1', userId: 'assignee-2' });

    const result = await service.execute('action-2', 'reviewer-1');

    expect(result.success).toBe(true);
    expect(mockPrisma.taskAssignment.deleteMany).toHaveBeenCalledWith({
      where: { taskId: 'task-1' },
    });
    expect(mockPrisma.taskAssignment.create).toHaveBeenCalledWith({
      data: { taskId: 'task-1', userId: 'assignee-2' },
    });
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
  });

  it('should execute escalation successfully', async () => {
    const action = {
      id: 'action-3',
      spaceId: 'space-1',
      commandType: 'EscalateTask',
      status: 'PENDING',
      payload: {
        managerId: 'manager-1',
        taskId: 'task-1',
        taskTitle: 'Critical Bug',
        reason: 'Blocked by dependency',
      },
    };

    mockPrisma.aIProposedAction.findUnique.mockResolvedValue(action);

    const result = await service.execute('action-3', 'reviewer-1');

    expect(result.success).toBe(true);
    expect(notificationsService.queueNotification).toHaveBeenCalledWith({
      userId: 'manager-1',
      spaceId: 'space-1',
      type: 'AI_ESCALATION',
      channel: 'IN_APP',
      priority: 'HIGH',
      title: 'Escalation: Critical Bug',
      body: 'Blocked by dependency',
      entityType: 'task',
      entityId: 'task-1',
    });
  });

  it('should execute reminders successfully', async () => {
    const action = {
      id: 'action-4',
      spaceId: 'space-1',
      commandType: 'CreateReminder',
      status: 'PENDING',
      payload: {
        recipientIds: ['user-1', 'user-2'],
        title: 'Review required',
        body: 'Please review task',
        taskId: 'task-1',
      },
    };

    mockPrisma.aIProposedAction.findUnique.mockResolvedValue(action);

    const result = await service.execute('action-4', 'reviewer-1');

    expect(result.success).toBe(true);
    expect(notificationsService.queueNotification).toHaveBeenCalledTimes(2);
  });
});
