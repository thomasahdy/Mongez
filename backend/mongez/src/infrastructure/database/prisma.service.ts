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
  get passwordReset() { return this.prisma.passwordReset; }
  get emailVerification() { return this.prisma.emailVerification; }
  get role() { return this.prisma.role; }
  get permission() { return this.prisma.permission; }
  get rolePermission() { return this.prisma.rolePermission; }
  get userPreference() { return this.prisma.userPreference; }
  get integration() { return this.prisma.integration; }

  // ─── Workspace Hierarchy ───────────────────────────────────
  get space() { return this.prisma.space; }
  get department() { return this.prisma.department; }
  get membership() { return this.prisma.membership; }
  get invitation() { return this.prisma.invitation; }
  get spaceCounter() { return this.prisma.spaceCounter; }
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
  get driveAttachment() { return this.prisma.driveAttachment; }

  // ─── Approvals ─────────────────────────────────────────────
  get approval() { return this.prisma.approval; }

  // ─── AI System ─────────────────────────────────────────────
  get aiRequest() { return this.prisma.aIRequest; }
  get aiProposedAction() { return this.prisma.aIProposedAction; }
  get aiEvalResult() { return this.prisma.aIEvalResult; }
  get aiConversationTurn() { return this.prisma.aIConversationTurn; }
  get aiMemoryProfile() { return this.prisma.aIMemoryProfile; }

  // ─── Notifications & Audit ─────────────────────────────────
  get notification() { return this.prisma.notification; }
  get outboxEvent() { return this.prisma.outboxEvent; }
  get deviceSession() { return this.prisma.deviceSession; }
  get notificationPreference() { return this.prisma.notificationPreference; }
  get notificationEvent() { return this.prisma.notificationEvent; }
  get auditLog() { return this.prisma.auditLog; }
  get taskJournal() { return this.prisma.taskJournal; }
  get activity() { return this.prisma.activity; }
  get userLog() { return this.prisma.userLog; }
  get featureFlag() { return this.prisma.featureFlag; }

  // ─── Workflow Engine ───────────────────────────────────────
  get workflowDefinition() { return this.prisma.workflowDefinition; }
  get workflowStep() { return this.prisma.workflowStep; }
  get workflowInstance() { return this.prisma.workflowInstance; }
  get workflowAction() { return this.prisma.workflowAction; }

  // ─── Metering ──────────────────────────────────────────────
  get usageRecord() { return this.prisma.usageRecord; }

  // ─── Messaging Channels (WhatsApp / Telegram) ──────────────
  get whatsAppAccount() { return this.prisma.whatsAppAccount; }
  get whatsAppContact() { return this.prisma.whatsAppContact; }
  get whatsAppMessage() { return this.prisma.whatsAppMessage; }
  get whatsAppOtpCode() { return this.prisma.whatsAppOtpCode; }
  get telegramAccount() { return this.prisma.telegramAccount; }
  get telegramContact() { return this.prisma.telegramContact; }
  get telegramMessage() { return this.prisma.telegramMessage; }

  // ─── Approval Delegation ────────────────────────────────────
  get approvalDelegate() { return this.prisma.approvalDelegate; }

  // ─── Calendar & Meeting Intelligence (Phase 3, 4, 5) ────────
  get calendarEvent() { return this.prisma.calendarEvent; }
  get calendarEventParticipant() { return this.prisma.calendarEventParticipant; }
  get googleCalendarSync() { return this.prisma.googleCalendarSync; }
  get holidayCache() { return this.prisma.holidayCache; }
  get meeting() { return this.prisma.meeting; }
  get proposedTask() { return this.prisma.proposedTask; }
  get userActivity() { return this.prisma.userActivity; }
  get userDelegation() { return this.prisma.userDelegation; }
  get slaMetric() { return this.prisma.slaMetric; }
  get savedView() { return this.prisma.savedView; }
  get decisionRecord() { return this.prisma.decisionRecord; }



  // ─── Raw query access ───────────────────────────────────────
  get $queryRaw() { return this.prisma.$queryRaw.bind(this.prisma); }
  get $queryRawUnsafe() { return this.prisma.$queryRawUnsafe.bind(this.prisma); }
  get $executeRaw() { return this.prisma.$executeRaw.bind(this.prisma); }
  get $executeRawUnsafe() { return this.prisma.$executeRawUnsafe.bind(this.prisma); }
  get $transaction() { return this.prisma.$transaction.bind(this.prisma); }

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
