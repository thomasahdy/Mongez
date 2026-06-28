import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto';
import { TaskStatus, Priority } from '@prisma/client';

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

@Injectable()
export class AIExecutorService {
  private readonly logger = new Logger(AIExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async execute(actionId: string, reviewerId: string): Promise<ExecutionResult> {
    return this.prisma.$transaction(async (tx) => {
      const action = await tx.aIProposedAction.findUnique({
        where: { id: actionId },
      });

      if (!action) {
        throw new Error(`AI proposed action ${actionId} not found`);
      }

      if (action.status !== 'PENDING' && action.status !== 'APPROVED') {
        throw new Error(`AI proposed action ${actionId} is already resolved with status ${action.status}`);
      }

      const payload = action.payload as any;
      let result: any;

      try {
        const cmd = (action.commandType || '').toUpperCase();
        switch (cmd) {
          case 'ASSIGNTASK':
          case 'REASSIGN_TASK': {
            const taskId = payload.taskId;
            const newAssigneeId = payload.newAssigneeId || payload.assigneeId;
            if (!taskId || !newAssigneeId) {
              throw new Error('Missing taskId or assigneeId in payload');
            }
            // Delete existing assignments first
            await tx.taskAssignment.deleteMany({
              where: { taskId },
            });
            // Create the new assignment
            result = await tx.taskAssignment.create({
              data: { taskId, userId: newAssigneeId },
            });

            // Create Outbox event for assignment
            await tx.outboxEvent.create({
              data: {
                aggregateType: 'Task',
                aggregateId: taskId,
                eventType: 'task.assigned',
                payload: {
                  eventId: `evt-assign-${taskId}-${newAssigneeId}-${Date.now()}`,
                  correlationId: taskId,
                  occurredAt: new Date().toISOString(),
                  spaceId: action.spaceId,
                  taskId,
                  assigneeId: newAssigneeId,
                  assignerId: reviewerId,
                },
              },
            });
            break;
          }

          case 'UPDATETASK':
          case 'UPDATE_TASK_STATUS': {
            const taskId = payload.taskId;
            const newStatus = (payload.newStatus || payload.status) as TaskStatus;
            if (!taskId || !newStatus) {
              throw new Error('Missing taskId or newStatus in payload');
            }
            const before = await tx.task.findUnique({ where: { id: taskId } });
            if (!before) {
              throw new Error(`Task ${taskId} not found`);
            }
            result = await tx.task.update({
              where: { id: taskId },
              data: { status: newStatus },
            });

            await tx.taskJournal.create({
              data: {
                taskId,
                changes: { field: 'status', from: before.status, to: newStatus },
                userId: reviewerId,
              },
            });
            break;
          }

          case 'ESCALATETASK':
          case 'ESCALATE_TO_MANAGER': {
            const managerId = payload.managerId;
            const taskId = payload.taskId;
            const taskTitle = payload.taskTitle || 'Task';
            const reason = payload.reason || 'AI Escalation';
            const spaceId = payload.spaceId || action.spaceId;

            if (!managerId) {
              throw new Error('Missing managerId in payload');
            }

            await this.notificationsService.queueNotification({
              userId: managerId,
              spaceId,
              type: 'AI_ESCALATION',
              channel: 'IN_APP',
              priority: 'HIGH',
              title: `Escalation: ${taskTitle}`,
              body: reason,
              entityType: 'task',
              entityId: taskId,
            });
            result = { escalated: true, managerId };
            break;
          }

          case 'CREATEREMINDER':
          case 'SEND_REMINDER': {
            const recipientIds: string[] = Array.isArray(payload.recipientIds)
              ? payload.recipientIds
              : payload.recipientId
              ? [payload.recipientId]
              : [];
            
            if (!recipientIds.length) {
              throw new Error('Missing recipientIds in payload');
            }

            for (const uid of recipientIds) {
              await this.notificationsService.queueNotification({
                userId: uid,
                spaceId: payload.spaceId || action.spaceId,
                type: 'SYSTEM',
                channel: 'IN_APP',
                priority: 'NORMAL',
                title: payload.title || 'Reminder',
                body: payload.body || 'You have a reminder',
                entityType: 'task',
                entityId: payload.taskId,
              });
            }
            result = { reminded: recipientIds.length };
            break;
          }

          case 'CREATETASK':
          case 'CREATE_TASK': {
            const taskDto = payload.taskDto as CreateTaskDto;
            const spaceId = payload.spaceId || action.spaceId;
            const spacePrefix = payload.spacePrefix || 'PRJ';
            
            if (!taskDto || !spaceId) {
              throw new Error('Missing taskDto or spaceId in payload');
            }

            // Fallback: If columnId is missing, resolve the first column of the board
            if (!taskDto.columnId && taskDto.boardId) {
              const column = await tx.column.findFirst({
                where: { boardId: taskDto.boardId, deletedAt: null },
                orderBy: { position: 'asc' },
              });
              if (column) {
                taskDto.columnId = column.id;
              }
            }

            // Call standard createTask via TasksService
            result = await this.tasksService.createTask(taskDto, reviewerId, spaceId, spacePrefix);
            break;
          }

          default:
            throw new Error(`Unsupported action commandType: ${action.commandType}`);
        }

        // Update database record status and audits
        await tx.aIProposedAction.update({
          where: { id: action.id },
          data: {
            status: 'APPROVED',
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            executedAt: new Date(),
            executedBy: reviewerId,
            executionStatus: 'SUCCESS',
          },
        });

        this.auditService.log({
          userId: reviewerId,
          action: `ai_action.executed.${action.commandType.toLowerCase()}`,
          entityType: 'ai_action',
          entityId: action.id,
          diff: { before: action.status, after: 'APPROVED' },
        });

        return { success: true, result };
      } catch (err: any) {
        this.logger.error(`Failed to execute AI action ${actionId}: ${err.message}`);

        await tx.aIProposedAction.update({
          where: { id: action.id },
          data: {
            status: 'FAILED',
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            executedAt: new Date(),
            executedBy: reviewerId,
            executionStatus: 'FAILED',
          },
        });

        return { success: false, error: err.message };
      }
    });
  }
}
