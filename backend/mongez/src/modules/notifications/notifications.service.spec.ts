import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './repositories/notification.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: jest.Mocked<NotificationRepository>;
  let cache: jest.Mocked<CacheService>;
  let realtime: jest.Mocked<RealtimeService>;
  let queue: any;

  beforeEach(() => {
    notifRepo = {
      findForUser: jest.fn(),
      countUnread: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      del: jest.fn(),
    } as any;

    realtime = {
      emitToUser: jest.fn(),
    } as any;

    queue = {
      add: jest.fn(),
    };

    service = new NotificationsService(notifRepo, cache, realtime, queue);
  });

  it('should return paginated notifications', async () => {
    const result = { data: [], total: 0 };
    notifRepo.findForUser.mockResolvedValue(result);

    const res = await service.getForUser('user-1', { page: 1, limit: 20 });
    expect(res.data).toEqual([]);
    expect(notifRepo.findForUser).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 });
  });

  it('should queue notification', async () => {
    await service.queueNotification({ userId: 'u1', type: 'INFO', title: 'T', body: 'M' });
    expect(queue.add).toHaveBeenCalled();
  });
});