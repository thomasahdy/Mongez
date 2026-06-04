import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../core/interfaces/notification-channel.interface';
import { Notification } from '@prisma/client';
import { BaseEvent } from '../core/contracts/event.contracts';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class WebSocketChannel implements NotificationChannel {
  private readonly logger = new Logger(WebSocketChannel.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  async send(notification: Notification, payload: BaseEvent): Promise<boolean> {
    try {
      this.logger.log(`Emitting WebSocket Notification to User ${notification.userId}`);
      // Emit strictly to the user's personal room
      this.realtimeService.emitToUser(notification.userId, 'notification:received', notification);
      return true;
    } catch (error) {
      this.logger.error(`Failed to emit WebSocket for Notification ${notification.id}`, error);
      return false;
    }
  }
}
