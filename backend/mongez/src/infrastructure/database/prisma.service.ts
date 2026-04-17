import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit {
  private prisma: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
      console.log('Database connected successfully');
    } catch (error: any) {
      console.error('Database connection error:', error?.message);
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  // ─── User & Auth ───────────────────────────────────────────
  get user() { return this.prisma.user; }
  get refreshToken() { return this.prisma.refreshToken; }
  get userLog() { return this.prisma.userLog; }

  // ─── Spaces ────────────────────────────────────────────────
  get space() { return this.prisma.space; }
  get spaceMember() { return this.prisma.spaceMember; }

  // ─── Boards ────────────────────────────────────────────────
  get board() { return this.prisma.board; }
  get boardMember() { return this.prisma.boardMember; }
  get boardColumn() { return this.prisma.boardColumn; }

  // ─── Tasks ─────────────────────────────────────────────────
  get task() { return this.prisma.task; }
  get taskAssignee() { return this.prisma.taskAssignee; }
  get taskAttachment() { return this.prisma.taskAttachment; }
  get taskDependency() { return this.prisma.taskDependency; }

  // ─── Comments ──────────────────────────────────────────────
  get comment() { return this.prisma.comment; }
  get mention() { return this.prisma.mention; }

  // ─── Notifications ─────────────────────────────────────────
  get notification() { return this.prisma.notification; }

  // ─── Files & Misc ──────────────────────────────────────────
  get file() { return this.prisma.file; }
  get approval() { return this.prisma.approval; }
  get activity() { return this.prisma.activity; }
  get subscription() { return this.prisma.subscription; }

  // ─── Health ────────────────────────────────────────────────
  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error?.message,
      };
    }
  }
}
