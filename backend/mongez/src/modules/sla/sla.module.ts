import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  controllers: [SlaController],
  providers: [SlaService, SpaceMemberGuard],
  exports: [SlaService],
})
export class SlaModule {}
