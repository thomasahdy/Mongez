import { Module, ValidationPipe, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import aiConfig from './config/ai.config';
import whatsappConfig from './config/whatsapp.config';
import telegramConfig from './config/telegram.config';
import { AIModule } from './modules/ai/ai.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
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
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { ActivityModule } from './modules/activity/activity.module';
import { TrashModule } from './modules/trash/trash.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AdminModule } from './modules/admin/admin.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { JwtService } from './modules/auth/services/jwt.service';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, aiConfig, whatsappConfig, telegramConfig],
    }),

    // Rate limiting
    ThrottlerModule.forRoot(),

    // Cron Jobs
    ScheduleModule.forRoot(),

    // Infrastructure (Global)
    PrismaModule,
    CacheModule,
    QueueModule,
    ObservabilityModule,

    // Shared utilities (Global — exposes IdentifierService + TenantContextService everywhere)
    SharedModule,

    // Modules
    HealthModule,
    AuthModule,
    UsersModule,
    SpacesModule,
    BoardsModule,
    TasksModule,
    NotificationsModule,
    RealtimeModule,
    AIModule,
    WorkflowModule,
    FilesModule,
    SearchModule,
    AnalyticsModule,
    AuditModule,
    ActivityModule,
    TrashModule,
    SubscriptionsModule,
    AdminModule,
    FeatureFlagsModule,
    ApprovalsModule,
    IntegrationsModule,
    WhatsAppModule,
    TelegramModule,

    // Bull Board Queue Dashboard
    BullBoardModule.forRootAsync({
      imports: [AuthModule],
      inject: [JwtService, ConfigService],
      useFactory: (jwtService: JwtService, configService: ConfigService) => ({
        route: '/admin/queues',
        adapter: ExpressAdapter,
        middleware: [
          async (req: any, res: any, next: any) => {
            const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];
            if (!token) {
              return res.status(401).send('Unauthorized: No token provided');
            }
            try {
              const payload = await jwtService.verifyAccessToken(token);
              const adminEmail = configService.get<string>('ADMIN_EMAIL') || 'thomas@mongez.io';
              if (payload.email !== adminEmail) {
                return res.status(403).send('Forbidden: Platform administrator access required');
              }
              req.user = payload;
              next();
            } catch (err) {
              return res.status(401).send('Unauthorized: Invalid token');
            }
          }
        ]
      })
    }),
    BullBoardModule.forFeature({
      name: 'notifications',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'ai-processing',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'whatsapp',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'telegram',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TraceMiddleware)
      .forRoutes('*');

    // TenantMiddleware must run after JWT validation (which happens in Guards, after middleware).
    // It reads req.user?.userId (set by Passport) so it silently skips unauthenticated requests.
    consumer
      .apply(TenantMiddleware)
      .exclude('/auth/(.*)', '/health/(.*)')
      .forRoutes('*');
  }
}
