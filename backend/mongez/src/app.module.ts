import { Module, ValidationPipe, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import aiConfig from './config/ai.config';
import { AIModule } from './modules/ai/ai.module';
import { HealthModule } from './common/health/health.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { BoardsModule } from './modules/boards/boards.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SharedModule } from './shared/shared.module';
import { TraceMiddleware } from './common/middleware/trace.middleware';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, aiConfig],
    }),

    // Rate limiting
    ThrottlerModule.forRoot(),

    // Cron Jobs
    ScheduleModule.forRoot(),

    // Infrastructure (Global)
    PrismaModule,
    CacheModule,
    QueueModule,

    // Shared utilities (Global — exposes IdentifierService everywhere)
    SharedModule,

    // Modules
    HealthModule,
    AuthModule,
    UsersModule,
    SpacesModule,
    BoardsModule,
    TasksModule,
    NotificationsModule,
    AIModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}