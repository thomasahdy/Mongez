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
    const instance = (await this.repo.findInstanceById(instanceId)) as
      | InstanceWithRelations
      | null;
    if (!instance) throw new NotFoundException('Workflow instance not found.');

    if (instance.status === 'APPROVED' || instance.status === 'REJECTED' || instance.status === 'CANCELLED') {
      throw new BadRequestException(`Workflow already resolved as ${instance.status}.`);
    }

    const step = instance.definition.steps[instance.currentStep];
    if (!step) throw new BadRequestException('No active step for this workflow instance.');

    // Authorization: actor must be a designated approver for the current step
    const canApprove = await this.isApprover(step, actorId, instance.spaceId);
    if (!canApprove) {
      throw new ForbiddenException('You are not an approver for the current step.');
    }

    // Prevent duplicate decisions on sequential steps (parallel steps allow multiple actors)
    if (!step.isParallel) {
      const already = instance.actions.find(
        (a) => a.stepOrder === instance.currentStep && a.actorId === actorId,
      );
      if (already) {
        throw new BadRequestException('You have already submitted a decision for this step.');
      }
    } else {
      const already = instance.actions.find(
        (a) => a.stepOrder === instance.currentStep && a.actorId === actorId,
      );
      if (already) {
        throw new BadRequestException('You have already submitted a decision for this step.');
      }
    }

    await this.repo.createAction({
      instanceId,
      stepOrder: instance.currentStep,
      actorId,
      decision,
      note: note ?? null,
    });

    // Reload instance to get the new action before evaluating
    const refreshed = (await this.repo.findInstanceById(instanceId)) as InstanceWithRelations;
    await this.evaluateStep(refreshed);

    return this.repo.findInstanceById(instanceId);
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
    const instance = (await this.repo.findInstanceById(instanceId)) as
      | InstanceWithRelations
      | null;
    if (!instance) return;
    if (instance.status !== 'PENDING' && instance.status !== 'IN_PROGRESS') return;
    if (instance.currentStep !== stepOrder) return; // Already advanced

    const step = instance.definition.steps[stepOrder];
    if (!step) return;

    this.logger.warn(
      `Workflow ${instanceId} step ${stepOrder} ("${step.name}") timed out — escalating.`,
    );

    // Escalation policy: mark step as timed-out and auto-reject the instance.
    // A future enhancement can escalate to a higher-level approver instead.
    await this.repo.updateInstance(instanceId, {
      status: 'TIMED_OUT',
      resolvedAt: new Date(),
    });

    await this.notifications.queueNotification({
      userId: instance.requesterId,
      spaceId: instance.spaceId,
      type: 'WORKFLOW_TIMED_OUT',
      channel: 'IN_APP',
      priority: 'HIGH',
      title: `Request timed out: ${instance.definition.name}`,
      body: `The approval step "${step.name}" timed out with no decision.`,
      entityType: 'workflow',
      entityId: instance.id,
    });

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

  // ── Internal: Step Evaluation ────────────────────────────────

  private async evaluateStep(instance: InstanceWithRelations): Promise<void> {
    const step = instance.definition.steps[instance.currentStep];
    if (!step) {
      // No more steps — approved by exhaustion
      await this.resolveWorkflow(instance, 'APPROVED');
      return;
    }

    const stepActions = instance.actions.filter((a) => a.stepOrder === instance.currentStep);

    // Any rejection immediately fails the workflow (standard pattern)
    const hasRejection = stepActions.some((a) => a.decision === 'REJECTED');
    if (hasRejection) {
      await this.recordSlaMetric(instance, step);
      await this.resolveWorkflow(instance, 'REJECTED');
      return;
    }

    const approvals = stepActions.filter((a) => a.decision === 'APPROVED');

    // Determine whether the step is satisfied
    const requiredApproverCount = step.requiresAll ? step.approverIds.length || 1 : 1;
    const stepComplete = step.requiresAll
      ? approvals.length >= requiredApproverCount
      : approvals.length >= 1;

    if (!stepComplete) {
      // Still waiting on more decisions for this step
      return;
    }

    // Record SLA Metric before advancing
    await this.recordSlaMetric(instance, step);

    // Step complete — advance to next step
    await this.advanceToNextStep(instance);
  }

  private async advanceToNextStep(instance: InstanceWithRelations): Promise<void> {
    const nextStepOrder = instance.currentStep + 1;
    const hasNext = nextStepOrder < instance.definition.steps.length;

    if (!hasNext) {
      await this.resolveWorkflow(instance, 'APPROVED');
      return;
    }

    const updated = await this.repo.updateInstance(instance.id, {
      currentStep: nextStepOrder,
      status: 'IN_PROGRESS',
    });

    const refreshed = (await this.repo.findInstanceById(instance.id)) as InstanceWithRelations;
    await this.notifyStepReviewers(refreshed);

    this.realtime.emitToUser(instance.requesterId, 'workflow:advanced', {
      instanceId: instance.id,
      currentStep: nextStepOrder,
    });
  }

  private async resolveWorkflow(instance: InstanceWithRelations, outcome: 'APPROVED' | 'REJECTED') {
    const updated = await this.repo.updateInstance(instance.id, {
      status: outcome,
      resolvedAt: new Date(),
    });

    await this.notifications.queueNotification({
      userId: instance.requesterId,
      spaceId: instance.spaceId,
      type: outcome === 'APPROVED' ? 'WORKFLOW_APPROVED' : 'WORKFLOW_REJECTED',
      channel: 'IN_APP',
      priority: outcome === 'APPROVED' ? 'NORMAL' : 'HIGH',
      title:
        outcome === 'APPROVED'
          ? `Approved: ${instance.definition.name}`
          : `Rejected: ${instance.definition.name}`,
      body:
        outcome === 'APPROVED'
          ? 'Your request has been approved.'
          : 'Your request has been rejected. Review the decision notes for details.',
      entityType: 'workflow',
      entityId: instance.id,
    });

    this.realtime.emitToUser(instance.requesterId, 'workflow:resolved', {
      instanceId: instance.id,
      outcome,
    });

    this.eventBus.publish(new WorkflowResolvedEvent(updated, outcome));

    this.logger.log(`Workflow ${instance.id} resolved as ${outcome}`);
  }

  // ── Internal: Notifications ──────────────────────────────────

  private async notifyStepReviewers(instance: InstanceWithRelations): Promise<void> {
    const step = instance.definition.steps[instance.currentStep];
    if (!step) return;

    // Compute approval expiry from step.timeoutHours (default 7 days)
    const timeoutHours = step.timeoutHours ?? 7 * 24; // Default: 7 days
    const expiresAt = new Date(Date.now() + timeoutHours * 3600_000);

    // Store expiry and activation time in instance context for later checks
    await this.repo.updateInstance(instance.id, {
      context: {
        ...(instance.context as Prisma.JsonObject | undefined),
        _approvalExpiresAt: expiresAt.toISOString(),
        _stepActivatedAt: new Date().toISOString(),
      },
    });

    const approverIds = this.resolveApproverIds(step, instance);
    const title = `Approval needed: ${instance.definition.name}`;
    const body = `Step "${step.name}" is awaiting your decision.`;

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

    // Also send in-app notifications to all approvers
    for (const approverId of approverIds) {
      await this.notifications.queueNotification({
        userId: approverId,
        spaceId: instance.spaceId,
        type: 'WORKFLOW_APPROVAL_REQUEST',
        channel: 'IN_APP',
        priority: 'HIGH',
        title,
        body,
        entityType: 'workflow',
        entityId: instance.id,
      });
      this.realtime.emitToUser(approverId, 'workflow:pending_review', {
        instanceId: instance.id,
        stepName: step.name,
      });
    }
  }

  /**
   * Resolve the list of approver IDs for a step based on the approverType.
   * For USER type, returns explicit approverIds.
   * For ROLE type, resolves to users with that role in the space.
   * For MANAGER_OF_REQUESTER type, resolves to the requester's manager (placeholder).
   */
  private resolveApproverIds(
    step: InstanceWithRelations['definition']['steps'][number],
    instance: InstanceWithRelations,
  ): string[] {
    switch (step.approverType) {
      case 'USER':
        return step.approverIds;
      case 'ROLE':
        // TODO: Resolve role-based approvers
        // This requires querying Membership for the space and role
        return step.approverIds; // Fallback to explicit IDs for now
      case 'MANAGER_OF_REQUESTER':
        // TODO: Resolve manager from requester's department
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

    for (const approverId of step.approverIds) {
      const delegateId = await this.delegationService.getActiveDelegate(approverId, spaceId);
      if (delegateId === userId) {
        return true;
      }
    }

    return false;
  }

  private async recordSlaMetric(instance: InstanceWithRelations, step: any): Promise<void> {
    try {
      const context = instance.context as any;
      if (context && context._stepActivatedAt) {
        const activatedAt = new Date(context._stepActivatedAt);
        const now = new Date();
        const actualHours = (now.getTime() - activatedAt.getTime()) / 3600_000;
        const targetHours = step.timeoutHours ?? 7 * 24;

        await this.slaService.recordMetric(
          instance.spaceId,
          instance.id,
          step.order,
          targetHours,
          actualHours
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to record SLA metric for instance ${instance.id}: ${err.message}`);
    }
  }
}