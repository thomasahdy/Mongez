import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { WorkflowResolvedEvent } from '../workflow/events/workflow-events';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDecisions(spaceId: string) {
    return this.prisma.decisionRecord.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDecision(id: string) {
    return this.prisma.decisionRecord.delete({
      where: { id },
    });
  }
}

@EventsHandler(WorkflowResolvedEvent)
export class WorkflowResolvedDecisionListener implements IEventHandler<WorkflowResolvedEvent> {
  private readonly logger = new Logger(WorkflowResolvedDecisionListener.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(event: WorkflowResolvedEvent) {
    const { instance, outcome } = event;
    this.logger.log(`Workflow ${instance.id} resolved as ${outcome}. Recording in Decision Register...`);

    try {
      // Fetch workflow details
      const fullInstance = await this.prisma.workflowInstance.findUnique({
        where: { id: instance.id },
        include: {
          definition: true,
          actions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!fullInstance) return;

      const lastAction = fullInstance.actions[0];
      const decidedById = lastAction ? lastAction.actorId : fullInstance.requesterId;
      const summary = lastAction?.note || `Workflow ${fullInstance.definition.name} resolved as ${outcome}.`;


      // Set fact expiration boundary
      let validUntil: Date | null = null;
      const now = new Date();
      if (fullInstance.entityType === 'BUDGET') {
        // Budget decisions are valid for 1 year
        validUntil = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
      } else if (fullInstance.entityType === 'AI_ACTION' || fullInstance.entityType === 'TASK') {
        // Operational tasks/AI decisions expire in 90 days
        validUntil = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
      } else {
        // Other decisions valid for 180 days
        validUntil = new Date(now.getTime() + 180 * 24 * 3600 * 1000);
      }

      await this.prisma.decisionRecord.upsert({
        where: { workflowInstanceId: fullInstance.id },
        update: {
          outcome,
          decidedById,
          summary,
          validUntil,
          metadata: (fullInstance.context as any) || {},
        },
        create: {
          spaceId: fullInstance.spaceId,
          workflowInstanceId: fullInstance.id,
          entityType: fullInstance.entityType,
          entityId: fullInstance.entityId,
          title: fullInstance.definition.name,
          outcome,
          decidedById,
          summary,
          confidence: 1.0,
          validUntil,
          metadata: (fullInstance.context as any) || {},
        },
      });
      this.logger.log(`Successfully logged DecisionRecord for workflow instance ${instance.id}`);
    } catch (err: any) {
      this.logger.error(`Failed to record workflow decision for instance ${instance.id}: ${err.message}`);
    }
  }
}
