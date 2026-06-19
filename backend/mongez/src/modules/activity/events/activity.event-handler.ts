import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from '../../tasks/events/task-events';
import { ActivityService } from '../activity.service';

@EventsHandler(
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
)
export class ActivityEventHandler implements IEventHandler<any> {
  constructor(private readonly activityService: ActivityService) {}

  async handle(event: any) {
    try {
      if (event instanceof TaskCreatedEvent) {
        await this.activityService.createActivity(
          event.task.createdById,
          event.task.id,
          'task.created',
          {
            title: event.task.title,
            boardId: event.task.boardId,
          },
        );
      } else if (event instanceof TaskUpdatedEvent) {
        await this.activityService.createActivity(
          event.userId,
          event.id,
          'task.updated',
          {
            changes: event.changes,
            boardId: event.boardId,
          },
        );
      } else if (event instanceof TaskMovedEvent) {
        await this.activityService.createActivity(
          event.userId,
          event.id,
          'task.moved',
          {
            columnId: event.columnId,
            position: event.position,
            boardId: event.boardId,
          },
        );
      } else if (event instanceof TaskArchivedEvent) {
        await this.activityService.createActivity(
          event.userId,
          event.id,
          'task.archived',
          {
            boardId: event.boardId,
          },
        );
      } else if (event instanceof CommentAddedEvent) {
        await this.activityService.createActivity(
          event.comment.authorId,
          event.comment.taskId,
          'comment.created',
          {
            commentId: event.comment.id,
            spaceId: event.spaceId,
          },
        );
      }
    } catch (err) {
      console.error('Error handling activity domain event:', err);
    }
  }
}
