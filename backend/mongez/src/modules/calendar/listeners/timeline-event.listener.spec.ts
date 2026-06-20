import {
  TaskUpdatedTimelineListener,
  WorkflowInitiatedTimelineListener,
  WorkflowTimeoutTimelineListener,
} from './timeline-event.listener';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CalendarService } from '../services/calendar.service';
import { TaskUpdatedEvent } from '../../tasks/events/task-events';
import { WorkflowInitiatedEvent, WorkflowTimeoutEvent } from '../../workflow/events/workflow-events';
import { CalendarEventSource, CalendarType, CalendarEventVisibility } from '@prisma/client';

describe('Calendar Event Listeners', () => {
  let prisma: jest.Mocked<PrismaService>;
  let calendarService: jest.Mocked<CalendarService>;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      calendarEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;

    calendarService = {
      gregorianToHijri: jest.fn().mockReturnValue('1448-01-05'),
    } as any;
  });

  describe('TaskUpdatedTimelineListener', () => {
    let listener: TaskUpdatedTimelineListener;

    beforeEach(() => {
      listener = new TaskUpdatedTimelineListener(prisma, calendarService);
    });

    it('should create an escalation calendar event if task is BLOCKED and no escalation exists', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Review PR',
        identifier: 'EDU-42',
        description: 'Need review',
        board: { department: { spaceId: 'space-1' } },
      };

      prisma.task.findUnique.mockResolvedValue(mockTask as any);
      prisma.calendarEvent.findFirst.mockResolvedValue(null); // No existing escalation

      const event = new TaskUpdatedEvent('task-1', { status: 'BLOCKED' }, 'board-1', 'user-1');
      await listener.handle(event);

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: { board: { include: { department: { select: { spaceId: true } } } } },
      });

      expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-1',
          title: '🚨 BLOCKED: Review PR',
          source: CalendarEventSource.ESCALATION,
          taskId: 'task-1',
          createdById: 'user-1',
        }),
      });
    });

    it('should not create duplicate escalation event if one already exists', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Review PR',
        board: { department: { spaceId: 'space-1' } },
      };

      prisma.task.findUnique.mockResolvedValue(mockTask as any);
      prisma.calendarEvent.findFirst.mockResolvedValue({ id: 'existing-event' } as any);

      const event = new TaskUpdatedEvent('task-1', { status: 'BLOCKED' }, 'board-1', 'user-1');
      await listener.handle(event);

      expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
    });

    it('should soft delete existing escalation event if task status is no longer BLOCKED', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Review PR',
        board: { department: { spaceId: 'space-1' } },
      };

      prisma.task.findUnique.mockResolvedValue(mockTask as any);

      const event = new TaskUpdatedEvent('task-1', { status: 'IN_PROGRESS' }, 'board-1', 'user-1');
      await listener.handle(event);

      expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          taskId: 'task-1',
          source: CalendarEventSource.ESCALATION,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
        },
      });
    });
  });

  describe('WorkflowInitiatedTimelineListener', () => {
    let listener: WorkflowInitiatedTimelineListener;

    beforeEach(() => {
      listener = new WorkflowInitiatedTimelineListener(prisma, calendarService);
    });

    it('should create an approval calendar event on workflow initiation', async () => {
      const mockInstance = {
        id: 'inst-1',
        spaceId: 'space-1',
        entityType: 'BUDGET',
        entityId: 'budget-1',
        requesterId: 'user-1',
        startedAt: new Date('2026-06-20T10:00:00Z'),
        context: { _approvalExpiresAt: '2026-06-21T10:00:00Z' },
        definition: { name: 'Budget Approval' },
        requester: { email: 'user@example.com', name: 'John Doe' },
      };

      const event = new WorkflowInitiatedEvent(mockInstance as any);
      await listener.handle(event);

      expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-1',
          title: 'Approval: Budget Approval',
          source: CalendarEventSource.APPROVAL,
          entityId: 'inst-1',
          createdById: 'user-1',
        }),
      });
    });
  });

  describe('WorkflowTimeoutTimelineListener', () => {
    let listener: WorkflowTimeoutTimelineListener;

    beforeEach(() => {
      listener = new WorkflowTimeoutTimelineListener(prisma, calendarService);
    });

    it('should soft delete previous approval event and create an escalation calendar event', async () => {
      const event = new WorkflowTimeoutEvent(
        'inst-1',
        1,
        'space-1',
        'user-1',
        '🚨 ESCALATED: Budget Approval Timeout',
      );

      await listener.handle(event);

      // Deactivates previous approval event
      expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          entityType: 'WorkflowInstance',
          entityId: 'inst-1',
          source: CalendarEventSource.APPROVAL,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
        },
      });

      // Creates new escalation event
      expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-1',
          title: '🚨 ESCALATED: Budget Approval Timeout',
          source: CalendarEventSource.ESCALATION,
          entityId: 'inst-1',
          createdById: 'user-1',
        }),
      });
    });
  });
});
