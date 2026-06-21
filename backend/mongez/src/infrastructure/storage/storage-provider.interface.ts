import { StorageUploadResult } from './storage.service';

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
