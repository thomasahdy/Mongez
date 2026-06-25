import { TasksService } from './tasks.service';
import { TaskRepository, CommentRepository, TimeLogRepository } from './repositories/tasks.repositories';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdentifierService } from '../../shared/services/identifier.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { TrashService } from '../trash/trash.service';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from './events/task-events';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: jest.Mocked<TaskRepository>;
  let commentRepo: jest.Mocked<CommentRepository>;
  let timeLogRepo: jest.Mocked<TimeLogRepository>;
  let cache: jest.Mocked<CacheService>;
  let notif: jest.Mocked<NotificationsService>;
  let identifier: jest.Mocked<IdentifierService>;
  let eventBus: jest.Mocked<EventBus>;
  let trashService: jest.Mocked<TrashService>;
  let aiQueue: any;

  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    boardId: 'board-1',
    columnId: 'col-1',
    status: 'TODO',
  } as any;

  beforeEach(() => {
    taskRepo = {
      findById: jest.fn(),
      findByBoard: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      move: jest.fn(),
      archive: jest.fn(),
      search: jest.fn(),
    } as any;

    commentRepo = {
      findByTask: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as any;

    timeLogRepo = {
      logTime: jest.fn(),
      findByTask: jest.fn(),
    } as any;

    cache = {
      delPattern: jest.fn().mockResolvedValue(undefined),
    } as any;

    notif = { queueNotification: jest.fn() } as any;
    identifier = { nextIdentifier: jest.fn() } as any;
    eventBus = { publish: jest.fn() } as any;
    trashService = {
      softDeleteTask: jest.fn(),
    } as any;
    aiQueue = { add: jest.fn().mockResolvedValue(undefined) };

    service = new TasksService(
      taskRepo,
      commentRepo,
      timeLogRepo,
      cache,
      notif,
      identifier,
      eventBus,
      trashService,
      aiQueue,
    );
  });

  // ─── UT-TASK-SVC: getTaskById ────────────────────────────────

  describe('getTaskById()', () => {
    it('UT-TASK-SVC-001: should return task when found', async () => {
      taskRepo.findById.mockResolvedValue(mockTask);

      const result = await service.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(taskRepo.findById).toHaveBeenCalledWith('task-1');
    });

    it('UT-TASK-SVC-002: should throw NotFoundException when task not found', async () => {
      taskRepo.findById.mockResolvedValue(null);

      await expect(service.getTaskById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.getTaskById('non-existent')).rejects.toThrow('Task not found');
    });
  });

  // ─── UT-TASK-SVC: getBoardTasks ──────────────────────────────

  describe('getBoardTasks()', () => {
    it('UT-TASK-SVC-003: should return board tasks with filters applied', async () => {
      const filters = { page: 1, limit: 10, status: 'TODO' } as any;
      taskRepo.findByBoard.mockResolvedValue([mockTask] as any);

      const result = await service.getBoardTasks('board-1', filters);

      expect(taskRepo.findByBoard).toHaveBeenCalledWith('board-1', filters);
      expect(result).toEqual([mockTask]);
    });
  });

  // ─── UT-TASK-SVC: createTask ─────────────────────────────────

  describe('createTask()', () => {
    const createDto = { title: 'New Task', boardId: 'board-1' } as any;

    it('UT-TASK-SVC-004: should create task and publish TaskCreatedEvent', async () => {
      taskRepo.create.mockResolvedValue(mockTask);

      const result = await service.createTask(createDto, 'user-1', 'space-1', 'PROJ');

      expect(taskRepo.create).toHaveBeenCalledWith(createDto, 'space-1', 'PROJ', identifier, 'user-1');
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(TaskCreatedEvent));
      expect(aiQueue.add).toHaveBeenCalledWith(
        'ai-index-document',
        { spaceId: 'space-1', taskId: mockTask.id },
        { attempts: 5, backoff: { type: 'exponential', delay: 5000 } }
      );
      expect(result).toEqual(mockTask);
    });

    it('UT-TASK-SVC-005: should invalidate AI cache after task creation', async () => {
      taskRepo.create.mockResolvedValue(mockTask);

      await service.createTask(createDto, 'user-1', 'space-1', 'PROJ');

      // Fire-and-forget — cache invalidation is called (may complete async)
      expect(cache.delPattern).toHaveBeenCalledWith('ai:chat:space-1:*');
      expect(cache.delPattern).toHaveBeenCalledWith('ai:risk:space-1:*');
    });

    it('UT-TASK-SVC-005-a: should throw ForbiddenException if database level tenant verification fails', async () => {
      taskRepo.create.mockRejectedValue(new ForbiddenException('Tenant violation'));

      await expect(service.createTask(createDto, 'user-1', 'space-1', 'PROJ')).rejects.toThrow(ForbiddenException);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(aiQueue.add).not.toHaveBeenCalled();
    });

    it('UT-TASK-SVC-005-b: should propagate error if AI queue addition fails', async () => {
      taskRepo.create.mockResolvedValue(mockTask);
      aiQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      await expect(service.createTask(createDto, 'user-1', 'space-1', 'PROJ')).rejects.toThrow('Queue connection failed');
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ─── UT-TASK-SVC: updateTask ─────────────────────────────────

  describe('updateTask()', () => {
    it('UT-TASK-SVC-006: should update task and publish TaskUpdatedEvent', async () => {
      const updateDto = { title: 'Updated Title', status: 'IN_PROGRESS' } as any;
      taskRepo.update.mockResolvedValue(mockTask);

      const result = await service.updateTask('task-1', updateDto, 'user-1');

      expect(taskRepo.update).toHaveBeenCalledWith('task-1', updateDto, 'user-1');
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(TaskUpdatedEvent));
      expect(result).toEqual(mockTask);
    });

    it('UT-TASK-SVC-007: should queue AI risk scan when status becomes BLOCKED', async () => {
      const blockedDto = { status: 'BLOCKED' } as any;
      taskRepo.update.mockResolvedValue(mockTask);

      await service.updateTask('task-1', blockedDto, 'user-1');

      expect(aiQueue.add).toHaveBeenCalledWith(
        'ai-risk-scan',
        { taskId: mockTask.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
    });

    it('should NOT queue risk scan when status is not BLOCKED', async () => {
      const inProgressDto = { status: 'IN_PROGRESS' } as any;
      taskRepo.update.mockResolvedValue(mockTask);

      await service.updateTask('task-1', inProgressDto, 'user-1');

      expect(aiQueue.add).not.toHaveBeenCalled();
    });

    it('should invalidate AI cache when spaceId is provided', async () => {
      taskRepo.update.mockResolvedValue(mockTask);

      await service.updateTask('task-1', { title: 'X' } as any, 'user-1', 'space-1');

      expect(cache.delPattern).toHaveBeenCalledWith('ai:chat:space-1:*');
    });
  });

  // ─── UT-TASK-SVC: moveTask ───────────────────────────────────

  describe('moveTask()', () => {
    it('UT-TASK-SVC-008: should move task and publish TaskMovedEvent', async () => {
      const moveDto = { columnId: 'col-2', position: 3 } as any;
      taskRepo.move.mockResolvedValue(mockTask);

      const result = await service.moveTask('task-1', moveDto, 'user-1');

      expect(taskRepo.move).toHaveBeenCalledWith('task-1', moveDto);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(TaskMovedEvent));
      expect(result).toEqual(mockTask);
    });
  });

  // ─── UT-TASK-SVC: softDeleteTask ──────────────────────────────

  describe('softDeleteTask()', () => {
    it('UT-TASK-SVC-009: should soft delete task and publish TaskArchivedEvent', async () => {
      taskRepo.findById.mockResolvedValue(mockTask);
      trashService.softDeleteTask.mockResolvedValue(undefined as any);

      await service.softDeleteTask('task-1', 'user-1', 'space-1');

      expect(taskRepo.findById).toHaveBeenCalledWith('task-1');
      expect(trashService.softDeleteTask).toHaveBeenCalledWith('task-1', 'user-1');
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(TaskArchivedEvent));
    });
  });

  // ─── UT-TASK-SVC: addComment ─────────────────────────────────

  describe('addComment()', () => {
    const dto = { content: 'Hello @user2' } as any;

    it('UT-TASK-SVC-010: should add comment and publish CommentAddedEvent', async () => {
      const mockComment = { id: 'comment-1', content: dto.content };
      commentRepo.create.mockResolvedValue({ comment: mockComment, mentionedUserIds: [] });

      const result = await service.addComment('task-1', dto, 'user-1', 'space-1');

      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(CommentAddedEvent));
      expect(result).toEqual(mockComment);
    });

    it('UT-TASK-SVC-011: should queue notification for each mentioned user', async () => {
      const mockComment = { id: 'comment-1', content: dto.content };
      commentRepo.create.mockResolvedValue({
        comment: mockComment,
        mentionedUserIds: ['user-2', 'user-3'],
      });

      await service.addComment('task-1', dto, 'user-1', 'space-1');

      expect(notif.queueNotification).toHaveBeenCalledTimes(2);
      expect(notif.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', type: 'COMMENT_MENTION' }),
      );
      expect(notif.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-3', type: 'COMMENT_MENTION' }),
      );
    });

    it('should NOT queue notification when no users are mentioned', async () => {
      commentRepo.create.mockResolvedValue({
        comment: { id: 'comment-1', content: 'no mention' },
        mentionedUserIds: [],
      });

      await service.addComment('task-1', dto, 'user-1', 'space-1');

      expect(notif.queueNotification).not.toHaveBeenCalled();
    });
  });

  // ─── UT-TASK-SVC: getComments ────────────────────────────────

  describe('getComments()', () => {
    it('should return paginated comments', async () => {
      commentRepo.findByTask.mockResolvedValue([{ id: 'c-1' }] as any);

      const result = await service.getComments('task-1', 1, 10);

      expect(commentRepo.findByTask).toHaveBeenCalledWith('task-1', 1, 10);
      expect(result).toHaveLength(1);
    });
  });

  // ─── UT-TASK-SVC: logTime / getTimeLogs ──────────────────────

  describe('logTime()', () => {
    it('should log time to task', async () => {
      const logDto = { hours: 2, description: 'Dev work', date: new Date() } as any;
      timeLogRepo.logTime.mockResolvedValue({ id: 'log-1' } as any);

      await service.logTime('task-1', logDto, 'user-1');

      expect(timeLogRepo.logTime).toHaveBeenCalledWith('task-1', 'user-1', logDto.hours, logDto.description, logDto.date);
    });
  });

  // ─── UT-TASK-SVC: search ─────────────────────────────────────

  describe('search()', () => {
    it('UT-TASK-SVC-012: should delegate search to repository', async () => {
      taskRepo.search.mockResolvedValue([mockTask] as any);

      const result = await service.search('test query', 'space-1', 0, 20);

      expect(taskRepo.search).toHaveBeenCalledWith('test query', 'space-1', 0, 20);
      expect(result).toEqual([mockTask]);
    });
  });
});