import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../storage-provider.interface';
import { StorageUploadResult } from '../storage.service';
import { buildPublicStorageUrl } from '../storage-url.util';
import { createSignedStoragePath } from '../storage-signature.util';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('STORAGE_S3_BUCKET');
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    this.logger.debug(`[S3 stub] upload ${key} (${mimeType}, ${buffer.length} bytes) to bucket: ${this.bucket}`);
    return { key, size: buffer.length, mimeType };
  }

  async download(key: string): Promise<Buffer> {
    this.logger.debug(`[S3 stub] download ${key} from bucket: ${this.bucket}`);
    return Buffer.alloc(0);
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`[S3 stub] delete ${key} from bucket: ${this.bucket}`);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return buildPublicStorageUrl(
      this.config,
      createSignedStoragePath(this.config, key, expiresInSeconds),
    );
  }

  async exists(key: string): Promise<boolean> {
    this.logger.debug(`[S3 stub] check exists ${key} in bucket: ${this.bucket}`);
    return true;
  }
}
