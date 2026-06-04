import { Module } from '@nestjs/common';
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