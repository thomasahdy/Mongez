import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DecisionsController } from './decisions.controller';
import { DecisionsService, WorkflowResolvedDecisionListener } from './decisions.service';

@Module({
  imports: [CqrsModule],
  controllers: [DecisionsController],
  providers: [DecisionsService, WorkflowResolvedDecisionListener],
  exports: [DecisionsService],
})
export class DecisionsModule {}
