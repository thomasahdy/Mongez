import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SpacesModule } from '../spaces/spaces.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SpacesModule, SharedModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
