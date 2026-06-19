import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Persistence layer for WhatsApp entities (accounts, contacts, messages).
 * The account `accessToken` is stored encrypted; callers handle de/encryption.
 */
@Injectable()
export class WhatsAppRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Accounts ───────────────────────────────────────────────────

  findActiveAccountBySpace(spaceId: string) {
    return this.prisma.whatsAppAccount.findUnique({ where: { spaceId } });
  }

  findByPhoneNumberId(phoneNumberId: string) {
    return this.prisma.whatsAppAccount.findFirst({ where: { phoneNumberId } });
  }

  upsertAccount(
    spaceId: string,
    data: {
      phoneNumberId: string;
      wabaId: string;
      accessToken: string;
      displayName: string;
      webhookSecret?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.prisma.whatsAppAccount.upsert({
      where: { spaceId },
      update: {
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessToken: data.accessToken,
        displayName: data.displayName,
        ...(data.webhookSecret !== undefined
          ? { webhookSecret: data.webhookSecret }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      create: {
        spaceId,
        phoneNumberId: data.phoneNumberId,
        wabaId: data.wabaId,
        accessToken: data.accessToken,
        displayName: data.displayName,
        webhookSecret: data.webhookSecret,
        isActive: data.isActive ?? true,
      },
    });
  }

  // ── Contacts ───────────────────────────────────────────────────

  findContact(userId: string, spaceId: string) {
    return this.prisma.whatsAppContact.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
    });
  }

  findContactByPhone(phoneNumber: string, spaceId: string) {
    return this.prisma.whatsAppContact.findFirst({
      where: { phoneNumber, spaceId },
    });
  }

  findContactByWaId(waId: string) {
    return this.prisma.whatsAppContact.findFirst({ where: { waId } });
  }

  upsertContact(
    userId: string,
    spaceId: string,
    data: {
      phoneNumber: string;
      waId?: string | null;
      isVerified?: boolean;
      optedIn?: boolean;
    },
  ) {
    return this.prisma.whatsAppContact.upsert({
      where: { userId_spaceId: { userId, spaceId } },
      update: {
        phoneNumber: data.phoneNumber,
        ...(data.waId !== undefined ? { waId: data.waId } : {}),
        ...(data.isVerified !== undefined
          ? { isVerified: data.isVerified }
          : {}),
        ...(data.optedIn !== undefined ? { optedIn: data.optedIn } : {}),
      },
      create: {
        userId,
        spaceId,
        phoneNumber: data.phoneNumber,
        waId: data.waId,
        isVerified: data.isVerified ?? false,
        optedIn: data.optedIn ?? true,
      },
    });
  }

  /** Link a verified waId to an existing contact by phone (from inbound). */
  updateContactWaId(id: string, waId: string, isVerified = true) {
    return this.prisma.whatsAppContact.update({
      where: { id },
      data: { waId, isVerified },
    });
  }

  // ── Messages ───────────────────────────────────────────────────

  createMessage(data: {
    spaceId: string;
    direction: string;
    fromPhone: string;
    toPhone: string;
    content: string;
    waMessageId?: string | null;
    templateName?: string | null;
    mediaUrl?: string | null;
    status?: string;
    metadata?: any;
  }) {
    return this.prisma.whatsAppMessage.create({ data });
  }

  findByWaMessageId(waMessageId: string) {
    return this.prisma.whatsAppMessage.findUnique({ where: { waMessageId } });
  }

  updateMessage(
    id: string,
    data: Partial<{
      status: string;
      waMessageId: string | null;
      errorCode: string | null;
      metadata: any;
    }>,
  ) {
    return this.prisma.whatsAppMessage.update({ where: { id }, data });
  }

  updateMessageByWaId(
    waMessageId: string,
    data: Partial<{ status: string; errorCode: string | null; metadata: any }>,
  ) {
    return this.prisma.whatsAppMessage.updateMany({
      where: { waMessageId },
      data,
    });
  }
}
