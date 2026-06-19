import { FilesService, UploadedFile } from './files.service';
import { FileRepository } from './file.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { VirusScannerService } from '../../infrastructure/scanners/virus-scanner.service';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('FilesService', () => {
  let service: FilesService;
  let fileRepo: jest.Mocked<FileRepository>;
  let storage: jest.Mocked<StorageService>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let virusScanner: jest.Mocked<VirusScannerService>;
  let subscriptions: jest.Mocked<SubscriptionsService>;
  let aiQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    fileRepo = {
      createWithVersion: jest.fn(),
      findById: jest.fn(),
      findByStorageKey: jest.fn(),
      listForTask: jest.fn(),
      addVersion: jest.fn(),
      softDelete: jest.fn(),
    } as any;

    storage = {
      buildKey: jest.fn(),
      upload: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
      getSignedUrl: jest.fn(),
      exists: jest.fn(),
    } as any;

    realtimeService = {
      emitToUser: jest.fn(),
    } as any;

    config = {
      get: jest.fn().mockReturnValue(25), // 25MB max
    } as any;

    prisma = {
      membership: {
        findFirst: jest.fn(),
      },
    } as any;

    virusScanner = {
      scan: jest.fn(),
    } as any;

    subscriptions = {
      recordUsage: jest.fn(),
    } as any;

    aiQueue = {
      add: jest.fn(),
    } as any;

    service = new FilesService(
      fileRepo,
      storage,
      realtimeService,
      config,
      prisma,
      virusScanner,
      subscriptions,
      aiQueue,
    );
  });

  describe('upload()', () => {
    const mockFile: UploadedFile = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1000,
      buffer: Buffer.from('hello world'),
    };

    it('should upload a clean file successfully', async () => {
      virusScanner.scan.mockResolvedValue({ clean: true });
      storage.buildKey.mockReturnValue('space-1/task/task-1/uuid.pdf');
      storage.upload.mockResolvedValue({ key: 'space-1/task/task-1/uuid.pdf', size: 1000, mimeType: 'application/pdf' });
      
      const mockAttachment = {
        id: 'attach-1',
        spaceId: 'space-1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        uploadedById: 'user-1',
        versions: [
          {
            id: 'v-1',
            fileSize: 1000n,
          },
        ],
      };
      
      fileRepo.createWithVersion.mockResolvedValue({
        attachment: mockAttachment as any,
        version: {} as any,
      });

      const result = await service.upload(mockFile, 'task-1', 'user-1', 'space-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('attach-1');
      expect(result.versions[0].fileSize).toBe(1000); // serialized to number
      expect(virusScanner.scan).toHaveBeenCalledWith(mockFile.buffer, mockFile.originalname);
      expect(subscriptions.recordUsage).toHaveBeenCalledWith('space-1', 'STORAGE_MB', 1);
      expect(aiQueue.add).toHaveBeenCalled();
    });

    it('should throw BadRequestException if file is infected', async () => {
      virusScanner.scan.mockResolvedValue({ clean: false, detail: 'Infected with test virus' });

      await expect(service.upload(mockFile, 'task-1', 'user-1', 'space-1')).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl()', () => {
    it('should return download URL if user is a member of the space', async () => {
      const mockAttachment = {
        id: 'attach-1',
        spaceId: 'space-1',
        currentVersionId: 'v-1',
        versions: [{ id: 'v-1', storageKey: 'space-1/task/task-1/key.pdf' }],
      };
      fileRepo.findById.mockResolvedValue(mockAttachment as any);
      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);
      storage.getSignedUrl.mockResolvedValue('https://signed-url.com');

      const result = await service.getDownloadUrl('attach-1', 'user-1');

      expect(result).toBe('https://signed-url.com');
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', spaceId: 'space-1' },
      });
    });

    it('should throw ForbiddenException if user is not a member of the space', async () => {
      const mockAttachment = {
        id: 'attach-1',
        spaceId: 'space-1',
        currentVersionId: 'v-1',
        versions: [{ id: 'v-1', storageKey: 'space-1/task/task-1/key.pdf' }],
      };
      fileRepo.findById.mockResolvedValue(mockAttachment as any);
      prisma.membership.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl('attach-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('downloadByKey()', () => {
    it('should return file buffer if user is authorized', async () => {
      const mockVersion = {
        id: 'v-1',
        storageKey: 'key-123',
        attachment: {
          id: 'attach-1',
          spaceId: 'space-1',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
        },
      };
      fileRepo.findByStorageKey.mockResolvedValue(mockVersion as any);
      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);
      storage.download.mockResolvedValue(Buffer.from('hello'));

      const result = await service.downloadByKey('key-123', 'user-1');

      expect(result.buffer.toString()).toBe('hello');
      expect(result.fileName).toBe('test.pdf');
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
      const mockVersion = {
        id: 'v-1',
        storageKey: 'key-123',
        attachment: {
          id: 'attach-1',
          spaceId: 'space-1',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
        },
      };
      fileRepo.findByStorageKey.mockResolvedValue(mockVersion as any);
      prisma.membership.findFirst.mockResolvedValue(null);

      await expect(service.downloadByKey('key-123', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should allow download with valid signature and future expiry without space check', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'APP_SECRET') return 'test-secret';
        return 25;
      });

      const key = 'key-123';
      const expires = String(Math.floor(Date.now() / 1000) + 3600);
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(`${key}:${expires}`)
        .digest('hex');

      const mockVersion = {
        id: 'v-1',
        storageKey: 'key-123',
        attachment: {
          id: 'attach-1',
          spaceId: 'space-1',
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
        },
      };
      fileRepo.findByStorageKey.mockResolvedValue(mockVersion as any);
      storage.download.mockResolvedValue(Buffer.from('signed-content'));

      const result = await service.downloadByKey(key, undefined, expires, signature);

      expect(result.buffer.toString()).toBe('signed-content');
      expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException with invalid signature', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'APP_SECRET') return 'test-secret';
        return 25;
      });

      const key = 'key-123';
      const expires = String(Math.floor(Date.now() / 1000) + 3600);
      const signature = 'invalid-signature-hash';

      await expect(service.downloadByKey(key, undefined, expires, signature)).rejects.toThrow(
        new ForbiddenException('Invalid download signature'),
      );
    });

    it('should throw ForbiddenException with expired signature link', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'APP_SECRET') return 'test-secret';
        return 25;
      });

      const key = 'key-123';
      const expires = String(Math.floor(Date.now() / 1000) - 100); // 100s in the past
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(`${key}:${expires}`)
        .digest('hex');

      await expect(service.downloadByKey(key, undefined, expires, signature)).rejects.toThrow(
        new ForbiddenException('Download link has expired'),
      );
    });
  });
});
