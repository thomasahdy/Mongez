import { Injectable } from '@nestjs/common';
import { AttachmentProvider, EmbeddingStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FileFilterDto } from './dto/file-filter.dto';

/**
 * FileRepository — data access for Attachment + FileVersion.
 * All queries are scoped to a taskId whose board belongs to a tenant space,
 * enforced by TaskAccessGuard before these methods are reached.
 */
@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForTask(taskId: string, filters: FileFilterDto) {
    const pageNum = Number(filters.page || 1);
    const limitNum = Number(filters.limit || 20);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      taskId,
      ...(filters.mimeType ? { mimeType: { contains: filters.mimeType } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          versions: { orderBy: { versionNum: 'desc' }, take: 1 },
        },
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.attachment.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNum: 'desc' } } },
    });
  }

  async findByStorageKey(key: string) {
    return this.prisma.fileVersion.findFirst({
      where: { storageKey: key },
      include: { attachment: true },
    });
  }

  async createWithVersion(data: {
    taskId: string;
    spaceId: string;
    fileName: string;
    mimeType: string;
    uploadedById: string;
    storageKey: string;
    fileSize: number;
    checksum?: string;
    provider?: AttachmentProvider;
    externalUrl?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          taskId: data.taskId,
          spaceId: data.spaceId,
          fileName: data.fileName,
          mimeType: data.mimeType,
          uploadedById: data.uploadedById,
        },
      });

      const version = await tx.fileVersion.create({
        data: {
          attachmentId: attachment.id,
          storageKey: data.storageKey,
          versionNum: 1,
          fileSize: BigInt(data.fileSize),
          uploadedById: data.uploadedById,
          checksum: data.checksum || null,
          provider: data.provider || AttachmentProvider.LOCAL,
          externalUrl: data.externalUrl || null,
          embeddingStatus: EmbeddingStatus.PENDING,
        },
      });

      await tx.attachment.update({
        where: { id: attachment.id },
        data: { currentVersionId: version.id },
      });

      return { attachment, version };
    });
  }

  async addVersion(
    attachmentId: string,
    data: {
      storageKey: string;
      fileSize: number;
      uploadedById: string;
      checksum?: string;
      provider?: AttachmentProvider;
      externalUrl?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.fileVersion.findFirst({
        where: { attachmentId },
        orderBy: { versionNum: 'desc' },
      });
      const versionNum = (latest?.versionNum ?? 0) + 1;

      const version = await tx.fileVersion.create({
        data: {
          attachmentId,
          versionNum,
          storageKey: data.storageKey,
          fileSize: BigInt(data.fileSize),
          uploadedById: data.uploadedById,
          checksum: data.checksum || null,
          provider: data.provider || AttachmentProvider.LOCAL,
          externalUrl: data.externalUrl || null,
          embeddingStatus: EmbeddingStatus.PENDING,
        },
      });

      await tx.attachment.update({
        where: { id: attachmentId },
        data: { currentVersionId: version.id },
      });

      return version;
    });
  }

  async softDelete(id: string) {
    // Mark deleted by clearing currentVersionId; blob retained for 30 days.
    return this.prisma.attachment.update({
      where: { id },
      data: { currentVersionId: null },
    });
  }

  async updateEmbeddingStatus(versionId: string, status: EmbeddingStatus) {
    return this.prisma.fileVersion.update({
      where: { id: versionId },
      data: { embeddingStatus: status },
    });
  }
}