import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskAccessGuard } from './guards/task-access.guard';
import { BoardAccessGuard } from '../boards/guards/board-access.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

describe('TasksController', () => {
  let controller: TasksController;
  let service: jest.Mocked<TasksService>;

  const mockUser = { userId: 'user-1' };
  const mockRequest = {
    user: mockUser,
    taskSpaceId: 'space-1',
  } as any;

  beforeEach(async () => {
    service = {
      createTask: jest.fn(),
      getBoardTasks: jest.fn(),
      search: jest.fn(),
      getTaskById: jest.fn(),
      updateTask: jest.fn(),
      moveTask: jest.fn(),
      softDeleteTask: jest.fn(),
      archiveTask: jest.fn(),
      addComment: jest.fn(),
      getComments: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      logTime: jest.fn(),
      getTimeLogs: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TaskAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BoardAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SpaceMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  describe('create()', () => {
    it('UT-TASK-CTRL-001: should delegate task creation to service with correct params', async () => {
      const dto = { title: 'New Task', spaceId: 'space-1', spacePrefix: 'MON' } as any;
      service.createTask.mockResolvedValue({ id: 'task-1', ...dto });

      const result = await controller.create(mockRequest, dto);

      expect(service.createTask).toHaveBeenCalledWith(dto, 'user-1', 'space-1', 'MON');
      expect(result.id).toBe('task-1');
    });
  });

  describe('getByBoard()', () => {
    it('UT-TASK-CTRL-002: should return paginated list of board tasks', async () => {
      const filters = { page: 1, limit: 10 } as any;
      service.getBoardTasks.mockResolvedValue({ data: [{ id: 'task-1' }], total: 1 } as any);

      const result = await controller.getByBoard('board-1', filters);

      expect(service.getBoardTasks).toHaveBeenCalledWith('board-1', filters);
      expect(result).toEqual({
        data: [{ id: 'task-1' }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });
  });

  describe('search()', () => {
    it('UT-TASK-CTRL-003: should perform full-text search with offset calculations', async () => {
      const pagination = { page: 2, limit: 15 };
      service.search.mockResolvedValue({ data: [{ id: 'task-1' }], total: 30 } as any);

      const result = await controller.search('query-term', 'space-1', pagination);

      expect(service.search).toHaveBeenCalledWith('query-term', 'space-1', 15, 15);
      expect(result).toEqual({
        data: [{ id: 'task-1' }],
        meta: {
          page: 2,
          limit: 15,
          total: 30,
          totalPages: 2,
        },
      });
    });
  });

  describe('getById()', () => {
    it('UT-TASK-CTRL-004: should fetch individual task details', async () => {
      service.getTaskById.mockResolvedValue({ id: 'task-1', title: 'Task' } as any);

      const result = await controller.getById('task-1');

      expect(service.getTaskById).toHaveBeenCalledWith('task-1');
      expect(result.id).toBe('task-1');
    });
  });

  describe('update()', () => {
    it('UT-TASK-CTRL-005: should perform partial update on task details', async () => {
      const dto = { title: 'Updated Task' };
      service.updateTask.mockResolvedValue({ id: 'task-1', title: 'Updated Task' } as any);

      const result = await controller.update(mockRequest, 'task-1', dto);

      expect(service.updateTask).toHaveBeenCalledWith('task-1', dto, 'user-1', 'space-1');
      expect(result.title).toBe('Updated Task');
    });
  });

  describe('move()', () => {
    it('UT-TASK-CTRL-006: should move task within column or board', async () => {
      const dto = { columnId: 'col-2', position: 1 } as any;
      service.moveTask.mockResolvedValue({ id: 'task-1', columnId: 'col-2' } as any);

      const result = await controller.move(mockRequest, 'task-1', dto);

      expect(service.moveTask).toHaveBeenCalledWith('task-1', dto, 'user-1', 'space-1');
      expect(result.columnId).toBe('col-2');
    });
  });

  describe('archive()', () => {
    it('UT-TASK-CTRL-007: should archive/delete a task', async () => {
      service.softDeleteTask.mockResolvedValue(undefined);

      await controller.archive(mockRequest, 'task-1');

      expect(service.softDeleteTask).toHaveBeenCalledWith('task-1', 'user-1', 'space-1');
    });
  });

  describe('comments', () => {
    it('UT-TASK-CTRL-008: should add comment to a task', async () => {
      const dto = { content: 'My comment' };
      service.addComment.mockResolvedValue({ id: 'comment-1', content: 'My comment' } as any);

      const result = await controller.addComment(mockRequest, 'task-1', dto);

      expect(service.addComment).toHaveBeenCalledWith('task-1', dto, 'user-1', 'space-1');
      expect(result.id).toBe('comment-1');
    });

    it('UT-TASK-CTRL-009: should return paginated list of task comments', async () => {
      const pagination = { page: 1, limit: 5 };
      service.getComments.mockResolvedValue({ data: [{ id: 'comment-1' }], total: 1 } as any);

      const result = await controller.getComments('task-1', pagination);

      expect(service.getComments).toHaveBeenCalledWith('task-1', 1, 5);
      expect(result).toEqual({
        data: [{ id: 'comment-1' }],
        meta: {
          page: 1,
          limit: 5,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('UT-TASK-CTRL-010: should update own comment content', async () => {
      const dto = { content: 'Updated comment' };
      service.updateComment.mockResolvedValue({ id: 'comment-1', content: 'Updated comment' } as any);

      const result = await controller.updateComment(mockRequest, 'comment-1', dto);

      expect(service.updateComment).toHaveBeenCalledWith('comment-1', dto, 'user-1');
      expect(result.content).toBe('Updated comment');
    });

    it('UT-TASK-CTRL-011: should delete own comment', async () => {
      service.deleteComment.mockResolvedValue(undefined);

      await controller.deleteComment(mockRequest, 'comment-1');

      expect(service.deleteComment).toHaveBeenCalledWith('comment-1', 'user-1');
    });
  });

  describe('time logging', () => {
    it('UT-TASK-CTRL-012: should log time on a task', async () => {
      const dto = { minutesLogged: 60 } as any;
      service.logTime.mockResolvedValue({ id: 'log-1', minutesLogged: 60 } as any);

      const result = await controller.logTime(mockRequest, 'task-1', dto);

      expect(service.logTime).toHaveBeenCalledWith('task-1', dto, 'user-1');
      expect(result.minutesLogged).toBe(60);
    });

    it('UT-TASK-CTRL-013: should fetch logged time list for a task', async () => {
      service.getTimeLogs.mockResolvedValue([{ id: 'log-1', minutesLogged: 60 }] as any);

      const result = await controller.getTimeLogs('task-1');

      expect(service.getTimeLogs).toHaveBeenCalledWith('task-1');
      expect(result).toHaveLength(1);
    });
  });
});
