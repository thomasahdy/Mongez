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

  // ─── Identity & Access ─────────────────────────────────────
  get user() { return this.prisma.user; }
  get userSession() { return this.prisma.userSession; }
  get role() { return this.prisma.role; }
  get permission() { return this.prisma.permission; }
  get rolePermission() { return this.prisma.rolePermission; }

  // ─── Workspace Hierarchy ───────────────────────────────────
  get space() { return this.prisma.space; }
  get department() { return this.prisma.department; }
  get membership() { return this.prisma.membership; }
  get subscriptionPlan() { return this.prisma.subscriptionPlan; }
  get subscription() { return this.prisma.subscription; }

  // ─── Boards ────────────────────────────────────────────────
  get board() { return this.prisma.board; }
  get boardColumn() { return this.prisma.boardColumn; }
  get view() { return this.prisma.view; }

  // ─── Tasks ─────────────────────────────────────────────────
  get task() { return this.prisma.task; }
  get taskAssignment() { return this.prisma.taskAssignment; }
  get taskDependency() { return this.prisma.taskDependency; }
  get timeLog() { return this.prisma.timeLog; }
  get watcher() { return this.prisma.watcher; }

  // ─── Collaboration ─────────────────────────────────────────
  get comment() { return this.prisma.comment; }
  get mention() { return this.prisma.mention; }
  get emojiReaction() { return this.prisma.emojiReaction; }

  // ─── Files ─────────────────────────────────────────────────
  get attachment() { return this.prisma.attachment; }
  get fileVersion() { return this.prisma.fileVersion; }

  // ─── Approvals ─────────────────────────────────────────────
  get approval() { return this.prisma.approval; }

  // ─── Notifications & Audit ─────────────────────────────────
  get notification() { return this.prisma.notification; }
  get auditLog() { return this.prisma.auditLog; }
  get taskJournal() { return this.prisma.taskJournal; }
  get activity() { return this.prisma.activity; }

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
