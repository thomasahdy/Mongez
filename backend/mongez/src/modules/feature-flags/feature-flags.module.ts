import { Module, Global } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

@Global()
@Module({
  imports: [CacheModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, PlatformAdminGuard],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
