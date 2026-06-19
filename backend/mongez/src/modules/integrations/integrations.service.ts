import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationRepository } from './repositories/integration.repository';
import { AttachDriveFileDto } from './dto/attach-drive-file.dto';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly integrationRepo: IntegrationRepository,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  private getEncryptionKey(): Buffer {
    const key = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') || 'dev-encryption-key-32-chars-long';
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encrypted: string): string {
    const [ivHex, data] = encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getOAuthClient() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') || 'mock-client-id';
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') || 'mock-client-secret';
    const redirectUrl = this.config.get<string>('GOOGLE_DRIVE_CALLBACK_URL') || 'http://localhost:3000/api/v1/integrations/google/callback';
    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
  }

  generateAuthUrl(userId: string): string {
    const oauth2Client = this.getOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ],
      state: userId,
    });
  }

  async connectGoogleDrive(userId: string, code: string) {
    const oauth2Client = this.getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const accessToken = this.encrypt(tokens.access_token!);
    const refreshToken = this.encrypt(tokens.refresh_token!);
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

    await this.integrationRepo.upsert(userId, 'google_drive', {
      accessToken,
      refreshToken,
      expiresAt,
    });
  }

  async getDriveClient(userId: string) {
    const integration = await this.integrationRepo.findByUser(userId, 'google_drive');
    if (!integration) {
      throw new BadRequestException('Google Drive not connected');
    }

    const accessToken = this.decrypt(integration.accessToken);
    const refreshToken = this.decrypt(integration.refreshToken);

    const oauth2Client = this.getOAuthClient();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: integration.expiresAt.getTime(),
    });

    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        const encryptedAccess = this.encrypt(tokens.access_token);
        const encryptedRefresh = tokens.refresh_token ? this.encrypt(tokens.refresh_token) : integration.refreshToken;
        const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

        await this.integrationRepo.upsert(userId, 'google_drive', {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt,
        });
      }
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  async getStatus(userId: string) {
    const integration = await this.integrationRepo.findByUser(userId, 'google_drive');
    return {
      googleDrive: !!integration,
    };
  }

  async disconnect(userId: string) {
    try {
      await this.integrationRepo.disconnect(userId, 'google_drive');
    } catch (err) {
      throw new NotFoundException('Google Drive connection not found');
    }
  }

  async attachDriveFile(taskId: string, userId: string, dto: AttachDriveFileDto) {
    const driveClient = await this.getDriveClient(userId);
    
    let fileMeta;
    try {
      fileMeta = await driveClient.files.get({
        fileId: dto.driveFileId,
        fields: 'id,name,mimeType,size,webViewLink',
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to retrieve file from Google Drive: ${err.message}`);
    }

    const { id: driveFileId, name: fileName, mimeType, size, webViewLink } = fileMeta.data;

    let channelId: string | undefined;
    let watchExpiry: Date | undefined;
    try {
      channelId = crypto.randomUUID();
      watchExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const apiUrl = this.config.get<string>('API_URL') || 'http://localhost:3000';
      await driveClient.files.watch({
        fileId: dto.driveFileId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: `${apiUrl}/api/v1/integrations/google/webhook`,
          expiration: String(watchExpiry.getTime()),
        },
      });
    } catch {
      channelId = undefined;
      watchExpiry = undefined;
    }

    const attachment = await this.integrationRepo.createAttachment({
      taskId,
      driveFileId: driveFileId!,
      driveLink: webViewLink || '',
      fileName: fileName || 'google-drive-file',
      mimeType: mimeType || 'application/octet-stream',
      size: size ? BigInt(size) : undefined,
      channelId,
      watchExpiry,
    });

    return {
      ...attachment,
      size: attachment.size ? Number(attachment.size) : null,
    };
  }

  async listAttachments(taskId: string) {
    const attachments = await this.integrationRepo.listAttachmentsForTask(taskId);
    return attachments.map((a) => ({
      ...a,
      size: a.size ? Number(a.size) : null,
    }));
  }

  async removeAttachment(id: string, userId: string) {
    const attachment = await this.integrationRepo.findAttachmentById(id);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: attachment.taskId },
      select: { board: { select: { department: { select: { spaceId: true } } } } },
    });

    if (task) {
      const spaceId = task.board.department.spaceId;
      const membership = await this.prisma.membership.findFirst({
        where: { userId, spaceId },
      });
      if (!membership) {
        throw new ForbiddenException('You do not have access to this space');
      }
    }

    await this.integrationRepo.deleteAttachment(id);
  }

  async handleDriveWebhook(headers: Record<string, string>) {
    const channelId = headers['x-goog-channel-id'];
    const resourceState = headers['x-goog-resource-state'];

    if (resourceState !== 'change' && resourceState !== 'update') return;

    const attachment = await this.integrationRepo.findAttachmentByChannel(channelId);
    if (!attachment) return;

    await this.integrationRepo.incrementAttachmentVersion(attachment.id);

    const watchers = await this.prisma.watcher.findMany({
      where: { taskId: attachment.taskId },
    });

    await Promise.all(
      watchers.map((w) =>
        this.notificationsQueue.add(JOB_NAMES.SEND_NOTIFICATION, {
          userId: w.userId,
          type: 'FILE_UPLOADED',
          title: 'File Updated',
          body: `"${attachment.fileName}" was updated in Google Drive`,
          deepLink: `/tasks/${attachment.taskId}`,
        }),
      ),
    );
  }
}
