import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { extname } from 'path';
import * as crypto from 'crypto';
import { FileRepository } from './file.repository';
import { FileFilterDto } from './dto/file-filter.dto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { VirusScannerService } from '../../infrastructure/scanners/virus-scanner.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { paginate } from '../../shared/dto/pagination.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  isExpiredStorageSignature,
  isValidStorageSignature,
} from '../../infrastructure/storage/storage-signature.util';

/** Minimal shape of an uploaded file (works with or without @types/multer). */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

// Allowlisted MIME type prefixes / exact types.
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'text/',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument',
];

const MAX_FILE_SIZE_MB = 25;

@Injectable()
export class FilesService {
  private readonly maxBytes: number;

  constructor(
    private readonly fileRepo: FileRepository,
    private readonly storage: StorageService,
    private readonly realtimeService: RealtimeService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly virusScanner: VirusScannerService,
    private readonly subscriptions: SubscriptionsService,
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
  ) {
    this.maxBytes =
      (this.config.get<number>('FILE_MAX_SIZE_MB') ?? MAX_FILE_SIZE_MB) * 1024 * 1024;
  }

  async upload(
    file: UploadedFile,
    taskId: string,
    uploadedById: string,
    spaceId: string,
  ) {
    this.validate(file);

    // Virus scan check
    const scanResult = await this.virusScanner.scan(file.buffer, file.originalname);
    if (!scanResult.clean) {
      throw new BadRequestException(`File validation failed: Virus detected: ${scanResult.detail}`);
    }

    // Generate SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const storageKey = this.storage.buildKey(spaceId, 'task', taskId, file.originalname);
    const { size } = await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const { attachment } = await this.fileRepo.createWithVersion({
      taskId,
      spaceId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      uploadedById,
      storageKey: storageKey,
      fileSize: size,
      checksum,
    });

    // Queue RAG incremental indexing (Python service consumes this).
    await this.aiQueue.add(
      JOB_NAMES.AI_INDEX_DOCUMENT,
      {
        spaceId,
        taskId,
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        storageKey: storageKey,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    // Record storage usage in MB
    const sizeInMb = Math.ceil(size / (1024 * 1024));
    await this.subscriptions.recordUsage(spaceId, 'STORAGE_MB', sizeInMb);

    const serializedAttachment = this.serializeAttachment(attachment);

    this.realtimeService.emitToUser(uploadedById, 'file:uploaded', {
      attachment: serializedAttachment,
      taskId,
    });

    return serializedAttachment;
  }

  async listForTask(taskId: string, filters: FileFilterDto) {
    const { data, total } = await this.fileRepo.listForTask(taskId, filters);

    const enriched = await Promise.all(
      data.map(async (a) => {
        const latestVersion = a.versions?.[0];
        const url =
          latestVersion != null
            ? await this.storage.getSignedUrl(latestVersion.storageKey)
            : null;
        return this.serializeAttachment({ ...a, downloadUrl: url });
      }),
    );

    return paginate(enriched, total, filters.page, filters.limit);
  }

  async getDownloadUrl(fileId: string, userId: string) {
    const attachment = await this.fileRepo.findById(fileId);
    if (!attachment) throw new NotFoundException('File not found');
    if (!attachment.currentVersionId) throw new NotFoundException('File has been deleted');

    // Multi-tenant permission validation
    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId: attachment.spaceId },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const version = attachment.versions.find((v) => v.id === attachment.currentVersionId);
    if (!version) throw new NotFoundException('Current version not found');

    return this.storage.getSignedUrl(version.storageKey);
  }

  async downloadByKey(key: string, userId?: string, expires?: string, signature?: string) {
    const isAvatarKey = key.startsWith('avatars/');

    if (expires && signature) {
      if (!isValidStorageSignature(this.config, key, expires, signature)) {
        throw new ForbiddenException('Invalid download signature');
      }

      if (isExpiredStorageSignature(expires)) {
        throw new ForbiddenException('Download link has expired');
      }
    } else {
      if (!userId) {
        throw new ForbiddenException('Authentication required to access this file');
      }

      if (!isAvatarKey) {
        const record = await this.fileRepo.findByStorageKey(key);
        if (!record) throw new NotFoundException('File not found');
        if (!record.attachment) throw new NotFoundException('Attachment not found');

        const membership = await this.prisma.membership.findFirst({
          where: { userId, spaceId: record.attachment.spaceId },
        });
        if (!membership) {
          throw new ForbiddenException('You do not have access to this file');
        }
      }
    }

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(key);
    } catch {
      throw new NotFoundException('File not found in storage');
    }

    const record = isAvatarKey ? null : await this.fileRepo.findByStorageKey(key);
    const fileName = record?.attachment?.fileName || key.split('/').pop() || 'download';
    const mimeType = record?.attachment?.mimeType || this.inferMimeType(fileName);

    return {
      buffer,
      fileName,
      mimeType,
    };
  }

  async getVersions(fileId: string) {
    const attachment = await this.fileRepo.findById(fileId);
    if (!attachment) throw new NotFoundException('File not found');
    return attachment.versions.map((v) => ({
      ...v,
      fileSize: v.fileSize != null ? Number(v.fileSize) : undefined,
    }));
  }

  async softDelete(fileId: string, userId: string) {
    const attachment = await this.fileRepo.findById(fileId);
    if (!attachment) throw new NotFoundException('File not found');
    
    // Check permission
    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId: attachment.spaceId },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this space');
    }

    if (attachment.uploadedById !== userId) {
      throw new ForbiddenException('Only the uploader can delete this file');
    }
    await this.fileRepo.softDelete(fileId);
  }

  private validate(file: UploadedFile) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size of ${this.maxBytes / (1024 * 1024)}MB`,
      );
    }
    const allowed = ALLOWED_MIME_PREFIXES.some(
      (p) => file.mimetype === p || file.mimetype.startsWith(p),
    );
    if (!allowed) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }
    const ext = extname(file.originalname).toLowerCase();
    if (!ext) {
      throw new BadRequestException('File must have an extension');
    }
  }

  private inferMimeType(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
  }

  private serializeAttachment(attachment: any) {
    if (!attachment) return attachment;
    const copy = { ...attachment };
    if (copy.versions) {
      copy.versions = copy.versions.map((v: any) => ({
        ...v,
        fileSize: v.fileSize != null ? Number(v.fileSize) : undefined,
      }));
    }
    return copy;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeSoftDeletedFiles() {
    try {
      const versions = await this.prisma.fileVersion.findMany({
        where: {
          attachment: {
            currentVersionId: null,
          },
        },
        select: { id: true, storageKey: true, attachmentId: true },
      });

      if (!versions.length) return;

      for (const v of versions) {
        await this.storage.delete(v.storageKey).catch(() => {});
      }

      const attachmentIds = Array.from(new Set(versions.map((v) => v.attachmentId)));

      await this.prisma.$transaction(async (tx) => {
        await tx.fileVersion.deleteMany({
          where: {
            id: { in: versions.map((v) => v.id) },
          },
        });
        await tx.attachment.deleteMany({
          where: {
            id: { in: attachmentIds },
          },
        });
      });
    } catch (err) {
      console.error('Failed to run daily file purge', err);
    }
  }
}
