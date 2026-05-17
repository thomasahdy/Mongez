import { Controller, Get, Patch, Delete, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationFilterDto } from './dto/notification-filter.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
