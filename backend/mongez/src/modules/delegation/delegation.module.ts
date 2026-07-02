import { Module } from '@nestjs/common';
import { DelegationController } from './delegation.controller';
import { DelegationService } from './delegation.service';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  controllers: [DelegationController],
  providers: [DelegationService, SpaceMemberGuard],
  exports: [DelegationService],
})
export class DelegationModule {}
