import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkflowRepository } from './workflow.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WorkflowFilterDto } from './dto/workflow-filter.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { paginate } from '../../shared/dto/pagination.dto';
import { MESSAGING_APPROVAL_PORT } from '../messaging/approvals/ports/messaging-approval.port';
import type { MessagingApprovalPort } from '../messaging/approvals/ports/messaging-approval.port';
import { EventBus } from '@nestjs/cqrs';
import { WorkflowInitiatedEvent, WorkflowTimeoutEvent, WorkflowResolvedEvent } from './events/workflow-events';
import { DelegationService } from '../delegation/delegation.service';
import { SlaService } from '../sla/sla.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type Decision = 'APPROVED' | 'REJECTED' | 'DELEGATED';

interface InstanceWithRelations {
  id: string;
  definitionId: string;
  spaceId: string;
  entityType: string;
  entityId: string;
  requesterId: string;
  currentStep: number;
  status: string;
  context?: Prisma.JsonValue | null;
  createdAt: Date;
  resolvedAt?: Date | null;
  definition: {
    id: string;
    name: string;
    steps: Array<{
      id: string;
      order: number;
      name: string;
      approverType: string;
      approverIds: string[];
      approverRole: string | null;
      isParallel: boolean;
      requiresAll: boolean;
      timeoutHours: number | null;
    }>;
  };
  actions: Array<{
    id: string;
    stepOrder: number;
    actorId: string;
    decision: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly repo: WorkflowRepository,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    @Inject(MESSAGING_APPROVAL_PORT)
    private readonly messagingApproval: MessagingApprovalPort,
    private readonly eventBus: EventBus,
    private readonly delegationService: DelegationService,
    private readonly slaService: SlaService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Definitions ──────────────────────────────────────────────

  async listDefinitions(spaceId: string) {
    return this.repo.findDefinitions(spaceId);
  }

  async createDefinition(
    spaceId: string,
    createdBy: string,
    data: { name: string; triggerType: string; steps: any[] },
  ) {
    if (!data.steps?.length) {
      throw new BadRequestException('A workflow must have at least one step.');
    }
    return this.repo.createDefinition(spaceId, createdBy, data.name, data.triggerType, data.steps);
  }

  async updateDefinition(id: string, data: Partial<{ name: string; isActive: boolean }>) {
    const def = await this.repo.findDefinitionById(id);
    if (!def) throw new NotFoundException('Workflow definition not found.');
    return this.repo.updateDefinition(id, data);
  }

  // ── Instance Lifecycle ───────────────────────────────────────

  async startWorkflow(requesterId: string, dto: StartWorkflowDto) {
    const definition = await this.repo.findDefinitionById(dto.definitionId);
    if (!definition) throw new NotFoundException('Workflow definition not found.');
    if (!definition.isActive) throw new BadRequestException('This workflow definition is inactive.');
    if (definition.spaceId !== dto.spaceId) {
      throw new ForbiddenException('Workflow definition does not belong to this space.');
    }
    if (!definition.steps.length) {
      throw new BadRequestException('Workflow definition has no steps.');
    }

    const instance = await this.repo.createInstance({
      definitionId: dto.definitionId,
      spaceId: dto.spaceId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      requesterId,
      context: dto.context as Prisma.JsonValue | undefined,
    });

    const updated = await this.repo.updateInstance(instance.id, {
      currentStep: 0,
      status: 'IN_PROGRESS',
    });

    await this.notifyStepReviewers(updated as unknown as InstanceWithRelations);

    this.realtime.emitToUser(requesterId, 'workflow:started', { instanceId: instance.id });
    
    const finalInstance = await this.repo.findInstanceById(instance.id);
    if (finalInstance) {
      this.eventBus.publish(new WorkflowInitiatedEvent(finalInstance));
    }
    return finalInstance;
  }

  async submitDecision(
    instanceId: string,
    actorId: string,
    decision: Decision,
    note?: string,
  ) {
    const transitionEvent = await this.prisma.$transaction(async (tx) => {
      // 1. Lock instance row using SELECT FOR UPDATE
      const instance = await this.repo.findInstanceByIdForUpdateTx(tx, instanceId);
      if (!instance) throw new NotFoundException('Workflow instance not found.');

      if (['APPROVED', 'REJECTED', 'CANCELLED', 'TIMED_OUT'].includes(instance.status)) {
        throw new BadRequestException(`Workflow already resolved as ${instance.status}.`);
      }

      const step = instance.definition.steps[instance.currentStep];
      if (!step) throw new BadRequestException('No active step for this workflow instance.');

      // Authorization: actor must be a designated approver for the current step
      const canApprove = await this.isApprover(step, actorId, instance.spaceId);
      if (!canApprove) {
        throw new ForbiddenException('You are not an approver for the current step.');
      }

      // Prevent duplicate decisions
      const already = instance.actions.find(
        (a) => a.stepOrder === instance.currentStep && a.actorId === actorId,
      );
      if (already) {
        throw new BadRequestException('You have already submitted a decision for this step.');
      }

      try {
        await tx.workflowAction.create({
          data: {
            instanceId,
            stepOrder: instance.currentStep,
            actorId,
            decision,
            note: note ?? null,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Idempotency: duplicate decision recorded concurrently
          return undefined;
        }
        throw err;
      }

      // Reload actions inside the transaction
      const refreshedActions = await tx.workflowAction.findMany({
        where: { instanceId },
        orderBy: { createdAt: 'asc' },
      });

      const currentInstance = {
        ...instance,
        actions: refreshedActions,
      };

      // 2. Evaluate step transitions inside the transaction
      const currentStep = currentInstance.definition.steps[currentInstance.currentStep];
      if (!currentStep) {
        await tx.workflowInstance.update({
          where: { id: instanceId },
          data: { status: 'APPROVED', resolvedAt: new Date() },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'workflow',
            aggregateId: instanceId,
            eventType: 'workflow.approved',
            payload: {
              eventId: `evt-workflow-approve-${instanceId}-${Date.now()}`,
              correlationId: instanceId,
              occurredAt: new Date().toISOString(),
              spaceId: instance.spaceId,
              userId: instance.requesterId,
              title: `Approved: ${instance.definition.name}`,
              body: 'Your request has been approved.',
            },
          },
        });
        return { type: 'RESOLVED', data: { outcome: 'APPROVED' } };
      } else {
        const stepActions = refreshedActions.filter((a) => a.stepOrder === currentInstance.currentStep);
        const hasRejection = stepActions.some((a) => a.decision === 'REJECTED');

        if (hasRejection) {
          await this.recordSlaMetricTx(tx, currentInstance, currentStep);
          await tx.workflowInstance.update({
            where: { id: instanceId },
            data: { status: 'REJECTED', resolvedAt: new Date() },
          });
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'workflow',
              aggregateId: instanceId,
              eventType: 'workflow.rejected',
              payload: {
                eventId: `evt-workflow-reject-${instanceId}-${Date.now()}`,
                correlationId: instanceId,
                occurredAt: new Date().toISOString(),
                spaceId: instance.spaceId,
                userId: instance.requesterId,
                title: `Rejected: ${instance.definition.name}`,
                body: 'Your request has been rejected. Review the decision notes for details.',
              },
            },
          });
          return { type: 'RESOLVED', data: { outcome: 'REJECTED' } };
        } else {
          const approvals = stepActions.filter((a) => a.decision === 'APPROVED');
          const requiredApproverCount = currentStep.requiresAll ? currentStep.approverIds.length || 1 : 1;
          const stepComplete = currentStep.requiresAll
            ? approvals.length >= requiredApproverCount
            : approvals.length >= 1;

          if (stepComplete) {
            await this.recordSlaMetricTx(tx, currentInstance, currentStep);
            
            const nextStepOrder = currentInstance.currentStep + 1;
            const hasNext = nextStepOrder < currentInstance.definition.steps.length;

            if (!hasNext) {
              await tx.workflowInstance.update({
                where: { id: instanceId },
                data: { status: 'APPROVED', resolvedAt: new Date() },
              });
              await tx.outboxEvent.create({
                data: {
                  aggregateType: 'workflow',
                  aggregateId: instanceId,
                  eventType: 'workflow.approved',
                  payload: {
                    eventId: `evt-workflow-approve-${instanceId}-${Date.now()}`,
                    correlationId: instanceId,
                    occurredAt: new Date().toISOString(),
                    spaceId: instance.spaceId,
                    userId: instance.requesterId,
                    title: `Approved: ${instance.definition.name}`,
                    body: 'Your request has been approved.',
                  },
                },
              });
              return { type: 'RESOLVED', data: { outcome: 'APPROVED' } };
            } else {
              const timeoutHours = currentInstance.definition.steps[nextStepOrder]?.timeoutHours ?? 7 * 24;
              const expiresAt = new Date(Date.now() + timeoutHours * 3600_000);
              
              await tx.workflowInstance.update({
                where: { id: instanceId },
                data: {
                  currentStep: nextStepOrder,
                  status: 'IN_PROGRESS',
                  context: {
                    ...(currentInstance.context as any),
                    _approvalExpiresAt: expiresAt.toISOString(),
                    _stepActivatedAt: new Date().toISOString(),
                  },
                },
              });
              return { type: 'ADVANCED', data: { nextStepOrder } };
            }
          }
        }
      }
      return undefined;
    }) as { type: 'ADVANCED' | 'RESOLVED'; data: any } | undefined;

