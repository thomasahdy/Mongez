import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';

@Global()
@Module({
  imports: [AuthModule, CacheModule],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
