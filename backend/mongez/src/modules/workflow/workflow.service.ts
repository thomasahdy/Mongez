import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkflowRepository } from './workflow.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WorkflowFilterDto } from './dto/workflow-filter.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { paginate } from '../../shared/dto/pagination.dto';

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
    return this.repo.findInstanceById(instance.id);
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
    if (!this.isApprover(step, actorId)) {
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

    this.logger.log(`Workflow ${instance.id} resolved as ${outcome}`);
  }

  // ── Internal: Notifications ──────────────────────────────────

  private async notifyStepReviewers(instance: InstanceWithRelations): Promise<void> {
    const step = instance.definition.steps[instance.currentStep];
    if (!step) return;

    for (const approverId of step.approverIds) {
      await this.notifications.queueNotification({
        userId: approverId,
        spaceId: instance.spaceId,
        type: 'WORKFLOW_APPROVAL_REQUEST',
        channel: 'IN_APP',
        priority: 'HIGH',
        title: `Approval needed: ${instance.definition.name}`,
        body: `Step "${step.name}" is awaiting your decision.`,
        entityType: 'workflow',
        entityId: instance.id,
      });
      this.realtime.emitToUser(approverId, 'workflow:pending_review', {
        instanceId: instance.id,
        stepName: step.name,
      });
    }
  }

  // ── Internal: Authorization Helpers ──────────────────────────

  private isApprover(
    step: InstanceWithRelations['definition']['steps'][number],
    userId: string,
  ): boolean {
    return step.approverIds.includes(userId);
  }
}