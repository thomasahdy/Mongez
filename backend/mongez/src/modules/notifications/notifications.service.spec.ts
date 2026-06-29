import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './repositories/notification.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Queue } from 'bullmq';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: jest.Mocked<NotificationRepository>;
  let cache: jest.Mocked<CacheService>;
  let realtime: jest.Mocked<RealtimeService>;
  let notificationQueue: jest.Mocked<Queue>;

  const mockNotif = {
    id: 'notif-1',
    userId: 'user-1',
    spaceId: 'space-1',
    type: 'TASK_ASSIGNED',
    isRead: false,
  } as any;

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

    notificationQueue = {
      add: jest.fn(),
    } as any;

    const mockPrisma = {} as any;

    service = new NotificationsService(notifRepo, cache, realtime, mockPrisma, notificationQueue);
  });

  // ─── UT-NOTIF-SVC: getForUser ───────────────────────────────

  describe('getForUser()', () => {
    it('should return paginated notifications for user', async () => {
      notifRepo.findForUser.mockResolvedValue({ data: [mockNotif], total: 1 } as any);

      const result = await service.getForUser('user-1', 'space-1', { page: 1, limit: 10 } as any);

      expect(notifRepo.findForUser).toHaveBeenCalledWith('user-1', 'space-1', { page: 1, limit: 10 });
      expect(result).toMatchObject({ data: [mockNotif] });
    });
  });

  // ─── UT-NOTIF-SVC: getUnreadCount ───────────────────────────

  describe('getUnreadCount()', () => {
    it('UT-NOTIF-SVC-001: should return cached unread count with 30s TTL', async () => {
      cache.getOrSet.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1', 'space-1');

      expect(cache.getOrSet).toHaveBeenCalledWith(
        'notif:count:user-1:space-1',
        expect.any(Function),
        30,
      );
      expect(result).toBe(5);
    });

    it('should query repository on cache miss', async () => {
      cache.getOrSet.mockImplementation(async (_key, factory) => factory());
      notifRepo.countUnread.mockResolvedValue(3);

      const result = await service.getUnreadCount('user-1', 'space-1');

      expect(notifRepo.countUnread).toHaveBeenCalledWith('user-1', 'space-1');
      expect(result).toBe(3);
    });
  });

  // ─── UT-NOTIF-SVC: markAsRead ───────────────────────────────

  describe('markAsRead()', () => {
    it('UT-NOTIF-SVC-002: should mark notification as read, clear cache, and push WebSocket update', async () => {
      notifRepo.markAsRead.mockResolvedValue({ ...mockNotif, isRead: true });
      notifRepo.countUnread.mockResolvedValue(2);

      const result = await service.markAsRead('notif-1', 'user-1', 'space-1');

      expect(notifRepo.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(cache.del).toHaveBeenCalledWith('notif:count:user-1:space-1');
      expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'notification:count', {
        unread: 2,
        spaceId: 'space-1',
      });
      expect(result.isRead).toBe(true);
    });
  });

  // ─── UT-NOTIF-SVC: markAllAsRead ────────────────────────────

  describe('markAllAsRead()', () => {
    it('should mark all notifications as read and clear cache', async () => {
      notifRepo.markAllAsRead.mockResolvedValue(undefined);
      notifRepo.countUnread.mockResolvedValue(0);

      await service.markAllAsRead('user-1', 'space-1');

      expect(notifRepo.markAllAsRead).toHaveBeenCalledWith('user-1', 'space-1');
      expect(cache.del).toHaveBeenCalledWith('notif:count:user-1:space-1');
      expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'notification:count', {
        unread: 0,
        spaceId: 'space-1',
      });
    });
  });

  // ─── UT-NOTIF-SVC: delete ───────────────────────────────────

  describe('delete()', () => {
    it('should delete notification and update unread count', async () => {
      notifRepo.delete.mockResolvedValue(undefined);
      notifRepo.countUnread.mockResolvedValue(1);

      await service.delete('notif-1', 'user-1', 'space-1');

      expect(notifRepo.delete).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(cache.del).toHaveBeenCalledWith('notif:count:user-1:space-1');
    });
  });

  // ─── UT-NOTIF-SVC: createAndNotify ──────────────────────────

  describe('createAndNotify()', () => {
    it('should create notification in DB and emit via WebSocket to user', async () => {
      const data = {
        userId: 'user-1',
        spaceId: 'space-1',
        type: 'TASK_ASSIGNED',
        channel: 'IN_APP' as any,
        priority: 'NORMAL' as any,
        title: 'New Assignment',
        body: 'You have been assigned a task',
      };
      notifRepo.create.mockResolvedValue(mockNotif);
      notifRepo.countUnread.mockResolvedValue(4);

      const result = await service.createAndNotify(data);

      expect(notifRepo.create).toHaveBeenCalledWith(data);
      expect(cache.del).toHaveBeenCalledWith('notif:count:user-1:space-1');
      expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'notification:new', mockNotif);
      expect(result).toEqual(mockNotif);
    });
  });

  // ─── UT-NOTIF-SVC-001: queueNotification ────────────────────

  describe('queueNotification()', () => {
    it('UT-NOTIF-SVC-001: should add notification job to BullMQ queue', async () => {
      notificationQueue.add.mockResolvedValue({ id: 'job-1' } as any);

      await service.queueNotification({
        userId: 'user-1',
        spaceId: 'space-1',
        type: 'COMMENT_MENTION',
        channel: 'IN_APP',
        title: 'You were mentioned',
        body: 'Mentioned in a task',
      });

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        expect.objectContaining({ userId: 'user-1', type: 'COMMENT_MENTION' }),
      );
    });
  });
});