import { IntegrationsService } from './integrations.service';
import { IntegrationRepository } from './repositories/integration.repository';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Queue } from 'bullmq';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

// Mock googleapis
const mockOAuth2Client = {
  generateAuthUrl: jest.fn().mockReturnValue('https://google.com/oauth-url'),
  getToken: jest.fn().mockResolvedValue({
    tokens: {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expiry_date: 123456789,
    },
  }),
  setCredentials: jest.fn(),
  on: jest.fn(),
};

const mockDriveFilesGet = jest.fn();
const mockDriveFilesWatch = jest.fn();
const mockDriveFilesList = jest.fn();
const mockDrive = {
  files: {
    get: mockDriveFilesGet,
    watch: mockDriveFilesWatch,
    list: mockDriveFilesList,
  },
};

jest.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client),
      },
      drive: jest.fn().mockImplementation(() => mockDrive),
    },
  };
});

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let integrationRepo: jest.Mocked<IntegrationRepository>;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let notificationsQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    jest.clearAllMocks();

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
        if (key === 'API_URL') {
          return 'http://test-api.mongez.com';
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

  describe('generateAuthUrl()', () => {
    it('UT-INT-GENAUTH-001: should return google auth URL', () => {
      const url = service.generateAuthUrl('user-1');
      expect(url).toBe('https://google.com/oauth-url');
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'user-1' }),
      );
    });
  });

  describe('connectGoogleDrive()', () => {
    it('UT-INT-CONNECT-001: should exchange code, encrypt, and save integration tokens', async () => {
      await service.connectGoogleDrive('user-1', 'oauth-code-123');

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('oauth-code-123');
      expect(integrationRepo.upsert).toHaveBeenCalledWith(
        'user-1',
        'google_drive',
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getDriveClient()', () => {
    it('UT-INT-CLIENT-001: should return Google Drive client with decrypted credentials', async () => {
      const encryptedAccess = service.encrypt('access-raw');
      const encryptedRefresh = service.encrypt('refresh-raw');

      integrationRepo.findByUser.mockResolvedValue({
        id: 'int-1',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(),
      } as any);

      const client = await service.getDriveClient('user-1');

      expect(client).toBeDefined();
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'access-raw',
          refresh_token: 'refresh-raw',
        }),
      );
    });

    it('UT-INT-CLIENT-002: should throw BadRequestException if drive is not connected', async () => {
      integrationRepo.findByUser.mockResolvedValue(null);

      await expect(service.getDriveClient('user-1')).rejects.toThrow(BadRequestException);
    });

    it('UT-INT-CLIENT-003: should register tokens refresh callback', async () => {
      const encryptedAccess = service.encrypt('access-raw');
      const encryptedRefresh = service.encrypt('refresh-raw');

      integrationRepo.findByUser.mockResolvedValue({
        id: 'int-1',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(),
      } as any);

      mockOAuth2Client.on.mockImplementation((event, callback) => {
        if (event === 'tokens') {
          callback({
            access_token: 'refreshed-access-token',
            expiry_date: 987654321,
          });
        }
      });

      await service.getDriveClient('user-1');

      expect(mockOAuth2Client.on).toHaveBeenCalledWith('tokens', expect.any(Function));
      expect(integrationRepo.upsert).toHaveBeenCalledWith(
        'user-1',
        'google_drive',
        expect.objectContaining({
          accessToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
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

  describe('attachDriveFile()', () => {
    let encryptedAccess: string;
    let encryptedRefresh: string;

    beforeEach(() => {
      encryptedAccess = service.encrypt('access-raw');
      encryptedRefresh = service.encrypt('refresh-raw');
    });

    it('UT-INT-ATTACH-001: should query file details, initiate watch, and create attachment record', async () => {
      integrationRepo.findByUser.mockResolvedValue({
        id: 'int-1',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(),
      } as any);

      mockDriveFilesGet.mockResolvedValue({
        data: {
          id: 'drive-f-1',
          name: 'Budget.xlsx',
          mimeType: 'application/vnd.ms-excel',
          size: '12345',
          webViewLink: 'https://drive.google.com/view/budget',
        },
      });

      mockDriveFilesWatch.mockResolvedValue({ data: {} });

      const mockCreated = {
        id: 'attach-1',
        taskId: 'task-1',
        driveFileId: 'drive-f-1',
        driveLink: 'https://drive.google.com/view/budget',
        fileName: 'Budget.xlsx',
        mimeType: 'application/vnd.ms-excel',
        size: 12345n,
        channelId: 'channel-xyz',
      };
      integrationRepo.createAttachment.mockResolvedValue(mockCreated as any);

      const result = await service.attachDriveFile('task-1', 'user-1', { driveFileId: 'drive-f-1' });

      expect(mockDriveFilesGet).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'drive-f-1' }),
      );
      expect(mockDriveFilesWatch).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'drive-f-1',
          requestBody: expect.objectContaining({
            address: 'http://test-api.mongez.com/api/v1/integrations/google/webhook',
          }),
        }),
      );
      expect(integrationRepo.createAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          driveFileId: 'drive-f-1',
          fileName: 'Budget.xlsx',
          size: 12345n,
        }),
      );
      expect(result.size).toBe(12345);
    });

    it('UT-INT-ATTACH-002: should gracefully create attachment even if watch fails', async () => {
      integrationRepo.findByUser.mockResolvedValue({
        id: 'int-1',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(),
      } as any);

      mockDriveFilesGet.mockResolvedValue({
        data: { id: 'drive-f-1', name: 'Document.docx' },
      });
      mockDriveFilesWatch.mockRejectedValue(new Error('Watch disallowed'));
      integrationRepo.createAttachment.mockResolvedValue({ id: 'attach-1', size: null } as any);

      const result = await service.attachDriveFile('task-1', 'user-1', { driveFileId: 'drive-f-1' });

      expect(integrationRepo.createAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: undefined, // watch failed
        }),
      );
      expect(result.size).toBeNull();
    });

    it('UT-INT-ATTACH-003: should throw BadRequestException if file metadata retrieval fails', async () => {
      integrationRepo.findByUser.mockResolvedValue({
        id: 'int-1',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: new Date(),
      } as any);

      mockDriveFilesGet.mockRejectedValue(new Error('Not found'));

      await expect(
        service.attachDriveFile('task-1', 'user-1', { driveFileId: 'bad-file' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAttachments()', () => {
    it('UT-INT-LIST-001: should return attachments mapped with numerical sizes', async () => {
      integrationRepo.listAttachmentsForTask.mockResolvedValue([
        { id: 'a-1', size: 100n },
        { id: 'a-2', size: null },
      ] as any);

      const result = await service.listAttachments('task-1');

      expect(result).toEqual([
        { id: 'a-1', size: 100 },
        { id: 'a-2', size: null },
      ]);
    });
  });

  describe('removeAttachment()', () => {
    it('UT-INT-REMOVE-001: should throw NotFoundException if attachment is missing', async () => {
      integrationRepo.findAttachmentById.mockResolvedValue(null);

      await expect(service.removeAttachment('attach-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('UT-INT-REMOVE-002: should throw ForbiddenException if user is not in the space', async () => {
      integrationRepo.findAttachmentById.mockResolvedValue({
        id: 'attach-1',
        taskId: 'task-1',
      } as any);

      prisma.task.findUnique.mockResolvedValue({
        board: { department: { spaceId: 'space-1' } },
      } as any);

      prisma.membership.findFirst.mockResolvedValue(null); // not a member

      await expect(service.removeAttachment('attach-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('UT-INT-REMOVE-003: should delete attachment successfully', async () => {
      integrationRepo.findAttachmentById.mockResolvedValue({
        id: 'attach-1',
        taskId: 'task-1',
      } as any);

      prisma.task.findUnique.mockResolvedValue({
        board: { department: { spaceId: 'space-1' } },
      } as any);

      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);

      await service.removeAttachment('attach-1', 'user-1');

      expect(integrationRepo.deleteAttachment).toHaveBeenCalledWith('attach-1');
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

  describe('listDriveFiles()', () => {
    it('should list Google Drive files for user', async () => {
      integrationRepo.findByUser.mockResolvedValue({
        accessToken: service.encrypt('enc-access'),
        refreshToken: service.encrypt('enc-refresh'),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      } as any);

      const mockFiles = [{ id: 'file-1', name: 'Document.pdf', mimeType: 'application/pdf' }];
      mockDriveFilesList.mockResolvedValue({ data: { files: mockFiles } });

      const result = await service.listDriveFiles('user-1', 'Document');

      expect(mockDriveFilesList).toHaveBeenCalledWith(expect.objectContaining({
        q: expect.stringContaining("name contains 'Document'"),
      }));
      expect(result).toEqual(mockFiles);
    });

    it('should throw BadRequestException if Drive API throws error', async () => {
      integrationRepo.findByUser.mockResolvedValue({
        accessToken: service.encrypt('enc-access'),
        refreshToken: service.encrypt('enc-refresh'),
        expiresAt: new Date(Date.now() + 3600 * 1000),
      } as any);

      mockDriveFilesList.mockRejectedValue(new Error('API Error'));

      await expect(service.listDriveFiles('user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
