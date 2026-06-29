import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationRepository } from './repositories/notification.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { paginate } from '../../shared/dto/pagination.dto';
import { UpdateQuietHoursDto } from './dto/update-quiet-hours.dto';
import { UpdateChannelPreferenceDto } from './dto/update-channel-preference.dto';

@Injectable()
export class NotificationsService {
  private readonly COUNT_CACHE_TTL = 30;

  constructor(
    private readonly notifRepo: NotificationRepository,
    private readonly cache: CacheService,
    private readonly realtimeService: RealtimeService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {}

  async getForUser(userId: string, spaceId: string, filters: NotificationFilterDto) {
    const { data, total } = await this.notifRepo.findForUser(userId, spaceId, filters);
    return paginate(data, total, filters.page, filters.limit);
  }

  async getUnreadCount(userId: string, spaceId: string): Promise<number> {
    return this.cache.getOrSet(
      `notif:count:${userId}:${spaceId}`,
      () => this.notifRepo.countUnread(userId, spaceId),
      this.COUNT_CACHE_TTL,
    );
  }

  async markAsRead(id: string, userId: string, spaceId: string) {
    const notif = await this.notifRepo.markAsRead(id, userId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:read', { id });
    return notif;
  }

  async markAllAsRead(userId: string, spaceId: string) {
    await this.notifRepo.markAllAsRead(userId, spaceId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:read', { all: true });
  }

  async delete(id: string, userId: string, spaceId: string) {
    await this.notifRepo.delete(id, userId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:deleted', { id });
  }

  // Called by the BullMQ processor — creates notification + pushes via WebSocket
  async createAndNotify(data: Parameters<NotificationRepository['create']>[0]) {
    const notif = await this.notifRepo.create(data);
    await this.cache.del(`notif:count:${data.userId}:${data.spaceId}`);
    // Push new notification to user's private room
    this.realtimeService.emitToUser(data.userId, 'notification:new', notif);
    await this.pushCountUpdate(data.userId, data.spaceId);
    return notif;
  }

  private async pushCountUpdate(userId: string, spaceId: string) {
    const count = await this.notifRepo.countUnread(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:count', { unread: count, spaceId });
  }

  async queueNotification(data: {
    userId: string;
    spaceId: string;
    type: string;
    channel: 'IN_APP' | 'PUSH' | 'EMAIL';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
  }) {
    await this.notificationQueue.add(JOB_NAMES.SEND_NOTIFICATION, data);
  }

  async getSettings(userId: string) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          preferences: {},
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '07:00',
            weekendNotifications: false,
          },
        },
      });
    }

    const userPrefs = (pref.preferences as Record<string, any>) || {};
    const quietHours = (pref.quietHours as Record<string, any>) || {
      enabled: false,
      startTime: '22:00',
      endTime: '07:00',
      weekendNotifications: false,
    };

    const eventTypes = [
      { id: 'TASK_ASSIGNED', label: 'Task Assigned', default: { inApp: true, email: true, whatsapp: true, telegram: true } },
      { id: 'TASK_DUE', label: 'Task Due', default: { inApp: true, email: true, whatsapp: true, telegram: true } },
      { id: 'TASK_UPDATED', label: 'Task Updated', default: { inApp: true, email: false, whatsapp: false, telegram: false } },
      { id: 'APPROVAL_REQUESTED', label: 'Approval Requested', default: { inApp: true, email: true, whatsapp: true, telegram: true } },
      { id: 'APPROVAL_RESOLVED', label: 'Approval Resolved', default: { inApp: true, email: true, whatsapp: true, telegram: true } },
      { id: 'COMMENT_MENTION', label: 'Comment Mention', default: { inApp: true, email: false, whatsapp: false, telegram: false } },
      { id: 'FILE_UPLOADED', label: 'File Uploaded', default: { inApp: true, email: false, whatsapp: false, telegram: false } },
      { id: 'AI_INSIGHT', label: 'AI Insight', default: { inApp: true, email: false, whatsapp: false, telegram: false } },
      { id: 'WORKFLOW_APPROVAL_REQUEST', label: 'Workflow Approval Request', default: { inApp: true, email: true, whatsapp: true, telegram: true } },
      { id: 'SYSTEM', label: 'System Alert', default: { inApp: true, email: true, whatsapp: false, telegram: false } },
    ];

    const channels = eventTypes.map((et) => {
      const saved = userPrefs[et.id] || {};
      return {
        id: et.id,
        label: et.label,
        inApp: saved.inApp ?? et.default.inApp,
        email: saved.email ?? et.default.email,
        whatsapp: saved.whatsapp ?? et.default.whatsapp,
        telegram: saved.telegram ?? et.default.telegram,
      };
    });

    return {
      channels,
      quietHours,
    };
  }

  async updateChannel(userId: string, eventType: string, dto: UpdateChannelPreferenceDto) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          preferences: {},
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '07:00',
            weekendNotifications: false,
          },
        },
      });
    }

    const preferences = (pref.preferences as Record<string, any>) || {};
    if (!preferences[eventType]) {
      preferences[eventType] = {};
    }
    preferences[eventType][dto.channel] = dto.enabled;

    return this.prisma.notificationPreference.update({
      where: { userId },
      data: { preferences },
    });
  }

  async updateQuietHours(userId: string, dto: UpdateQuietHoursDto) {
    // Ensure entry exists using upsert structure
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferences: {},
        quietHours: {
          enabled: dto.enabled,
          startTime: dto.startTime,
          endTime: dto.endTime,
          weekendNotifications: dto.weekendNotifications,
        },
      },
      update: {
        quietHours: {
          enabled: dto.enabled,
          startTime: dto.startTime,
          endTime: dto.endTime,
          weekendNotifications: dto.weekendNotifications,
        },
      },
    });
  }

  async resetSettings(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferences: {},
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          weekendNotifications: false,
        },
      },
      update: {
        preferences: {},
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          weekendNotifications: false,
        },
      },
    });
  }
}