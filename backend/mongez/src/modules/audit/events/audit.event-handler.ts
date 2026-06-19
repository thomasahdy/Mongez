import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from '../../tasks/events/task-events';
import { AuditService } from '../audit.service';

@EventsHandler(
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
)
export class AuditEventHandler implements IEventHandler<any> {
  constructor(private readonly auditService: AuditService) {}

  async handle(event: any) {
    try {
      if (event instanceof TaskCreatedEvent) {
        this.auditService.log({
          userId: event.task.createdById,
          action: 'task.created',
          entityType: 'Task',
          entityId: event.task.id,
          diff: {
            title: event.task.title,
            status: event.task.status,
            priority: event.task.priority,
          },
        });
      } else if (event instanceof TaskUpdatedEvent) {
        this.auditService.log({
          userId: event.userId,
          action: 'task.updated',
          entityType: 'Task',
          entityId: event.id,
          diff: event.changes,
        });
      } else if (event instanceof TaskMovedEvent) {
        this.auditService.log({
          userId: event.userId,
          action: 'task.moved',
          entityType: 'Task',
          entityId: event.id,
          diff: {
            columnId: event.columnId,
            position: event.position,
          },
        });
      } else if (event instanceof TaskArchivedEvent) {
        this.auditService.log({
          userId: event.userId,
          action: 'task.deleted',
          entityType: 'Task',
          entityId: event.id,
        });
      } else if (event instanceof CommentAddedEvent) {
        this.auditService.log({
          userId: event.comment.authorId,
          action: 'comment.created',
          entityType: 'Comment',
          entityId: event.comment.id,
          diff: {
            content: event.comment.content,
          },
        });
      }
    } catch (err: any) {
      console.error('Error in AuditEventHandler:', err.message);
    }
  }
}
