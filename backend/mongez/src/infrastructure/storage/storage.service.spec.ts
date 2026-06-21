import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GoogleDriveStorageProvider } from './providers/google-drive.provider';

jest.mock('./providers/local-storage.provider');
jest.mock('./providers/s3-storage.provider');
jest.mock('./providers/google-drive.provider');

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  const mockConfigStore: Record<string, string> = {
    STORAGE_PROVIDER: 'local',
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      return mockConfigStore[key] !== undefined ? mockConfigStore[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigStore.STORAGE_PROVIDER = 'local';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should resolve LocalStorageProvider by default', async () => {
    mockConfigStore.STORAGE_PROVIDER = 'local';
    
    const provider = (service as any).getProvider();
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it('should resolve S3StorageProvider when configured', async () => {
    mockConfigStore.STORAGE_PROVIDER = 's3';

    const provider = (service as any).getProvider();
    expect(provider).toBeInstanceOf(S3StorageProvider);
  });

  it('should resolve GoogleDriveStorageProvider when configured', async () => {
    mockConfigStore.STORAGE_PROVIDER = 'google-drive';

    const provider = (service as any).getProvider();
    expect(provider).toBeInstanceOf(GoogleDriveStorageProvider);
  });

  it('should delegate upload to active provider', async () => {
    const uploadMock = jest.fn().mockResolvedValue({ key: 'test', size: 10, mimeType: 'text/plain' });
    LocalStorageProvider.prototype.upload = uploadMock;

    const res = await service.upload('test-key', Buffer.from('hello'), 'text/plain');
    expect(res).toEqual({ key: 'test', size: 10, mimeType: 'text/plain' });
    expect(uploadMock).toHaveBeenCalledWith('test-key', Buffer.from('hello'), 'text/plain');
  });

  it('should delegate download to active provider', async () => {
    const downloadMock = jest.fn().mockResolvedValue(Buffer.from('hello'));
    LocalStorageProvider.prototype.download = downloadMock;

    const res = await service.download('test-key');
    expect(res).toEqual(Buffer.from('hello'));
    expect(downloadMock).toHaveBeenCalledWith('test-key');
  });

  it('should delegate delete to active provider', async () => {
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    LocalStorageProvider.prototype.delete = deleteMock;

    await service.delete('test-key');
    expect(deleteMock).toHaveBeenCalledWith('test-key');
  });

  it('should delegate getSignedUrl to active provider', async () => {
    const signedUrlMock = jest.fn().mockResolvedValue('http://signed-url');
    LocalStorageProvider.prototype.getSignedUrl = signedUrlMock;

    const res = await service.getSignedUrl('test-key', 120);
    expect(res).toBe('http://signed-url');
    expect(signedUrlMock).toHaveBeenCalledWith('test-key', 120);
  });

  it('should delegate exists to active provider', async () => {
    const existsMock = jest.fn().mockResolvedValue(true);
    LocalStorageProvider.prototype.exists = existsMock;

    const res = await service.exists('test-key');
    expect(res).toBe(true);
    expect(existsMock).toHaveBeenCalledWith('test-key');
  });

  it('should build a structured key correctly', () => {
    const key = service.buildKey('space-1', 'task', 'task-1', 'document.pdf');
    expect(key).toMatch(/^space-1\/task\/task-1\/[a-z0-9]+\.pdf$/);
  });
});
