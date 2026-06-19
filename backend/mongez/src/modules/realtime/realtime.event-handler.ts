import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from '../tasks/events/task-events';
import { RealtimeService } from './realtime.service';

@EventsHandler(TaskCreatedEvent)
export class TaskCreatedEventHandler implements IEventHandler<TaskCreatedEvent> {
  constructor(private readonly realtime: RealtimeService) {}
  handle(event: TaskCreatedEvent) {
    this.realtime.emitToBoard(event.task.boardId, 'task:created', event.task);
  }
}

@EventsHandler(TaskUpdatedEvent)
export class TaskUpdatedEventHandler implements IEventHandler<TaskUpdatedEvent> {
  constructor(private readonly realtime: RealtimeService) {}
  handle(event: TaskUpdatedEvent) {
    this.realtime.emitToBoard(event.boardId, 'task:updated', {
      id: event.id,
      changes: event.changes,
    });
  }
}

@EventsHandler(TaskMovedEvent)
export class TaskMovedEventHandler implements IEventHandler<TaskMovedEvent> {
  constructor(private readonly realtime: RealtimeService) {}
  handle(event: TaskMovedEvent) {
    this.realtime.emitToBoard(event.boardId, 'task:moved', {
      id: event.id,
      columnId: event.columnId,
      position: event.position,
    });
  }
}

@EventsHandler(TaskArchivedEvent)
export class TaskArchivedEventHandler implements IEventHandler<TaskArchivedEvent> {
  constructor(private readonly realtime: RealtimeService) {}
  handle(event: TaskArchivedEvent) {
    this.realtime.emitToBoard(event.boardId, 'task:archived', {
      id: event.id,
    });
  }
}

@EventsHandler(CommentAddedEvent)
export class CommentAddedEventHandler implements IEventHandler<CommentAddedEvent> {
  constructor(private readonly realtime: RealtimeService) {}
  handle(event: CommentAddedEvent) {
    this.realtime.emitToSpace(event.spaceId, 'comment:added', event.comment);
  }
}

export const RealtimeEventHandlers = [
  TaskCreatedEventHandler,
  TaskUpdatedEventHandler,
  TaskMovedEventHandler,
  TaskArchivedEventHandler,
  CommentAddedEventHandler,
];
