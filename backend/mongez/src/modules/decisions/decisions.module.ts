import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DecisionsController } from './decisions.controller';
import { DecisionsService, WorkflowResolvedDecisionListener } from './decisions.service';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  imports: [CqrsModule],
  controllers: [DecisionsController],
  providers: [DecisionsService, WorkflowResolvedDecisionListener, SpaceMemberGuard],
  exports: [DecisionsService],
})
export class DecisionsModule {}