    const updatedInstance = await this.repo.findInstanceById(instanceId);
    if (!updatedInstance) return null;

    if (transitionEvent) {
      if (transitionEvent.type === 'RESOLVED') {
        const outcome = transitionEvent.data.outcome;

        this.realtime.emitToUser(updatedInstance.requesterId, 'workflow:resolved', {
          instanceId: updatedInstance.id,
          outcome,
        });

        this.realtime.emitToSpace(updatedInstance.spaceId, 'approval:resolved', {
          instanceId: updatedInstance.id,
          outcome,
        });

        this.eventBus.publish(new WorkflowResolvedEvent(updatedInstance, outcome));
      } else if (transitionEvent.type === 'ADVANCED') {
        const nextStepOrder = transitionEvent.data.nextStepOrder;
        
        await this.notifyStepReviewers(updatedInstance as any);

        this.realtime.emitToUser(updatedInstance.requesterId, 'workflow:advanced', {
          instanceId: updatedInstance.id,
          currentStep: nextStepOrder,
        });
      }
    }

    return updatedInstance;
  }

  // ── Queries ──────────────────────────────────────────────────

  async getPendingForReviewer(reviewerId: string, spaceId: string, filters: WorkflowFilterDto) {
    const { data, total } = await this.repo.findPendingForReviewer(reviewerId, spaceId, filters);
    return paginate(data, total, filters.page, filters.limit);
  }

  async getMyRequests(requesterId: string, spaceId: string, filters: WorkflowFilterDto) {
    const { data, total } = await this.repo.findMyRequests(requesterId, spaceId, filters);
    return paginate(data, total, filters.page, filters.limit);
  }

  async getInstanceHistory(instanceId: string) {
    const instance = await this.repo.findInstanceById(instanceId);
    if (!instance) throw new NotFoundException('Workflow instance not found.');
    return instance;
  }

  async cancelInstance(instanceId: string, requesterId: string) {
    const instance = (await this.repo.findInstanceById(instanceId)) as
      | InstanceWithRelations
      | null;
    if (!instance) throw new NotFoundException('Workflow instance not found.');

    if (instance.requesterId !== requesterId) {
      throw new ForbiddenException('Only the requester can cancel a workflow.');
    }

    if (instance.status === 'APPROVED' || instance.status === 'REJECTED') {
      throw new BadRequestException(`Cannot cancel a workflow that is already ${instance.status}.`);
    }

    const updated = await this.repo.updateInstance(instanceId, {
      status: 'CANCELLED',
      resolvedAt: new Date(),
    });

    this.realtime.emitToUser(instance.requesterId, 'workflow:cancelled', { instanceId });
    return updated;
  }

  // ── Timeout Handling ─────────────────────────────────────────

  async handleStepTimeout(instanceId: string, stepOrder: number) {
    const escalationEvent = await this.prisma.$transaction(async (tx) => {
      const instance = await this.repo.findInstanceByIdForUpdateTx(tx, instanceId);
      if (!instance) return null;
      if (instance.status !== 'PENDING' && instance.status !== 'IN_PROGRESS') return null;
      if (instance.currentStep !== stepOrder) return null; // Already advanced

      const step = instance.definition.steps[stepOrder];
      if (!step) return null;

      this.logger.warn(
        `Workflow ${instanceId} step ${stepOrder} ("${step.name}") timed out — escalating.`,
      );

      // Escalation policy: mark step as timed-out and auto-reject the instance.
      await tx.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'TIMED_OUT',
          resolvedAt: new Date(),
        },
      });

      // Write Outbox Event for timeout
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'workflow',
          aggregateId: instanceId,
          eventType: 'workflow.timed_out',
          payload: {
            eventId: `evt-workflow-timeout-${instanceId}-${stepOrder}-${Date.now()}`,
            correlationId: instanceId,
            occurredAt: new Date().toISOString(),
            spaceId: instance.spaceId,
            userId: instance.requesterId,
            title: `Request timed out: ${instance.definition.name}`,
            body: `The approval step "${step.name}" timed out with no decision.`,
          },
        },
      });

      return { instance: instance as any as InstanceWithRelations, step };
    }) as { instance: InstanceWithRelations; step: any } | null;

    if (escalationEvent) {
      const { instance } = escalationEvent;

      this.realtime.emitToUser(instance.requesterId, 'workflow:timed_out', { instanceId });

      this.eventBus.publish(
        new WorkflowTimeoutEvent(
          instanceId,
          stepOrder,
          instance.spaceId,
          instance.requesterId,
          `Request timed out: ${instance.definition.name}`,
        ),
      );
    }
  }

  // ── Internal: Step Evaluation ────────────────────────────────

  private async recordSlaMetricTx(tx: Prisma.TransactionClient, instance: InstanceWithRelations, step: any): Promise<void> {
    try {
      const context = instance.context as any;
      if (context && context._stepActivatedAt) {
        const activatedAt = new Date(context._stepActivatedAt);
        const now = new Date();
        const actualHours = (now.getTime() - activatedAt.getTime()) / 3600_000;
        const targetHours = step.timeoutHours ?? 7 * 24;

        await tx.slaMetric.create({
          data: {
            spaceId: instance.spaceId,
            workflowInstanceId: instance.id,
            stepOrder: step.order,
            targetHours,
            actualHours,
            isViolated: actualHours > targetHours,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to record SLA metric for instance ${instance.id}: ${err.message}`);
    }
  }

  private async notifyStepReviewers(instance: InstanceWithRelations): Promise<void> {
    const step = instance.definition.steps[instance.currentStep];
    if (!step) return;

    // Compute approval expiry from step.timeoutHours (default 7 days)
    const timeoutHours = step.timeoutHours ?? 7 * 24; // Default: 7 days
    const expiresAt = new Date(Date.now() + timeoutHours * 3600_000);

    const approverIds = this.resolveApproverIds(step, instance);
    const title = `Approval needed: ${instance.definition.name}`;
    const body = `Step "${step.name}" is awaiting your decision.`;

    // Perform database context update and write outbox events in a single transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          context: {
            ...(instance.context as any),
            _approvalExpiresAt: expiresAt.toISOString(),
            _stepActivatedAt: new Date().toISOString(),
          },
        },
      });

      for (const approverId of approverIds) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'workflow',
            aggregateId: instance.id,
            eventType: 'workflow.approval_request',
            payload: {
              eventId: `evt-workflow-req-${instance.id}-${approverId}-${Date.now()}`,
              correlationId: instance.id,
              occurredAt: new Date().toISOString(),
              spaceId: instance.spaceId,
              userId: approverId,
              title,
              body,
            },
          },
        });
      }
    });

    // Send to all approvers via messaging port (WhatsApp, Telegram)
    await Promise.allSettled(
      approverIds.map((userId) =>
        this.messagingApproval.sendApprovalRequestToUser({
          spaceId: instance.spaceId,
          userId,
          instanceId: instance.id,
          title,
          body,
          expiresAt,
        }),
      ),
    );

    // Also send in-app realtime Socket.IO notifications to all active approvers
    for (const approverId of approverIds) {
      this.realtime.emitToUser(approverId, 'workflow:pending_review', {
        instanceId: instance.id,
        stepName: step.name,
      });
      this.realtime.emitToUser(approverId, 'approval:created', {
        instanceId: instance.id,
        stepName: step.name,
        expiresAt,
      });
    }
  }

  /**
   * Resolve the list of approver IDs for a step based on the approverType.
   */
  private resolveApproverIds(
    step: InstanceWithRelations['definition']['steps'][number],
    instance: InstanceWithRelations,
  ): string[] {
    switch (step.approverType) {
      case 'USER':
        return step.approverIds;
      case 'ROLE':
        return step.approverIds; // Fallback to explicit IDs for now
      case 'MANAGER_OF_REQUESTER':
        return step.approverIds; // Fallback to explicit IDs for now
      default:
        return step.approverIds;
    }
  }

  // ── Internal: Authorization Helpers ──────────────────────────

  private async isApprover(
    step: InstanceWithRelations['definition']['steps'][number],
    userId: string,
    spaceId: string,
  ): Promise<boolean> {
    if (step.approverIds.includes(userId)) {
      return true;
    }

    const delegationResults = await Promise.all(
      step.approverIds.map((approverId) =>
        this.delegationService.getActiveDelegate(approverId, spaceId),
      ),
    );

    if (delegationResults.includes(userId)) {
      return true;
    }

    return false;
  }
}