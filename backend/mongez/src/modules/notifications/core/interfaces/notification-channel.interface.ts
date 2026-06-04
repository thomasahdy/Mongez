import { Notification } from '@prisma/client';
import { BaseEvent } from '../contracts/event.contracts';

export interface NotificationChannel {
  send(notification: Notification, payload: BaseEvent): Promise<boolean>;
}
