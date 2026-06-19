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

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
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

    // Check BullMQ Notifications Queue
    let queueStatus = 'healthy';
    let queueError: string | undefined;
    try {
      await this.notificationQueue.getJobCounts();
    } catch (err: any) {
      queueStatus = 'unhealthy';
      queueError = err.message;
    }

    const hasError = 
      databaseHealth.status !== 'healthy' ||
      redisStatus !== 'healthy' ||
      aiServiceStatus !== 'healthy' ||
      queueStatus !== 'healthy';

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
      queue: {
        status: queueStatus,
        name: QUEUE_NAMES.NOTIFICATIONS,
        ...(queueError ? { error: queueError } : {}),
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
