import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class IntegrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    provider: string,
    data: { accessToken: string; refreshToken: string; expiresAt: Date },
  ) {
    return this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
      create: {
        userId,
        provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByUser(userId: string, provider: string) {
    return this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  async disconnect(userId: string, provider: string) {
    return this.prisma.integration.delete({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  async findAttachmentByChannel(channelId: string) {
    return this.prisma.driveAttachment.findFirst({
      where: { channelId },
    });
  }

  async incrementAttachmentVersion(attachmentId: string) {
    return this.prisma.driveAttachment.update({
      where: { id: attachmentId },
      data: { version: { increment: 1 } },
    });
  }

  async createAttachment(data: {
    taskId: string;
    driveFileId: string;
    driveLink: string;
    fileName: string;
    mimeType: string;
    size?: bigint;
    channelId?: string;
    watchExpiry?: Date;
  }) {
    return this.prisma.driveAttachment.create({
      data,
    });
  }

  async listAttachmentsForTask(taskId: string) {
    return this.prisma.driveAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAttachmentById(id: string) {
    return this.prisma.driveAttachment.findUnique({
      where: { id },
    });
  }

  async deleteAttachment(id: string) {
    return this.prisma.driveAttachment.delete({
      where: { id },
    });
  }
}
