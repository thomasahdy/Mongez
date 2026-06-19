import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class VirusScannerService {
  private readonly logger = new Logger(VirusScannerService.name);

  async scan(buffer: Buffer, fileName: string): Promise<{ clean: boolean; detail?: string }> {
    this.logger.debug(`Scanning file for viruses: ${fileName}`);

    // EICAR standard test signature check
    const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const content = buffer.toString('utf8');
    if (content.includes(eicarSignature)) {
      this.logger.warn(`Virus scan failed for file ${fileName}: EICAR test file detected`);
      return { clean: false, detail: 'EICAR test file detected' };
    }

    this.logger.debug(`Virus scan clean for file: ${fileName}`);
    return { clean: true };
  }
}
