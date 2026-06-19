import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { CqrsModule } from '@nestjs/cqrs';
import { RealtimeEventHandlers } from './realtime.event-handler';

@Global()
@Module({
  imports: [AuthModule, CacheModule, CqrsModule],
  providers: [RealtimeService, RealtimeGateway, ...RealtimeEventHandlers],
  exports: [RealtimeService],
})
export class RealtimeModule {}

