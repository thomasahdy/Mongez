import { TasksService } from './tasks.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { TaskRepository } from './task.repository';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: jest.Mocked<TaskRepository>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    taskRepo = {
      findById: jest.fn(),
      findByBoardId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    service = new TasksService(taskRepo, cache);
  });

  describe('getTaskById()', () => {
    it('UT-TASK-SVC-001: should return cached task when available', async () => {
      const mockTask = { id: 'task-1', title: 'Test Task' };
      cache.getOrSet.mockResolvedValue(mockTask);

      const result = await service.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        'task:task-1',
        expect.any(Function),
        120,
      );
    });

    it('UT-TASK-SVC-002: should fetch from DB when cache miss', async () => {
      const mockTask = { id: 'task-1', title: 'Test Task' };
      cache.getOrSet.mockImplementation(async (key, factory) => {
        return factory();
      });
      taskRepo.findById.mockResolvedValue(mockTask as any);

      const result = await service.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(taskRepo.findById).toHaveBeenCalledWith('task-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      cache.getOrSet.mockImplementation(async (key, factory) => {
        return factory();
      });
      taskRepo.findById.mockResolvedValue(null);

      await expect(service.getTaskById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBoardTasks()', () => {
    it('UT-TASK-SVC-006: should apply filters and paginate correctly', async () => {
      const mockResult = { tasks: [], total: 0, page: 1, limit: 50 };
      cache.getOrSet.mockResolvedValue(mockResult);

      const result = await service.getBoardTasks('board-1', { status: 'TODO' }, 1, 50);

      expect(result).toEqual(mockResult);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('board:board-1'),
        expect.any(Function),
        60,
      );
    });
  });

  describe('createTask()', () => {
    it('UT-TASK-SVC-003: should invalidate board cache after creation', async () => {
      const newData = { title: 'New Task', boardId: 'board-1' };
      taskRepo.create.mockResolvedValue({ id: 'task-new', ...newData } as any);

      await service.createTask(newData);

      expect(taskRepo.create).toHaveBeenCalledWith(newData);
      expect(cache.invalidateEntityType).toHaveBeenCalledWith('task');
    });
  });

  describe('updateTask()', () => {
    it('UT-TASK-SVC-004: should invalidate entity cache after update', async () => {
      const updateData = { title: 'Updated Task' };
      taskRepo.update.mockResolvedValue({ id: 'task-1', ...updateData } as any);

      await service.updateTask('task-1', updateData);

      expect(taskRepo.update).toHaveBeenCalledWith('task-1', updateData);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('task', 'task-1');
    });
  });

  describe('deleteTask()', () => {
    it('UT-TASK-SVC-005: should delete task and invalidate entity cache', async () => {
      taskRepo.delete.mockResolvedValue(undefined as any);

      await service.deleteTask('task-1');

      expect(taskRepo.delete).toHaveBeenCalledWith('task-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('task', 'task-1');
    });
  });
});