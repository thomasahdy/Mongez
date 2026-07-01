import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskRepository, CommentRepository, TimeLogRepository } from './repositories/tasks.repositories';
import { TrashService } from '../trash/trash.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdentifierService } from '../../shared/services/identifier.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { EventBus } from '@nestjs/cqrs';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from './events/task-events';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly commentRepo: CommentRepository,
    private readonly timeLogRepo: TimeLogRepository,
    private readonly cache: CacheService,
    private readonly notificationsService: NotificationsService,
    private readonly identifierService: IdentifierService,
    private readonly eventBus: EventBus,
    private readonly trashService: TrashService,
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
  ) {}

  /**
   * Invalidate all AI caches for a space when task data changes.
   * Fire-and-forget to avoid adding latency to task operations.
   */
  private invalidateAiCache(spaceId: string): void {
    Promise.all([
      this.cache.delPattern(`ai:chat:${spaceId}:*`),
      this.cache.delPattern(`ai:risk:${spaceId}:*`),
    ]).catch((err) =>
      this.logger.error(`Failed to invalidate AI cache for space ${spaceId}: ${err.message}`),
    );
  }

  async getTaskById(id: string) {
    const task = await this.taskRepo.findById(id);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getMyWorkTasks(userId: string) {
    return this.taskRepo.findMyWork(userId);
  }

  async getBoardTasks(boardId: string, filters: FilterTasksDto) {
    return this.taskRepo.findByBoard(boardId, filters);
  }

  async createTask(dto: CreateTaskDto, userId: string, spaceId?: string, spacePrefix?: string) {
    // If spaceId/spacePrefix not in body, derive from the board's space
    if (!spaceId || !spacePrefix) {
      const board = await this.taskRepo['prisma'].board.findUnique({
        where: { id: dto.boardId },
        include: { department: { include: { space: { select: { id: true, prefix: true } } } } },
      });
      if (!board?.department?.space) {
        throw new Error(`Board ${dto.boardId} not found or has no associated space`);
      }
      spaceId = spaceId ?? board.department.space.id;
      spacePrefix = spacePrefix ?? board.department.space.prefix;
    }

    const task = await this.taskRepo.create(dto, spaceId, spacePrefix, this.identifierService, userId);

    await this.aiQueue.add(
      JOB_NAMES.AI_INDEX_DOCUMENT,
      { spaceId, taskId: task.id },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
    
    // Publish Domain Event
    this.eventBus.publish(new TaskCreatedEvent(task));
    
    // Invalidate board cache
    await this.cache.invalidateEntity('board', task.boardId);

    this.invalidateAiCache(spaceId);
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto, userId: string, spaceId?: string) {
    const task = await this.taskRepo.update(id, dto, userId);

    const resolvedSpaceId = spaceId || (task as any).board?.department?.spaceId;

    if (dto.status === 'BLOCKED' && resolvedSpaceId) {
      await this.aiQueue.add(
        JOB_NAMES.AI_RISK_SCAN,
        { spaceId: resolvedSpaceId, taskId: task.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );
    }

    // Publish Domain Event
    this.eventBus.publish(new TaskUpdatedEvent(id, dto, task.boardId, userId));

    // Invalidate board cache
    await this.cache.invalidateEntity('board', task.boardId);

    if (spaceId) {
      this.invalidateAiCache(spaceId);
    }
    return task;
  }

  async moveTask(id: string, dto: MoveTaskDto, userId: string, spaceId?: string) {
    const task = await this.taskRepo.move(id, dto);

    // Publish Domain Event
    this.eventBus.publish(new TaskMovedEvent(id, dto.columnId, dto.position, task.boardId, userId));

    // Invalidate board cache
    await this.cache.invalidateEntity('board', task.boardId);

    if (spaceId) {
      this.invalidateAiCache(spaceId);
    }
    return task;
  }

  async softDeleteTask(id: string, userId: string, spaceId?: string) {
    const task = await this.taskRepo.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    await this.trashService.softDeleteTask(id, userId);

    // Publish Domain Event
    this.eventBus.publish(new TaskArchivedEvent(id, task.boardId, userId));

    // Invalidate board cache
    await this.cache.invalidateEntity('board', task.boardId);

    if (spaceId) {
      this.invalidateAiCache(spaceId);
    }
  }

  async addComment(taskId: string, dto: CreateCommentDto, authorId: string, spaceId: string) {
    const { comment } = await this.commentRepo.create(taskId, authorId, dto.content, spaceId);

    // Publish Domain Event
    this.eventBus.publish(new CommentAddedEvent(comment, spaceId));

    return comment;
  }

  async getComments(taskId: string, page: number, limit: number) {
    return this.commentRepo.findByTask(taskId, page, limit);
  }

  async updateComment(commentId: string, dto: UpdateCommentDto, authorId: string) {
    return this.commentRepo.update(commentId, authorId, dto.content);
  }

  async deleteComment(commentId: string, authorId: string) {
    return this.commentRepo.softDelete(commentId, authorId);
  }

  async logTime(taskId: string, dto: LogTimeDto, userId: string) {
    return this.timeLogRepo.logTime(taskId, userId, dto.hours, dto.description, dto.date);
  }

  async getTimeLogs(taskId: string) {
    return this.timeLogRepo.findByTask(taskId);
  }

  async search(query: string, spaceId: string, skip: number, limit: number) {
    return this.taskRepo.search(query, spaceId, skip, limit);
  }
}