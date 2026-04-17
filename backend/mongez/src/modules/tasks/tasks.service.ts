import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { TaskRepository } from './task.repository';

@Injectable()
export class TasksService {
  private readonly CACHE_PREFIX = 'task';
  private readonly CACHE_TTL = 120; // 2 minutes
  private readonly BOARD_CACHE_TTL = 60; // 1 minute

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly cache: CacheService,
  ) {}

  async getTaskById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}`,
      async () => {
        const task = await this.taskRepo.findById(id);
        if (!task) throw new NotFoundException('Task not found');
        return task;
      },
      this.CACHE_TTL,
    );
  }

  async getBoardTasks(boardId: string, filters?: any, page = 1, limit = 50) {
    return this.cache.getOrSet(
      `board:${boardId}:tasks:${JSON.stringify(filters)}:${page}:${limit}`,
      () => this.taskRepo.findByBoardId(boardId, filters, page, limit),
      this.BOARD_CACHE_TTL,
    );
  }

  async createTask(data: any) {
    const task = await this.taskRepo.create(data);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return task;
  }

  async updateTask(id: string, data: any) {
    const task = await this.taskRepo.update(id, data);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return task;
  }

  async deleteTask(id: string) {
    await this.taskRepo.delete(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }
}