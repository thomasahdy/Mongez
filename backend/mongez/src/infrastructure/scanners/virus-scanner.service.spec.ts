import { Test, TestingModule } from '@nestjs/testing';
import { VirusScannerService } from './virus-scanner.service';

describe('VirusScannerService', () => {
  let service: VirusScannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VirusScannerService],
    }).compile();

    service = module.get<VirusScannerService>(VirusScannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pass clean files', async () => {
    const buffer = Buffer.from('This is a clean text file content.');
    const result = await service.scan(buffer, 'clean.txt');
    expect(result.clean).toBe(true);
  });

  it('should block EICAR standard test virus signature', async () => {
    const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const buffer = Buffer.from(eicarSignature);
    const result = await service.scan(buffer, 'virus.txt');
    expect(result.clean).toBe(false);
    expect(result.detail).toContain('EICAR');
  });
});
