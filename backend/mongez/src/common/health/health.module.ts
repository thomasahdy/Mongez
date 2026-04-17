import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule { }
