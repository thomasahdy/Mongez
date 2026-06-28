import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List user notifications' })
  async getMyNotifications(@Req() req: any, @Query() filters: NotificationFilterDto) {
    return this.notificationsService.getForUser(req.user.userId, filters.spaceId || '', filters);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@Req() req: any, @Query('spaceId') spaceId: string) {
    const count = await this.notificationsService.getUnreadCount(req.user.userId, spaceId || '');
    return { unread: count };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: any, @Query('spaceId') spaceId: string) {
    await this.notificationsService.markAllAsRead(req.user.userId, spaceId || '');
    return { success: true };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
  async markAsRead(@Req() req: any, @Param('id') id: string, @Query('spaceId') spaceId: string) {
    return this.notificationsService.markAsRead(id, req.user.userId, spaceId || '');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Req() req: any, @Param('id') id: string, @Query('spaceId') spaceId: string) {
    await this.notificationsService.delete(id, req.user.userId, spaceId || '');
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get user notification settings' })
  async getSettings(@Req() req: any) {
    const userId = req.user.userId;
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
      data: {
        channels,
        quietHours,
      },
    };
  }

  @Patch('settings/channels/:id')
  @ApiOperation({ summary: 'Update a specific notification channel preference' })
  async updateChannel(
    @Req() req: any,
    @Param('id') eventType: string,
    @Body() dto: { channel: string; enabled: boolean },
  ) {
    const userId = req.user.userId;
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

    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: { preferences },
    });

    return { data: updated };
  }

  @Patch('settings/quiet-hours')
  @ApiOperation({ summary: 'Update quiet hours preferences' })
  async updateQuietHours(@Req() req: any, @Body() quietHours: any) {
    const userId = req.user.userId;
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

    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: { quietHours },
    });

    return { data: updated };
  }

  @Post('settings/reset')
  @ApiOperation({ summary: 'Reset notification settings to defaults' })
  async resetSettings(@Req() req: any) {
    const userId = req.user.userId;
    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        preferences: {},
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          weekendNotifications: false,
        },
      },
    });

    return { data: updated };
  }
}
