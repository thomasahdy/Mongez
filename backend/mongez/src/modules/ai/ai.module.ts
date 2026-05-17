import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { AIController } from './ai.controller';
import { AIDataProviderController } from './ai-data-provider.controller';
import { AIService } from './ai.service';
import { AIClientService } from './ai-client.service';
import { AIDataProviderService } from './ai-data-provider.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';

@Module({
  imports: [
    HttpModule,   // For calling Python AI service (HttpService)
    CqrsModule,   // For emitting events on action approval (Phase 5)
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
  ],
  exports: [AIService],
})
export class AIModule {}
