import { Module } from '@nestjs/common';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { SpaceRepository } from './space.repository';

@Module({
  controllers: [SpacesController],
  providers: [SpacesService, SpaceRepository],
  exports: [SpacesService],
})
export class SpacesModule {}