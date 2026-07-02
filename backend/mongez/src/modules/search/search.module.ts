import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SpaceMemberGuard],
  exports: [SearchService],
})
export class SearchModule {}