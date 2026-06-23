import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageProvider } from '../storage-provider.interface';
import { StorageUploadResult } from '../storage.service';

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
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const secret = this.config.get<string>('APP_SECRET', 'super-secret-key');
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    const stringToSign = `${key}:${expires}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('hex');
      
    return `${appUrl}/files/key/${encodeURIComponent(key)}/download?expires=${expires}&signature=${signature}`;
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
