import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { SpacesController, InvitationsController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import {
  SpaceRepository,
  DepartmentRepository,
  MembershipRepository,
  InvitationRepository,
} from './repositories/spaces.repositories';
import { SpaceMemberGuard } from './guards/space-member.guard';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.WORKSPACE_EXPORT },
    ),
  ],
  controllers: [SpacesController, InvitationsController],
  providers: [
    SpacesService,
    SpaceRepository,
    DepartmentRepository,
    MembershipRepository,
    InvitationRepository,
    SpaceMemberGuard,
  ],
  exports: [SpacesService, SpaceMemberGuard, SpaceRepository],
})
export class SpacesModule {}