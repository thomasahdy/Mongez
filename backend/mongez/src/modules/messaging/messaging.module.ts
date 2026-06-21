import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { TasksModule } from '../tasks/tasks.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';

// Robust Messaging Services (from commands, approvals, analytics, notifications)
import { MessagingIntentService } from './commands/messaging-intent.service';
import { MessagingCommandExecutor } from './commands/messaging-command-executor.service';
import { MessagingApprovalService } from './approvals/messaging-approval.service';
import { MESSAGING_APPROVAL_PORT } from './approvals/ports/messaging-approval.port';
import { ApprovalDelegationService } from './approvals/approval-delegation.service';
import { MessagingAuditService } from './commands/messaging-audit.service';
import { MessagingRateLimitGuard } from './commands/guards/messaging-rate-limit.guard';
import { MessagingAnalyticsService } from './analytics/messaging-analytics.service';
import { NotificationPreferenceService } from './notifications/notification-preference.service';

/**
 * MessagingModule — the shared command/approval core used by both WhatsApp and
 * Telegram. It owns the bilingual intent parser, the command executor ( Talks to
 * TasksService + WorkflowService), and the multi-channel approval service.
 *
 * Dependency direction is strictly one-way:
 *   WhatsAppModule / TelegramModule  →  MessagingModule  →  Tasks / Workflow
 * This avoids circular module references (the channels push approval messages
 * through the BullMQ queues instead of importing the messaging modules back).
 */
@Module({
  imports: [
    forwardRef(() => TasksModule),
    forwardRef(() => WorkflowModule),
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP }),
    BullModule.registerQueue({ name: QUEUE_NAMES.TELEGRAM }),
  ],
  providers: [
    MessagingIntentService,
    MessagingCommandExecutor,
    MessagingApprovalService,
    {
      provide: MESSAGING_APPROVAL_PORT,
      useClass: MessagingApprovalService,
    },
    ApprovalDelegationService,
    MessagingAuditService,
    MessagingRateLimitGuard,
    MessagingAnalyticsService,
    NotificationPreferenceService,
  ],
  exports: [
    MessagingCommandExecutor,
    MessagingApprovalService,
    MESSAGING_APPROVAL_PORT,
    MessagingIntentService,
    ApprovalDelegationService,
    MessagingAnalyticsService,
    NotificationPreferenceService,
  ],
})
export class MessagingModule {}
