import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';
import { ApprovalDelegationService } from './approval-delegation.service';
import { RealtimeService } from '../../realtime/realtime.service';

/** Escalation policy types stored in WorkflowStep.escalationPolicy JSON. */
interface EscalationPolicy {
  type: 'ESCALATE_TO_MANAGER' | 'ESCALATE_TO_ROLE' | 'AUTO_APPROVE' | 'AUTO_REJECT';
  targetRoleId?: string;
}

interface ActiveInstance {
  id: string;
  spaceId: string;
  requesterId: string;
  context: Record<string, unknown> | null;
  currentStep: number;
  startedAt: Date;
  reminderSentAt: Date | null;
  definition: {
    name: string | null;
    steps: Array<{
      id: string;
      order: number;
      timeoutHours: number | null;
      escalationPolicy: EscalationPolicy | null;
      approverIds: string[];
      approverRole: string | null;
      approverType: string;
    }>;
  } | null;
}

/**
 * ApprovalExpiryProcessor — BullMQ processor that sweeps workflow instances for:
 *
 * 1. **80% timeout reminder**: Sends a warning notification when 80% of the
 *    timeout window has elapsed, giving the reviewer a final chance to act.
 *
 * 2. **100% timeout → escalation**: When the full timeout expires, executes
 *    the configured escalation policy:
 *    - ESCALATE_TO_MANAGER: Reassign to the requester's manager
 *    - ESCALATE_TO_ROLE: Reassign to anyone with a given role
 *    - AUTO_APPROVE / AUTO_REJECT: Automatically resolve
 *
 * 3. **SLA duration recording**: When instances are resolved, captures the
 *    elapsed time in minutes for SLA analytics.
 *
 * Runs every 5 minutes via a BullMQ repeatable job.
 */
