import { Test, TestingModule } from '@nestjs/testing';
import { TaskRepository, CommentRepository, TimeLogRepository } from './tasks.repositories';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IdentifierService } from '../../../shared/services/identifier.service';

describe('Tasks Repositories', () => {
  let taskRepo: TaskRepository;
  let commentRepo: CommentRepository;
  let timeLogRepo: TimeLogRepository;
  let prisma: jest.Mocked<PrismaService>;
  let identifierService: jest.Mocked<IdentifierService>;

  beforeEach(async () => {
    identifierService = {
      nextIdentifier: jest.fn().mockResolvedValue('TSK-101'),
    } as any;

    prisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      comment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      timeLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      taskJournal: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRepository,
        CommentRepository,
        TimeLogRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    taskRepo = module.get<TaskRepository>(TaskRepository);
    commentRepo = module.get<CommentRepository>(CommentRepository);
    timeLogRepo = module.get<TimeLogRepository>(TimeLogRepository);
  });

  describe('TaskRepository', () => {
    it('UT-TASK-REPO-001: should query unique task details', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1' } as any);

      const result = await taskRepo.findById('task-1');

      expect(prisma.task.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'task-1' } }),
      );
      expect(result?.id).toBe('task-1');
    });

    it('UT-TASK-REPO-002: should list tasks by board with filter values', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 'task-1' }] as any);
      prisma.task.count.mockResolvedValue(1);

      const result = await taskRepo.findByBoard('board-1', {
        page: 2,
        limit: 10,
        status: ['TODO'],
        priority: ['HIGH'],
      } as any);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            boardId: 'board-1',
            status: { in: ['TODO'] },
            priority: { in: ['HIGH'] },
          }),
          skip: 10,
          take: 10,
        }),
      );
      expect(result.total).toBe(1);
    });

    it('UT-TASK-REPO-003: should transactionally create a task with assignments and outbox events', async () => {
      const dto = { title: 'New Task', boardId: 'b-1', columnId: 'col-1', assigneeIds: ['user-2'] } as any;
      const mockTask = { id: 'task-1', title: 'New Task' };

      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          task: {
            findFirst: jest.fn().mockResolvedValue({ position: 2 }),
            create: jest.fn().mockResolvedValue(mockTask),
          },
          taskAssignment: {
            createMany: jest.fn().mockResolvedValue(undefined),
          },
          taskJournal: {
            create: jest.fn().mockResolvedValue(undefined),
          },
          outboxEvent: {
            create: jest.fn().mockResolvedValue(undefined),
          },
        };
        return cb(tx);
      });

      const result = await taskRepo.create(dto, 'space-1', 'TSK', identifierService, 'creator-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });
  });

  describe('CommentRepository', () => {
    it('UT-COMMENT-REPO-001: should fetch comment list and counts', async () => {
      prisma.comment.findMany.mockResolvedValue([{ id: 'comment-1' }] as any);
      prisma.comment.count.mockResolvedValue(1);

      const result = await commentRepo.findByTask('task-1', 1, 10);

      expect(prisma.comment.findMany).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('UT-COMMENT-REPO-002: should create a comment and process mentions inside Prisma transaction', async () => {
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          comment: {
            create: jest.fn().mockResolvedValue({ id: 'c-1', content: 'hello @[User 2](user-2)' }),
          },
          mention: {
            createMany: jest.fn().mockResolvedValue(undefined),
          },
        };
        return cb(tx);
      });

      const result = await commentRepo.create('task-1', 'author-1', 'hello @[User 2](user-2)');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.comment.id).toBe('c-1');
      expect(result.mentionedUserIds).toContain('user-2');
    });

    it('UT-COMMENT-REPO-003: should soft delete comment check author matching', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c-1', authorId: 'author-1' } as any);
      prisma.comment.update.mockResolvedValue({ id: 'c-1', deletedAt: new Date() } as any);

      await commentRepo.softDelete('c-1', 'author-1');

      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('TimeLogRepository', () => {
    it('UT-TIMELOG-REPO-001: should log hours', async () => {
      prisma.timeLog.create.mockResolvedValue({ id: 'log-1' } as any);

      await timeLogRepo.logTime('task-1', 'user-1', 4, 'note');

      expect(prisma.timeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: 'task-1',
          userId: 'user-1',
          hours: 4,
          note: 'note',
        }),
      });
    });
  });
});
