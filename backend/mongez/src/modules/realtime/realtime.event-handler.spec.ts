import { Test, TestingModule } from '@nestjs/testing';
import {
  TaskCreatedEventHandler,
  TaskUpdatedEventHandler,
  TaskMovedEventHandler,
  TaskArchivedEventHandler,
  CommentAddedEventHandler,
} from './realtime.event-handler';
import { RealtimeService } from './realtime.service';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskMovedEvent,
  TaskArchivedEvent,
  CommentAddedEvent,
} from '../tasks/events/task-events';

describe('RealtimeEventHandlers', () => {
  let realtimeService: jest.Mocked<RealtimeService>;

  beforeEach(() => {
    realtimeService = {
      emitToBoard: jest.fn(),
      emitToSpace: jest.fn(),
    } as any;
  });

  describe('TaskCreatedEventHandler', () => {
    it('should call emitToBoard with task details', () => {
      const handler = new TaskCreatedEventHandler(realtimeService);
      const event = new TaskCreatedEvent({ id: 'task-1', boardId: 'board-1', title: 'New Task' });
      
      handler.handle(event);
      
      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'task:created', event.task);
    });
  });

  describe('TaskUpdatedEventHandler', () => {
    it('should call emitToBoard with changes', () => {
      const handler = new TaskUpdatedEventHandler(realtimeService);
      const event = new TaskUpdatedEvent('task-1', { title: 'Updated' }, 'board-1');

      handler.handle(event);

      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'task:updated', {
        id: 'task-1',
        changes: { title: 'Updated' },
      });
    });
  });

  describe('TaskMovedEventHandler', () => {
    it('should call emitToBoard with moves', () => {
      const handler = new TaskMovedEventHandler(realtimeService);
      const event = new TaskMovedEvent('task-1', 'column-2', 5, 'board-1');

      handler.handle(event);

      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'task:moved', {
        id: 'task-1',
        columnId: 'column-2',
        position: 5,
      });
    });
  });

  describe('TaskArchivedEventHandler', () => {
    it('should call emitToBoard with archived status', () => {
      const handler = new TaskArchivedEventHandler(realtimeService);
      const event = new TaskArchivedEvent('task-1', 'board-1');

      handler.handle(event);

      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'task:archived', {
        id: 'task-1',
      });
    });
  });

  describe('CommentAddedEventHandler', () => {
    it('should call emitToSpace with comment details', () => {
      const handler = new CommentAddedEventHandler(realtimeService);
      const event = new CommentAddedEvent({ id: 'comment-1', content: 'hello' }, 'space-1');

      handler.handle(event);

      expect(realtimeService.emitToSpace).toHaveBeenCalledWith('space-1', 'comment:added', event.comment);
    });
  });
});
