import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskRepository, CommentRepository, TimeLogRepository } from './repositories/tasks.repositories';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
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

@Injectable()
export class TasksService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly commentRepo: CommentRepository,
    private readonly timeLogRepo: TimeLogRepository,
    private readonly cache: CacheService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationsService: NotificationsService,
    private readonly identifierService: IdentifierService,
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
  ) {}

  async getTaskById(id: string) {
    const task = await this.taskRepo.findById(id);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getBoardTasks(boardId: string, filters: FilterTasksDto) {
    return this.taskRepo.findByBoard(boardId, filters);
  }

  async createTask(dto: CreateTaskDto, userId: string, spaceId: string, spacePrefix: string) {
    const task = await this.taskRepo.create(dto, spaceId, spacePrefix, this.identifierService, userId);

    // Notifications are now handled securely by the Transactional Outbox inside taskRepo.create()

    await this.aiQueue.add(JOB_NAMES.AI_INDEX_DOCUMENT, { spaceId, taskId: task.id });
    this.realtimeService.emitToBoard(dto.boardId, 'task:created', task);
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto, userId: string) {
    const task = await this.taskRepo.update(id, dto, userId);

    if (dto.status === 'BLOCKED') {
      await this.aiQueue.add(JOB_NAMES.AI_RISK_SCAN, { taskId: task.id });
    }

    this.realtimeService.emitToBoard(task.boardId, 'task:updated', { id, changes: dto });
    return task;
  }

  async moveTask(id: string, dto: MoveTaskDto) {
    const task = await this.taskRepo.move(id, dto);
    this.realtimeService.emitToBoard(task.boardId, 'task:moved', { id, columnId: dto.columnId, position: dto.position });
    return task;
  }

  async archiveTask(id: string) {
    const task = await this.taskRepo.archive(id);
    this.realtimeService.emitToBoard(task.boardId, 'task:archived', { id });
  }

  async addComment(taskId: string, dto: CreateCommentDto, authorId: string, spaceId: string) {
    const { comment, mentionedUserIds } = await this.commentRepo.create(taskId, authorId, dto.content);

    if (mentionedUserIds.length) {
      // should ideally queue a BULK_NOTIFY
      for (const userId of mentionedUserIds) {
        await this.notificationsService.queueNotification({
          userId,
          spaceId,
          type: 'COMMENT_MENTION',
          channel: 'IN_APP',
          title: 'You were mentioned',
          body: `You were mentioned in a comment on a task`,
          entityType: 'task',
          entityId: taskId,
        });
      }
    }

    this.realtimeService.emitToSpace(spaceId, 'comment:added', comment);
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