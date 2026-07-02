import { Module } from '@nestjs/common';
import { SavedViewsController } from './saved-views.controller';
import { SavedViewsService } from './saved-views.service';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  controllers: [SavedViewsController],
  providers: [SavedViewsService, SpaceMemberGuard],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}
