import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Persistence layer for Telegram entities (accounts, contacts, messages).
 * The account `botToken` is stored encrypted; callers handle de/encryption.
 */
@Injectable()
export class TelegramRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Accounts ───────────────────────────────────────────────────

  findActiveAccountBySpace(spaceId: string) {
    return this.prisma.telegramAccount.findUnique({ where: { spaceId } });
  }

  findActiveAccountByPathId(webhookPathId: string) {
    return this.prisma.telegramAccount.findUnique({
      where: { webhookPathId },
    });
  }

  updateAccountWebhookPathId(id: string, webhookPathId: string) {
    return this.prisma.telegramAccount.update({
      where: { id },
      data: { webhookPathId },
    });
  }

  findAllActiveAccounts() {
    return this.prisma.telegramAccount.findMany({ where: { isActive: true } });
  }

  findAllActiveAccountSpaces(): Promise<Array<{ spaceId: string }>> {
    return this.prisma.telegramAccount.findMany({
      where: { isActive: true },
      select: { spaceId: true },
    });
  }

  async findAllSpaceIds(): Promise<string[]> {
    const spaces = await this.prisma.space.findMany({ select: { id: true } });
    return spaces.map((s) => s.id);
  }

  upsertAccount(
    spaceId: string,
    data: { botToken?: string; botUsername?: string; isActive?: boolean },
  ) {
    return this.prisma.telegramAccount.upsert({
      where: { spaceId },
      update: {
        ...(data.botToken !== undefined ? { botToken: data.botToken } : {}),
        ...(data.botUsername !== undefined ? { botUsername: data.botUsername } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      create: {
        spaceId,
        botToken: data.botToken ?? '',
        botUsername: data.botUsername ?? '',
        isActive: data.isActive ?? true,
      },
    });
  }

  // ── Contacts ───────────────────────────────────────────────────

  findContact(userId: string, spaceId: string) {
    return this.prisma.telegramContact.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
    });
  }

  findContactByChat(chatId: string, spaceId: string) {
    return this.prisma.telegramContact.findUnique({
      where: { chatId_spaceId: { chatId, spaceId } },
    });
  }

  findContactByUsername(username: string, spaceId: string) {
    return this.prisma.telegramContact.findFirst({
      where: { username, spaceId },
    });
  }

  upsertContact(
    userId: string,
    spaceId: string,
    data: {
      chatId: string;
      username?: string | null;
      isVerified?: boolean;
      optedIn?: boolean;
    },
  ) {
    return this.prisma.telegramContact.upsert({
      where: { userId_spaceId: { userId, spaceId } },
      update: {
        chatId: data.chatId,
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.isVerified !== undefined
          ? { isVerified: data.isVerified }
          : {}),
        ...(data.optedIn !== undefined ? { optedIn: data.optedIn } : {}),
      },
      create: {
        userId,
        spaceId,
        chatId: data.chatId,
        username: data.username,
        isVerified: data.isVerified ?? false,
        optedIn: data.optedIn ?? true,
      },
    });
  }

  updateContactChat(
    id: string,
    chatId: string,
    username?: string | null,
    isVerified = true,
  ) {
    return this.prisma.telegramContact.update({
      where: { id },
      data: { chatId, username, isVerified },
    });
  }

  async findUnlinkedInboundChats(spaceId: string): Promise<Array<{ chatId: string; username: string | null; content: string; createdAt: Date }>> {
    const linkedContacts = await this.prisma.telegramContact.findMany({
      where: { spaceId, isVerified: true, optedIn: true },
      select: { chatId: true },
    });
    const linkedChatIds = linkedContacts.map(c => c.chatId);

    const recentMessages = await this.prisma.telegramMessage.findMany({
      where: {
        spaceId,
        direction: 'INBOUND',
        chatId: { notIn: linkedChatIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const uniqueChats: Array<{ chatId: string; username: string | null; content: string; createdAt: Date }> = [];
    const seenChatIds = new Set<string>();

    for (const msg of recentMessages) {
      if (!seenChatIds.has(msg.chatId)) {
        seenChatIds.add(msg.chatId);
        const meta = (msg.metadata as Record<string, any>) || {};
        uniqueChats.push({
          chatId: msg.chatId,
          username: meta.username || null,
          content: msg.content,
          createdAt: msg.createdAt,
        });
      }
    }

    return uniqueChats.slice(0, 10);
  }

  // ── Messages ───────────────────────────────────────────────────

  createMessage(data: {
    spaceId: string;
    direction: string;
    chatId: string;
    content: string;
    tgMessageId?: number | null;
    status?: string;
    metadata?: any;
  }) {
    return this.prisma.telegramMessage.create({ data });
  }

  updateMessage(
    id: string,
    data: Partial<{ status: string; errorCode: string | null; metadata: any }>,
  ) {
    return this.prisma.telegramMessage.update({ where: { id }, data });
  }
}