@Processor(QUEUE_NAMES.APPROVAL_EXPIRY)
export class ApprovalExpiryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ApprovalExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly delegation: ApprovalDelegationService,
    private readonly realtime: RealtimeService,
    @InjectQueue(QUEUE_NAMES.APPROVAL_EXPIRY) private readonly expiryQueue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    this.logger.log('Scheduling repeatable approval-expiry repeatable sweep...');
    try {
      const repeatableJobs = await this.expiryQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === JOB_NAMES.APPROVAL_EXPIRY_SWEEP) {
          await this.expiryQueue.removeRepeatableByKey(job.key);
        }
      }

      await this.expiryQueue.add(
        JOB_NAMES.APPROVAL_EXPIRY_SWEEP,
        {},
        {
          repeat: { pattern: '*/5 * * * *' },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log('Successfully scheduled approval-expiry repeatable sweep (every 5 minutes).');
    } catch (err: any) {
      this.logger.error(`Failed to schedule approval-expiry sweep: ${err.message}`);
    }
  }

  async process(job: Job<any>) {
    if (job.name === JOB_NAMES.APPROVAL_EXPIRY_SWEEP) {
      return this.sweep();
    }
  }

  async sweep() {
    this.logger.log('Starting approval expiry sweep...');
    const now = new Date();
    let expiredCount = 0;
    let reminderCount = 0;

    try {
      // Find all potentially active instances
      const activeInstances = await this.prisma.workflowInstance.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deletedAt: null,
        },
        select: {
          id: true,
          spaceId: true,
          requesterId: true,
          context: true,
          currentStep: true,
          startedAt: true,
          reminderSentAt: true,
          definition: {
            select: {
              name: true,
              steps: {
                select: {
                  id: true,
                  order: true,
                  timeoutHours: true,
                  escalationPolicy: true,
                  approverIds: true,
                  approverRole: true,
                  approverType: true,
                },
              },
            },
          },
        },
      });

      for (const instance of activeInstances as ActiveInstance[]) {
        const currentStepDef = instance.definition?.steps?.find(
          (s) => s.order === instance.currentStep,
        );

        // Use step-level timeout first, fallback to context-level expiry
        const timeoutHours = currentStepDef?.timeoutHours;
        const contextExpiry = (instance.context as any)?._approvalExpiresAt
          ? new Date((instance.context as any)._approvalExpiresAt as string)
          : null;

        if (!timeoutHours && !contextExpiry) continue;

        const startTime = instance.startedAt || new Date(instance.id); // fallback
        const expiresAt = timeoutHours
          ? new Date(startTime.getTime() + timeoutHours * 60 * 60 * 1000)
          : contextExpiry!;

        const elapsed = now.getTime() - startTime.getTime();
        const totalDuration = expiresAt.getTime() - startTime.getTime();
        const percentElapsed = totalDuration > 0 ? elapsed / totalDuration : 1;

        // ── 80% Reminder ─────────────────────────────────────
        if (
          percentElapsed >= 0.8 &&
          percentElapsed < 1.0 &&
          !instance.reminderSentAt
        ) {
          const hoursLeft = Math.max(
            0,
            Math.round(((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)) * 10) / 10,
          );
          const defName = instance.definition?.name || 'Approval';

          await this.sendReminder(instance, defName, hoursLeft);

          // Mark reminder as sent
          await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { reminderSentAt: now },
          });

          reminderCount++;
          continue; // Don't escalate yet
        }

        // ── 100% Expiry → Escalation ─────────────────────────
        if (percentElapsed >= 1.0) {
          const escalationPolicy = (currentStepDef?.escalationPolicy as EscalationPolicy) || null;

          if (escalationPolicy) {
            await this.executeEscalation(instance, escalationPolicy, currentStepDef!);
          } else {
            // No policy → default to TIMED_OUT
            await this.prisma.workflowInstance.update({
              where: { id: instance.id },
              data: {
                status: 'TIMED_OUT',
                resolvedAt: now,
                durationMinutes: Math.round(elapsed / (1000 * 60)),
              },
            });
          }

          expiredCount++;
          await this.notifyExpired(instance);
        }
      }

      this.logger.log(
        `Approval sweep: ${expiredCount} expired, ${reminderCount} reminders sent.`,
      );
      return { expiredCount, reminderCount };
    } catch (error) {
      this.logger.error('Approval expiry sweep failed:', error);
      throw error;
    }
  }

  /**
   * Execute an escalation policy when an approval times out.
   */
  private async executeEscalation(
    instance: ActiveInstance,
    policy: EscalationPolicy,
    stepDef: ActiveInstance['definition'] extends null ? never : NonNullable<ActiveInstance['definition']>['steps'][0],
  ): Promise<void> {
    const now = new Date();
    const elapsed = now.getTime() - (instance.startedAt?.getTime() || now.getTime());
    const durationMinutes = Math.round(elapsed / (1000 * 60));

    switch (policy.type) {
      case 'AUTO_APPROVE':
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: 'APPROVED',
            resolvedAt: now,
            durationMinutes,
          },
        });
        // Record auto-approval action
        await this.prisma.workflowAction.create({
          data: {
            instanceId: instance.id,
            stepOrder: instance.currentStep,
            actorId: 'SYSTEM',
            decision: 'APPROVED',
            note: 'Auto-approved due to escalation policy timeout',
          },
        });
        this.realtime.emitToSpace(instance.spaceId, 'approval:resolved', {
          instanceId: instance.id,
          outcome: 'APPROVED',
        });
        this.logger.log(`Instance ${instance.id}: AUTO_APPROVE executed`);
        break;

      case 'AUTO_REJECT':
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: 'REJECTED',
            resolvedAt: now,
            durationMinutes,
          },
        });
        await this.prisma.workflowAction.create({
          data: {
            instanceId: instance.id,
            stepOrder: instance.currentStep,
            actorId: 'SYSTEM',
            decision: 'REJECTED',
            note: 'Auto-rejected due to escalation policy timeout',
          },
        });
        this.realtime.emitToSpace(instance.spaceId, 'approval:resolved', {
          instanceId: instance.id,
          outcome: 'REJECTED',
        });
        this.logger.log(`Instance ${instance.id}: AUTO_REJECT executed`);
        break;

      case 'ESCALATE_TO_MANAGER': {
        // Find the requester's manager (OWNER/ADMIN role in the same space)
        const manager = await this.prisma.membership.findFirst({
          where: {
            spaceId: instance.spaceId,
            role: { name: { in: ['OWNER', 'ADMIN'] } },
            userId: { not: instance.requesterId },
          },
          select: { userId: true },
        });

        if (manager) {
          // Record escalation action
          await this.prisma.workflowAction.create({
            data: {
              instanceId: instance.id,
              stepOrder: instance.currentStep,
              actorId: 'SYSTEM',
              decision: 'DELEGATED',
              note: `Escalated to manager (${manager.userId}) due to timeout`,
            },
          });

          // Notify the new reviewer
          await this.notifications.createAndNotify({
            userId: manager.userId,
            spaceId: instance.spaceId,
            type: 'APPROVAL_REQUESTED',
            channel: 'IN_APP',
            priority: 'HIGH',
            title: 'Escalated Approval',
            body: `"${instance.definition?.name || 'Approval'}" has been escalated to you due to timeout.`,
            entityType: 'WorkflowInstance',
            entityId: instance.id,
            metadata: { escalationType: 'ESCALATE_TO_MANAGER' },
          });

          this.realtime.emitToSpace(instance.spaceId, 'approval:escalated', {
            instanceId: instance.id,
            escalationType: 'ESCALATE_TO_MANAGER',
            newApproverId: manager.userId,
          });

          this.logger.log(`Instance ${instance.id}: ESCALATE_TO_MANAGER → ${manager.userId}`);
        } else {
          // No manager found → fallback to TIMED_OUT
          await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'TIMED_OUT', resolvedAt: now, durationMinutes },
          });
          this.realtime.emitToSpace(instance.spaceId, 'approval:resolved', {
            instanceId: instance.id,
            outcome: 'TIMED_OUT',
          });
        }
        break;
      }

      case 'ESCALATE_TO_ROLE': {
        const targetRoleName = policy.targetRoleId || 'ADMIN';
        const roleMembers = await this.prisma.membership.findMany({
          where: {
            spaceId: instance.spaceId,
            role: { name: targetRoleName },
            userId: { not: instance.requesterId },
          },
          select: { userId: true },
          take: 5,
        });

        if (roleMembers.length > 0) {
          await this.prisma.workflowAction.create({
            data: {
              instanceId: instance.id,
              stepOrder: instance.currentStep,
              actorId: 'SYSTEM',
              decision: 'DELEGATED',
              note: `Escalated to role "${targetRoleName}" due to timeout`,
            },
          });

          // Notify all role members
          for (const member of roleMembers) {
            await this.notifications.createAndNotify({
              userId: member.userId,
              spaceId: instance.spaceId,
              type: 'APPROVAL_REQUESTED',
              channel: 'IN_APP',
              priority: 'HIGH',
              title: 'Escalated Approval',
              body: `"${instance.definition?.name || 'Approval'}" has been escalated to the ${targetRoleName} role.`,
              entityType: 'WorkflowInstance',
              entityId: instance.id,
              metadata: { escalationType: 'ESCALATE_TO_ROLE', targetRole: targetRoleName },
            });
          }

          this.realtime.emitToSpace(instance.spaceId, 'approval:escalated', {
            instanceId: instance.id,
            escalationType: 'ESCALATE_TO_ROLE',
            targetRole: targetRoleName,
            newApproverIds: roleMembers.map((m) => m.userId),
          });

          this.logger.log(`Instance ${instance.id}: ESCALATE_TO_ROLE → ${targetRoleName} (${roleMembers.length} members)`);
        } else {
          await this.prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'TIMED_OUT', resolvedAt: now, durationMinutes },
          });
          this.realtime.emitToSpace(instance.spaceId, 'approval:resolved', {
            instanceId: instance.id,
            outcome: 'TIMED_OUT',
          });
        }
        break;
      }

      default:
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: { status: 'TIMED_OUT', resolvedAt: now, durationMinutes },
        });
        this.realtime.emitToSpace(instance.spaceId, 'approval:resolved', {
          instanceId: instance.id,
          outcome: 'TIMED_OUT',
        });
    }
  }

  /**
   * Send a reminder at 80% timeout to the current reviewers.
   */
  private async sendReminder(
    instance: ActiveInstance,
    defName: string,
    hoursLeft: number,
  ): Promise<void> {
    try {
      const currentStepDef = instance.definition?.steps?.find(
        (s) => s.order === instance.currentStep,
      );
      const reviewerIds = currentStepDef?.approverIds || [];

      for (const reviewerId of reviewerIds) {
        // Check delegation — send reminder to the effective reviewer
        const effective = await this.delegation.resolveEffectiveReviewer(
          reviewerId,
          instance.spaceId,
        );

        const user = await this.prisma.user.findUnique({
          where: { id: effective.userId },
          select: { language: true },
        });
        const lang = user?.language?.startsWith('ar') ? 'ar' : 'en';

        const title = lang === 'ar'
          ? `⚠️ تذكير: "${defName}"`
          : `⚠️ Reminder: "${defName}"`;
        const body = lang === 'ar'
          ? `تحتاج مراجعتك. متبقي ${hoursLeft} ساعات قبل التصعيد.`
          : `Needs your review. Only ${hoursLeft} hours left before escalation.`;

        await this.notifications.createAndNotify({
          userId: effective.userId,
          spaceId: instance.spaceId,
          type: 'APPROVAL_REQUESTED',
          channel: 'IN_APP',
          priority: 'HIGH',
          title,
          body,
          entityType: 'WorkflowInstance',
          entityId: instance.id,
          metadata: { reminderType: '80_percent_timeout', hoursLeft },
        });
      }

      this.logger.log(`Reminder sent for instance ${instance.id} (${hoursLeft}h remaining)`);
    } catch (error) {
      this.logger.error(`Failed to send reminder for instance ${instance.id}:`, error);
    }
  }

  /**
   * Notify the requester that an approval has expired.
   */
  private async notifyExpired(instance: {
    id: string;
    spaceId: string;
    requesterId: string;
    definition?: { name?: string | null } | null;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: instance.requesterId },
        select: { language: true, email: true, name: true },
      });

      if (!user) return;

      const lang = user.language?.startsWith('ar') ? 'ar' : 'en';
      const title = lang === 'ar' ? 'انتهت صلاحية الموافقة' : 'Approval Expired';
      const body = lang === 'ar'
        ? `انتهت صلاحية طلب الموافقة "${instance.definition?.name || 'N/A'}" ولم يتم البت فيه.`
        : `The approval request "${instance.definition?.name || 'N/A'}" has expired without a decision.`;

      await this.notifications.createAndNotify({
        userId: instance.requesterId,
        spaceId: instance.spaceId,
        type: 'APPROVAL_RESOLVED',
        channel: 'IN_APP',
        priority: 'NORMAL',
        title,
        body,
        entityType: 'WorkflowInstance',
        entityId: instance.id,
        metadata: { reason: 'expired' },
      });
    } catch (error) {
      this.logger.error(`Failed to notify expiry for instance ${instance.id}:`, error);
    }
  }
}
