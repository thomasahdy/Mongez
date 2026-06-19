import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AIClientService } from '../ai-client.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AIMemoryProfileService {
  private readonly logger = new Logger(AIMemoryProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AIClientService,
  ) {}

  /**
   * Periodically sweep recent conversations and extract long-term preferences.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepAndExtractProfiles() {
    this.logger.log('Starting AIMemoryProfile sweep and preference extraction...');
    try {
      // Find all users who have conversation turns in the last 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      const activeTurns = await this.prisma.aiConversationTurn.findMany({
        where: {
          createdAt: { gte: twoHoursAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const userIds = activeTurns.map((turn) => turn.userId);
      this.logger.log(`Found ${userIds.length} users with recent conversation activity.`);

      for (const userId of userIds) {
        try {
          await this.extractProfileForUser(userId);
        } catch (err: any) {
          this.logger.error(`Failed to extract profile for user ${userId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed during AIMemoryProfile sweep: ${err.message}`);
    }
  }

  /**
   * Extract and save memory profile facts/preferences for a specific user.
   */
  async extractProfileForUser(userId: string): Promise<void> {
    const turns = await this.prisma.aiConversationTurn.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (turns.length === 0) return;

    const conversationText = turns
      .reverse()
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n');

    const prompt = `
You are a context extraction assistant. Analyze the following conversation history between the User and the AI Assistant.
Extract any long-term preferences, user habits, instructions, or direct facts the user has revealed about themselves, their work style, or their workspace.
Examples of preferences:
- "The user prefers simple weekly summaries"
- "The user is concerned with backend test coverage"
- "The user hates receiving duplicate notifications"

Format the output as a clean, list of facts (e.g. JSON array of strings). If no persistent facts or preferences are found, return an empty array [].
Do not include any greeting or conversational filler. Return ONLY the JSON array.

Conversation History:
${conversationText}
`;

    const result = await this.aiClient.chat({
      traceId: randomUUID(),
      userId,
      spaceId: 'system',
      message: prompt,
      userName: 'System Extractor',
    });

    const responseText = result?.response || '';
    let preferences: string[] = [];
    try {
      const cleaned = responseText.trim();
      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        preferences = JSON.parse(cleaned);
      } else {
        const match = cleaned.match(/\[[\s\S]*?\]/);
        if (match) {
          preferences = JSON.parse(match[0]);
        } else {
          preferences = cleaned
            .split('\n')
            .map((line: string) => line.replace(/^[-*•\d.]\s*/, '').trim())
            .filter((line: string) => line.length > 5);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse extracted preferences for user ${userId}: ${err.message}`);
    }

    if (preferences.length > 0) {
      await this.prisma.aiMemoryProfile.upsert({
        where: { userId },
        create: {
          userId,
          preferences: preferences as any,
        },
        update: {
          preferences: preferences as any,
        },
      });
      this.logger.log(`Updated memory profile with ${preferences.length} preferences for user ${userId}.`);
    }
  }

  /**
   * Fetch a user's memory profile preferences as a formatted bulleted list.
   */
  async getMemoryProfile(userId: string): Promise<string> {
    const profile = await this.prisma.aiMemoryProfile.findUnique({
      where: { userId },
    });

    if (!profile || !profile.preferences) {
      return '';
    }

    const preferencesList = profile.preferences as string[];
    if (preferencesList.length === 0) return '';

    return preferencesList.map((pref) => `- ${pref}`).join('\n');
  }
}
