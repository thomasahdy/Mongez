import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../storage-provider.interface';
import { StorageUploadResult } from '../storage.service';

@Injectable()
export class GoogleDriveStorageProvider implements StorageProvider {
  private readonly logger = new Logger(GoogleDriveStorageProvider.name);

  constructor(private readonly config: ConfigService) {}

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    this.logger.debug(`[Google Drive stub] upload ${key} (${mimeType}, ${buffer.length} bytes)`);
    return { key, size: buffer.length, mimeType };
  }

  async download(key: string): Promise<Buffer> {
    this.logger.debug(`[Google Drive stub] download ${key}`);
    return Buffer.alloc(0);
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`[Google Drive stub] delete ${key}`);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    return `${appUrl}/files/key/${encodeURIComponent(key)}/download?provider=google-drive`;
  }

  async exists(key: string): Promise<boolean> {
    this.logger.debug(`[Google Drive stub] check exists ${key}`);
    return true;
  }
}
