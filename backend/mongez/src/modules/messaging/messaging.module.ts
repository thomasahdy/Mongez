import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { TasksModule } from '../tasks/tasks.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { MessagingIntentService } from './services/messaging-intent.service';
import { MessagingCommandExecutor } from './services/messaging-command-executor.service';
import { MessagingApprovalService } from './services/messaging-approval.service';

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
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP }),
    BullModule.registerQueue({ name: QUEUE_NAMES.TELEGRAM }),
  ],
  providers: [
    MessagingIntentService,
    MessagingCommandExecutor,
    MessagingApprovalService,
  ],
  exports: [
    MessagingCommandExecutor,
    MessagingApprovalService,
    MessagingIntentService,
  ],
})
export class MessagingModule {}
