import { TasksService } from './tasks.service';
import { TaskRepository, CommentRepository, TimeLogRepository } from './repositories/tasks.repositories';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdentifierService } from '../../shared/services/identifier.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: jest.Mocked<TaskRepository>;
  let commentRepo: jest.Mocked<CommentRepository>;
  let timeLogRepo: jest.Mocked<TimeLogRepository>;
  let cache: jest.Mocked<CacheService>;
  let realtime: jest.Mocked<RealtimeService>;
  let notif: jest.Mocked<NotificationsService>;
  let identifier: jest.Mocked<IdentifierService>;
  let queue: any;

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
      getOrSet: jest.fn(),
      del: jest.fn(),
    } as any;

    realtime = { emitToBoard: jest.fn(), emitToSpace: jest.fn(), emitToUser: jest.fn() } as any;
    notif = { queueNotification: jest.fn() } as any;
    identifier = { nextIdentifier: jest.fn() } as any;
    queue = { add: jest.fn() };

    service = new TasksService(taskRepo, commentRepo, timeLogRepo, cache, realtime, notif, identifier, queue);
  });

  it('should fetch task by id', async () => {
    taskRepo.findById.mockResolvedValue({ id: 'task-1' } as any);
    const res = await service.getTaskById('task-1');
    expect(res).toBeDefined();
  });
});