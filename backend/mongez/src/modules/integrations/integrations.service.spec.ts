import { IntegrationsService } from './integrations.service';
import { IntegrationRepository } from './repositories/integration.repository';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Queue } from 'bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let integrationRepo: jest.Mocked<IntegrationRepository>;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let notificationsQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    integrationRepo = {
      upsert: jest.fn(),
      findByUser: jest.fn(),
      disconnect: jest.fn(),
      findAttachmentByChannel: jest.fn(),
      incrementAttachmentVersion: jest.fn(),
      createAttachment: jest.fn(),
      listAttachmentsForTask: jest.fn(),
      findAttachmentById: jest.fn(),
      deleteAttachment: jest.fn(),
    } as any;

    config = {
      get: jest.fn((key) => {
        if (key === 'INTEGRATION_ENCRYPTION_KEY') {
          return 'super-secret-encryption-key-32ch';
        }
        return null;
      }),
    } as any;

    prisma = {
      task: {
        findUnique: jest.fn(),
      },
      membership: {
        findFirst: jest.fn(),
      },
      watcher: {
        findMany: jest.fn(),
      },
    } as any;

    notificationsQueue = {
      add: jest.fn(),
    } as any;

    service = new IntegrationsService(
      integrationRepo,
      config,
      prisma,
      notificationsQueue,
    );
  });

  describe('Encryption/Decryption', () => {
    it('should correctly encrypt and decrypt text', () => {
      const plaintext = 'ya29.a0AfB_byE_mock_google_token';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toContain(':');
      
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('getStatus()', () => {
    it('should return connected state as true if integration exists', async () => {
      integrationRepo.findByUser.mockResolvedValue({ id: 'int-1' } as any);
      const result = await service.getStatus('user-1');
      expect(result.googleDrive).toBe(true);
    });

    it('should return connected state as false if integration does not exist', async () => {
      integrationRepo.findByUser.mockResolvedValue(null);
      const result = await service.getStatus('user-1');
      expect(result.googleDrive).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect Google Drive connection successfully', async () => {
      integrationRepo.disconnect.mockResolvedValue({} as any);
      await service.disconnect('user-1');
      expect(integrationRepo.disconnect).toHaveBeenCalledWith('user-1', 'google_drive');
    });

    it('should throw NotFoundException if connection does not exist', async () => {
      integrationRepo.disconnect.mockRejectedValue(new Error('Record not found'));
      await expect(service.disconnect('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleDriveWebhook()', () => {
    it('should process change notifications, increment version and notify watchers', async () => {
      const mockAttachment = { id: 'attach-1', taskId: 'task-1', fileName: 'document.gdoc' };
      integrationRepo.findAttachmentByChannel.mockResolvedValue(mockAttachment as any);
      prisma.watcher.findMany.mockResolvedValue([{ userId: 'user-watcher' }] as any);

      const headers = {
        'x-goog-channel-id': 'channel-1',
        'x-goog-resource-state': 'change',
      };

      await service.handleDriveWebhook(headers);

      expect(integrationRepo.incrementAttachmentVersion).toHaveBeenCalledWith('attach-1');
      expect(notificationsQueue.add).toHaveBeenCalled();
    });
  });
});
