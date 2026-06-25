import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAILS) private readonly emailsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS) private readonly reportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ACTIVITY_LOG) private readonly activityLogQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKSPACE_EXPORT) private readonly workspaceExportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TELEGRAM) private readonly telegramQueue: Queue,
    @InjectQueue(QUEUE_NAMES.APPROVAL_EXPIRY) private readonly approvalExpiryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_FUNNEL) private readonly analyticsFunnelQueue: Queue,
  ) {}

  @Get()
  async check() {
    const databaseHealth = await this.prismaService.checkHealth();
    
    // Check Redis
    let redisStatus = 'healthy';
    let redisError: string | undefined;
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        redisStatus = 'unhealthy';
        redisError = 'Invalid response';
      }
    } catch (err: any) {
      redisStatus = 'unhealthy';
      redisError = err.message;
    }

    // Check AI Service
    let aiServiceStatus = 'healthy';
    let aiServiceError: string | undefined;
    const aiUrl = this.configService.get<string>('ai.serviceUrl') || 'http://localhost:8000';
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${aiUrl}/health`, { timeout: 3000 }),
      );
      if (response.status !== 200) {
        aiServiceStatus = 'unhealthy';
        aiServiceError = `HTTP Status ${response.status}`;
      }
    } catch (err: any) {
      aiServiceStatus = 'unhealthy';
      aiServiceError = err.message;
    }

    // Check Storage (MinIO S3 / Local)
    let storageStatus = 'healthy';
    let storageError: string | undefined;
    const storageProvider = this.configService.get<string>('STORAGE_PROVIDER', 'local');
    try {
      if (storageProvider === 's3') {
        const bucket = this.configService.get<string>('STORAGE_S3_BUCKET');
        if (!bucket) {
          storageStatus = 'unhealthy';
          storageError = 'STORAGE_S3_BUCKET env variable is missing';
        } else {
          const exists = await this.storageService.exists('healthcheck-test');
          if (!exists) {
            storageStatus = 'unhealthy';
            storageError = 'S3 bucket check failed';
          }
        }
      } else {
        // Local path check
        const writeable = await this.storageService.exists('.');
        if (!writeable) {
          storageStatus = 'unhealthy';
          storageError = 'Local storage path not writeable';
        }
      }
    } catch (err: any) {
      storageStatus = 'unhealthy';
      storageError = err.message;
    }

    // Check WhatsApp API Connectivity
    let whatsappStatus = 'healthy';
    let whatsappError: string | undefined;
    const waToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const waPhoneId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (waToken && waPhoneId) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`https://graph.facebook.com/v17.0/${waPhoneId}`, {
            headers: { Authorization: `Bearer ${waToken}` },
            timeout: 3000,
          }),
        );
        if (response.status !== 200) {
          whatsappStatus = 'unhealthy';
          whatsappError = `HTTP Status ${response.status}`;
        }
      } catch (err: any) {
        whatsappStatus = 'unhealthy';
        whatsappError = err.message;
      }
    } else {
      whatsappStatus = 'disabled';
    }

    // Check Telegram API Connectivity
    let telegramStatus = 'healthy';
    let telegramError: string | undefined;
    const tgToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (tgToken) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`https://api.telegram.org/bot${tgToken}/getMe`, { timeout: 3000 }),
        );
        if (response.status !== 200 || !response.data?.ok) {
          telegramStatus = 'unhealthy';
          telegramError = `HTTP Status ${response.status}`;
        }
      } catch (err: any) {
        telegramStatus = 'unhealthy';
        telegramError = err.message;
      }
    } else {
      telegramStatus = 'disabled';
    }

    // Check all 10 queues status and counts
    const queues = [
      { name: QUEUE_NAMES.NOTIFICATIONS, queue: this.notificationsQueue },
      { name: QUEUE_NAMES.EMAILS, queue: this.emailsQueue },
      { name: QUEUE_NAMES.AI_PROCESSING, queue: this.aiProcessingQueue },
      { name: QUEUE_NAMES.REPORTS, queue: this.reportsQueue },
      { name: QUEUE_NAMES.ACTIVITY_LOG, queue: this.activityLogQueue },
      { name: QUEUE_NAMES.WORKSPACE_EXPORT, queue: this.workspaceExportQueue },
      { name: QUEUE_NAMES.WHATSAPP, queue: this.whatsappQueue },
      { name: QUEUE_NAMES.TELEGRAM, queue: this.telegramQueue },
      { name: QUEUE_NAMES.APPROVAL_EXPIRY, queue: this.approvalExpiryQueue },
      { name: QUEUE_NAMES.ANALYTICS_FUNNEL, queue: this.analyticsFunnelQueue },
    ];

    const queueDetails: Record<string, any> = {};
    let queuesHealthy = true;
    for (const q of queues) {
      try {
        const counts = await q.queue.getJobCounts();
        queueDetails[q.name] = { status: 'healthy', counts };
      } catch (err: any) {
        queuesHealthy = false;
        queueDetails[q.name] = { status: 'unhealthy', error: err.message };
      }
    }

    const hasError = 
      databaseHealth.status !== 'healthy' ||
      redisStatus !== 'healthy' ||
      aiServiceStatus !== 'healthy' ||
      storageStatus === 'unhealthy' ||
      whatsappStatus === 'unhealthy' ||
      telegramStatus === 'unhealthy' ||
      !queuesHealthy;

    return {
      status: hasError ? 'error' : 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('app.env') || this.configService.get('NODE_ENV') || 'development',
      version: '1.0.0',
      database: databaseHealth,
      redis: {
        status: redisStatus,
        ...(redisError ? { error: redisError } : {}),
      },
      aiService: {
        status: aiServiceStatus,
        url: aiUrl,
        ...(aiServiceError ? { error: aiServiceError } : {}),
      },
      storage: {
        status: storageStatus,
        provider: storageProvider,
        ...(storageError ? { error: storageError } : {}),
      },
      messaging: {
        whatsapp: {
          status: whatsappStatus,
          ...(whatsappError ? { error: whatsappError } : {}),
        },
        telegram: {
          status: telegramStatus,
          ...(telegramError ? { error: telegramError } : {}),
        },
      },
      queues: {
        status: queuesHealthy ? 'healthy' : 'unhealthy',
        details: queueDetails,
      },
    };
  }

  @Get('database')
  async checkDatabase() {
    const health = await this.prismaService.checkHealth();
    return {
      ...health,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  checkConfig() {
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_ACCESS_TOKEN_SECRET',
      'JWT_REFRESH_TOKEN_SECRET',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    return {
      status: missingVars.length === 0 ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      requiredEnvVars,
      missingEnvVars: missingVars.length > 0 ? missingVars : undefined,
      environment: this.configService.get('app.env') || 'development',
    };
  }
}
