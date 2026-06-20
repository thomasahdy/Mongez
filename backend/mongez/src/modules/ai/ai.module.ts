import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { AIController } from './ai.controller';
import { AIDataProviderController } from './ai-data-provider.controller';
import { AIService } from './ai.service';
import { AIClientService } from './ai-client.service';
import { AIDataProviderService } from './ai-data-provider.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';

// Phase 3 services
import { AICircuitBreakerService } from './circuit-breaker/ai-circuit-breaker.service';
import { AIMemoryService } from './memory/ai-memory.service';
import { AIMemoryProfileService } from './memory/ai-memory-profile.service';
import { AIGatewayService } from './ai-gateway.service';
import { AIExecutorService } from './services/ai-executor.service';
import { AILlmService } from './services/ai-llm.service';
import { AIRagService } from './services/ai-rag.service';
import { AIRiskService } from './services/ai-risk.service';
import { AISchedulerService } from './scheduler/ai-scheduler.service';

// External modules
import { TasksModule } from '../tasks/tasks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CalendarModule } from '../calendar/calendar.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    HttpModule,
    CqrsModule,
    TasksModule,
    NotificationsModule,
    AuditModule,
    SubscriptionsModule,
    CalendarModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AI_PROCESSING },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  controllers: [AIController, AIDataProviderController],
  providers: [
    AIService,
    AIClientService,
    AIDataProviderService,
    AIRequestRepository,
    AIActionRepository,
    AiRateLimitGuard,
    ServiceApiKeyGuard,

    // Phase 3
    AICircuitBreakerService,
    AIMemoryService,
    AIMemoryProfileService,
    AIGatewayService,
    AIExecutorService,
    AILlmService,
    AIRagService,
    AIRiskService,
    AISchedulerService,
  ],
  exports: [AIService, AIGatewayService, AIExecutorService, AIMemoryProfileService],
})
export class AIModule {}
