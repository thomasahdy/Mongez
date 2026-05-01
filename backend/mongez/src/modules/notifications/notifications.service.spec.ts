import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './notification.repository';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: jest.Mocked<NotificationRepository>;
  let notificationQueue: { add: jest.Mock };

  beforeEach(() => {
    notificationRepo = {
      findByUserId: jest.fn(),
      findUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      create: jest.fn(),
    } as any;

    notificationQueue = {
      add: jest.fn(),
    } as any;

    service = new NotificationsService(notificationRepo, notificationQueue as any);
  });

  describe('getUserNotifications()', () => {
    it('should return paginated notifications for user', async () => {
      const mockResult = {
        notifications: [{ id: 'notif-1', title: 'Test' }],
        total: 1,
        page: 1,
        limit: 20,
      };
      notificationRepo.findByUserId.mockResolvedValue(mockResult);

      const result = await service.getUserNotifications('user-1', 1, 20);

      expect(result).toEqual(mockResult);
      expect(notificationRepo.findByUserId).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('getUnreadCount()', () => {
    it('should return unread count', async () => {
      notificationRepo.findUnreadCount.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(notificationRepo.findUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead()', () => {
    it('UT-NOTIF-SVC-002: should mark notification as read', async () => {
      const updated = { id: 'notif-1', isRead: true };
      notificationRepo.markAsRead.mockResolvedValue(updated as any);

      const result = await service.markAsRead('notif-1');

      expect(result).toEqual(updated);
      expect(notificationRepo.markAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  describe('markAllAsRead()', () => {
    it('should mark all notifications as read for user', async () => {
      notificationRepo.markAllAsRead.mockResolvedValue({ count: 3 } as any);

      await service.markAllAsRead('user-1');

      expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('queueNotification()', () => {
    it('UT-NOTIF-SVC-001: should dispatch job to notification queue', async () => {
      const data = {
        userId: 'user-1',
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
      };

      await service.queueNotification(data);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        JOB_NAMES.SEND_NOTIFICATION,
        data,
      );
    });

    it('should dispatch job with optional entity fields', async () => {
      const data = {
        userId: 'user-1',
        type: 'TASK_UPDATED',
        title: 'Task Updated',
        message: 'Task has been updated',
        entityType: 'task',
        entityId: 'task-1',
      };

      await service.queueNotification(data);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        JOB_NAMES.SEND_NOTIFICATION,
        data,
      );
    });
  });
});