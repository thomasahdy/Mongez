import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { StorageProvider } from './storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GoogleDriveStorageProvider } from './providers/google-drive.provider';

export interface StorageUploadResult {
  key: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService implements StorageProvider {
  private readonly logger = new Logger(StorageService.name);
  private activeProvider: StorageProvider;

  constructor(private readonly config: ConfigService) {}

  private getProvider(): StorageProvider {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    const providerName = this.config.get<string>('STORAGE_PROVIDER', 'local');
    if (providerName === 's3') {
      this.activeProvider = new S3StorageProvider(this.config);
    } else if (providerName === 'google-drive') {
      this.activeProvider = new GoogleDriveStorageProvider(this.config);
    } else {
      this.activeProvider = new LocalStorageProvider(this.config);
    }
    this.logger.log(`StorageService resolved active provider dynamically: ${providerName}`);
    return this.activeProvider;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    return this.getProvider().upload(key, buffer, mimeType);
  }

  async download(key: string): Promise<Buffer> {
    return this.getProvider().download(key);
  }

  async delete(key: string): Promise<void> {
    return this.getProvider().delete(key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.getProvider().getSignedUrl(key, expiresInSeconds);
  }

  async exists(key: string): Promise<boolean> {
    return this.getProvider().exists(key);
  }

  buildKey(spaceId: string, entityType: string, entityId: string, fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const uuid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    return `${spaceId}/${entityType}/${entityId}/${uuid}${ext}`;
  }
}