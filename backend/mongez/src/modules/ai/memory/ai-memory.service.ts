import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AIMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Session Memory (Redis, 30-min TTL) ──────────────────────
  async getSession(userId: string, spaceId: string): Promise<ConversationTurn[]> {
    const cached = await this.cache.get<ConversationTurn[]>(`ai:session:${userId}:${spaceId}`);
    return cached ?? [];
  }

  async appendToSession(userId: string, spaceId: string, turn: ConversationTurn): Promise<void> {
    const session = await this.getSession(userId, spaceId);
    // Keep last 20 turns in session
    const updated = [...session, turn].slice(-20);
    await this.cache.set(`ai:session:${userId}:${spaceId}`, updated, 1800);
  }

  // ── Conversation Memory (Postgres, permanent) ────────────────
  async saveConversationTurn(
    userId: string,
    spaceId: string,
    role: 'user' | 'assistant',
    content: string,
    traceId: string,
  ): Promise<void> {
    await this.prisma.aiConversationTurn.create({
      data: { userId, spaceId, role, content, traceId },
    });
  }

  async getRecentHistory(userId: string, spaceId: string, limit = 10): Promise<ConversationTurn[]> {
    const turns = await this.prisma.aiConversationTurn.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // Map them back to role + content in chronological order
    return turns
      .reverse()
      .map(t => ({
        role: t.role as 'user' | 'assistant',
        content: t.content,
      }));
  }

  // ── Workspace Memory (summary of recent space activity) ──────
  async getWorkspaceContext(spaceId: string): Promise<string> {
    const cacheKey = `ai:workspace-ctx:${spaceId}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const [recentTasks, blockedTasks, recentApprovals] = await Promise.all([
          this.prisma.task.count({
            where: {
              board: { department: { spaceId } },
              createdAt: { gte: sevenDaysAgo },
            },
          }),
          this.prisma.task.count({
            where: {
              board: { department: { spaceId } },
              status: 'BLOCKED',
            },
          }),
          this.prisma.workflowInstance.count({
            where: {
              spaceId,
              status: 'PENDING',
            },
          }),
        ]);
        return `Space context (last 7 days): ${recentTasks} tasks created, ${blockedTasks} blocked tasks, ${recentApprovals} pending approvals.`;
      },
      300,
    );
  }

  // ── Full Context Assembly (passed to every LLM call) ─────────
  async getConversationContext(userId: string, spaceId: string): Promise<string> {
    const [session, workspaceCtx] = await Promise.all([
      this.getSession(userId, spaceId),
      this.getWorkspaceContext(spaceId),
    ]);

    const historyText = session
      .map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n');

    return [workspaceCtx, historyText ? `\nConversation history:\n${historyText}` : ''].join('');
  }
}
