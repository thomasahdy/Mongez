import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TaskUpdatedEvent } from '../../tasks/events/task-events';
import { WorkflowInitiatedEvent, WorkflowTimeoutEvent } from '../../workflow/events/workflow-events';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CalendarEventSource, CalendarType, CalendarEventVisibility } from '@prisma/client';
import { CalendarService } from '../services/calendar.service';

@Injectable()
@EventsHandler(TaskUpdatedEvent)
export class TaskUpdatedTimelineListener implements IEventHandler<TaskUpdatedEvent> {
  private readonly logger = new Logger(TaskUpdatedTimelineListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: CalendarService,
  ) {}

  async handle(event: TaskUpdatedEvent) {
    try {
      const { id, changes, userId } = event;

      // Handle Task Blocked status
      if (changes.status === 'BLOCKED') {
        this.logger.log(`Task ${id} was BLOCKED. Creating escalation calendar event...`);
        const task = await this.prisma.task.findUnique({
          where: { id },
          include: { board: { include: { department: { select: { spaceId: true } } } } },
        }) as any;

        if (!task || !task.board?.department?.spaceId) return;

        const spaceId = task.board.department.spaceId;
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 2 * 3600 * 1000); // default 2 hours block display

        // Check if escalation event already exists to prevent duplicate entries
        const existing = await this.prisma.calendarEvent.findFirst({
          where: {
            spaceId,
            taskId: id,
            source: CalendarEventSource.ESCALATION,
            isDeleted: false,
          },
        });

        if (!existing) {
          await this.prisma.calendarEvent.create({
            data: {
              spaceId,
              title: `🚨 BLOCKED: ${task.title}`,
              description: `Task ${task.identifier} is blocked. Reason: ${task.description || 'No reason provided'}`,
              startDate,
              endDate,
              allDay: false,
              calendarType: CalendarType.GREGORIAN,
              hijriDate: this.calendarService.gregorianToHijri(startDate),
              source: CalendarEventSource.ESCALATION,
              visibility: CalendarEventVisibility.PUBLIC,
              taskId: id,
              entityType: 'Task',
              entityId: id,
              createdById: userId,
            },
          });
        }
      } else if (changes.status && changes.status !== 'BLOCKED') {
        // If task was unblocked, soft delete the escalation event
        const task = await this.prisma.task.findUnique({
          where: { id },
          include: { board: { include: { department: { select: { spaceId: true } } } } },
        }) as any;

        if (!task || !task.board?.department?.spaceId) return;

        const spaceId = task.board.department.spaceId;



        await this.prisma.calendarEvent.updateMany({
          where: {
            spaceId,
            taskId: id,
            source: CalendarEventSource.ESCALATION,
            isDeleted: false,
          },
          data: {
            isDeleted: true,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error in TaskUpdatedTimelineListener: ${err.message}`, err.stack);
    }
  }
}

@Injectable()
@EventsHandler(WorkflowInitiatedEvent)
export class WorkflowInitiatedTimelineListener implements IEventHandler<WorkflowInitiatedEvent> {
  private readonly logger = new Logger(WorkflowInitiatedTimelineListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: CalendarService,
  ) {}

  async handle(event: WorkflowInitiatedEvent) {
    try {
      const { instance } = event;
      this.logger.log(`Workflow instance ${instance.id} initiated. Creating approval calendar event...`);

      const contextObj = instance.context as any;
      const expiresAtStr = contextObj?._approvalExpiresAt;
      const deadline = expiresAtStr
        ? new Date(expiresAtStr)
        : new Date(instance.startedAt.getTime() + 7 * 24 * 3600 * 1000); // 7-day fallback

      // We store approval calendar events persistently to allow history and participant queries
      await this.prisma.calendarEvent.create({
        data: {
          spaceId: instance.spaceId,
          title: `Approval: ${instance.definition.name}`,
          description: `Workflow instance started for entity ${instance.entityType} (${instance.entityId}). Requester: ${instance.requesterId}`,
          startDate: deadline,
          endDate: deadline,
          allDay: true,
          calendarType: CalendarType.GREGORIAN,
          hijriDate: this.calendarService.gregorianToHijri(deadline),
          source: CalendarEventSource.APPROVAL,
          visibility: CalendarEventVisibility.PUBLIC,
          entityType: 'WorkflowInstance',
          entityId: instance.id,
          createdById: instance.requesterId,
          participants: {
            create: {
              email: instance.requester?.email || 'system@mongez.io',
              displayName: instance.requester?.name || 'Requester',
              userId: instance.requesterId,
              status: 'ACCEPTED',
            },
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Error in WorkflowInitiatedTimelineListener: ${err.message}`, err.stack);
    }
  }
}

@Injectable()
@EventsHandler(WorkflowTimeoutEvent)
export class WorkflowTimeoutTimelineListener implements IEventHandler<WorkflowTimeoutEvent> {
  private readonly logger = new Logger(WorkflowTimeoutTimelineListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: CalendarService,
  ) {}

  async handle(event: WorkflowTimeoutEvent) {
    try {
      const { instanceId, stepOrder, spaceId, requesterId, title } = event;
      this.logger.warn(`Workflow instance ${instanceId} timed out at step ${stepOrder}. Creating escalation event...`);

      const now = new Date();

      // Deactivate/delete any previous PENDING approval event for this workflow
      await this.prisma.calendarEvent.updateMany({
        where: {
          spaceId,
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          source: CalendarEventSource.APPROVAL,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
        },
      });

      // Create new escalation event
      await this.prisma.calendarEvent.create({
        data: {
          spaceId,
          title,
          description: `Workflow timeout escalated on step ${stepOrder} for instance ${instanceId}`,
          startDate: now,
          endDate: now,
          allDay: true,
          calendarType: CalendarType.GREGORIAN,
          hijriDate: this.calendarService.gregorianToHijri(now),
          source: CalendarEventSource.ESCALATION,
          visibility: CalendarEventVisibility.PUBLIC,
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          createdById: requesterId,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error in WorkflowTimeoutTimelineListener: ${err.message}`, err.stack);
    }
  }
}

export const CalendarEventHandlers = [
  TaskUpdatedTimelineListener,
  WorkflowInitiatedTimelineListener,
  WorkflowTimeoutTimelineListener,
];
