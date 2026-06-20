import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WorkflowFilterDto } from './dto/workflow-filter.dto';
import { WorkflowStepDto } from './dto/create-workflow-definition.dto';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Definitions ──────────────────────────────────────────────

  async findDefinitions(spaceId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { spaceId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefinitionById(id: string) {
    return this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async createDefinition(
    spaceId: string,
    createdBy: string,
    name: string,
    triggerType: string,
    steps: WorkflowStepDto[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.workflowDefinition.create({
        data: { spaceId, name, triggerType, createdBy },
      });

      // Create steps with explicit ordering
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!;
        await tx.workflowStep.create({
          data: {
            definitionId: definition.id,
            order: i,
            name: s.name,
            approverType: s.approverType,
            approverIds: s.approverIds ?? [],
            approverRole: s.approverRole ?? null,
            isParallel: s.isParallel ?? false,
            requiresAll: s.requiresAll ?? true,
            timeoutHours: s.timeoutHours ?? null,
          },
        });
      }

      return tx.workflowDefinition.findUnique({
        where: { id: definition.id },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async updateDefinition(id: string, data: Partial<{ name: string; isActive: boolean }>) {
    return this.prisma.workflowDefinition.update({ where: { id }, data });
  }

  // ── Instances ────────────────────────────────────────────────

  async findInstanceById(id: string) {
    return this.prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        definition: { include: { steps: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async createInstance(data: {
    definitionId: string;
    spaceId: string;
    entityType: string;
    entityId: string;
    requesterId: string;
    context?: Prisma.JsonValue;
  }) {
    return this.prisma.workflowInstance.create({ data: data as any });
  }

  async updateInstance(
    id: string,
    data: Partial<{ currentStep: number; status: string; resolvedAt: Date | null; context: Prisma.InputJsonValue }>,
  ) {
    return this.prisma.workflowInstance.update({
      where: { id },
      data,
      include: {
        definition: { include: { steps: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async createAction(data: {
    instanceId: string;
    stepOrder: number;
    actorId: string;
    decision: string;
    note?: string | null;
  }) {
    return this.prisma.workflowAction.create({ data });
  }

  async findActionsForStep(instanceId: string, stepOrder: number) {
    return this.prisma.workflowAction.findMany({
      where: { instanceId, stepOrder },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Queries ──────────────────────────────────────────────────

  async findPendingForReviewer(reviewerId: string, spaceId: string, filters: WorkflowFilterDto) {
    const pageNum = Number(filters.page || 1);
    const limitNum = Number(filters.limit || 20);
    const skip = (pageNum - 1) * limitNum;

    // An instance is actionable by a reviewer if their id appears in the current
    // step's approverIds, or if the current step's role matches one of their
    // space memberships.
    const where: Prisma.WorkflowInstanceWhereInput = {
      spaceId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.definitionId ? { definitionId: filters.definitionId } : {}),
      definition: {
        steps: {
          some: {
            approverIds: { has: reviewerId },
          },
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.workflowInstance.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { definition: true },
      }),
      this.prisma.workflowInstance.count({ where }),
    ]);

    return { data, total };
  }

  async findMyRequests(requesterId: string, spaceId: string, filters: WorkflowFilterDto) {
    const pageNum = Number(filters.page || 1);
    const limitNum = Number(filters.limit || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.WorkflowInstanceWhereInput = {
      requesterId,
      spaceId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.definitionId ? { definitionId: filters.definitionId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.workflowInstance.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { definition: true },
      }),
      this.prisma.workflowInstance.count({ where }),
    ]);

    return { data, total };
  }

  async findTimedOutSteps() {
    // Find PENDING/IN_PROGRESS instances where the current step has a timeoutHours
    // and the most recent action on that step (or creation) is older than the timeout.
    const now = new Date();

    const candidates = await this.prisma.workflowInstance.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        definition: { include: { steps: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });

    return candidates.filter((instance) => {
      const step = instance.definition.steps[instance.currentStep];
      if (!step?.timeoutHours) return false;

      // Find the timestamp from which to measure the timeout:
      // - if there are actions on the current step, use the latest one
      // - otherwise use the instance creation time (or resolution of previous step)
      const stepActions = instance.actions.filter((a) => a.stepOrder === instance.currentStep);
      const referenceTime = stepActions.length > 0
        ? stepActions[stepActions.length - 1]!.createdAt
        : instance.createdAt;

      const elapsedMs = now.getTime() - referenceTime.getTime();
      return elapsedMs > step.timeoutHours * 3600 * 1000;
    });
  }
}