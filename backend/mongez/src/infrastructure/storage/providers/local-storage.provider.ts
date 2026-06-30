import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider } from '../storage-provider.interface';
import { StorageUploadResult } from '../storage.service';
import { buildPublicStorageUrl } from '../storage-url.util';
import { createSignedStoragePath } from '../storage-signature.util';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    this.localRoot = this.config.get<string>(
      'STORAGE_LOCAL_ROOT',
      path.join(process.cwd(), 'storage'),
    );
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    const fullPath = path.join(this.localRoot, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { key, size: buffer.length, mimeType };
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.localRoot, key);
    return fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.localRoot, key);
    try {
      await fs.unlink(fullPath);
    } catch {
      // Ignore if already deleted
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return buildPublicStorageUrl(
      this.config,
      createSignedStoragePath(this.config, key, expiresInSeconds),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.localRoot, key));
      return true;
    } catch {
      return false;
    }
  }
}
