import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  async check() {
    const databaseHealth = await this.prismaService.checkHealth();
    
    return {
      status: databaseHealth.status === 'healthy' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('app.env') || 'development',
      database: databaseHealth,
      auth: 'configured',
      version: '1.0.0',
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
