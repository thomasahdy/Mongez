import { Module, Global } from '@nestjs/common';
import { IdentifierService } from './services/identifier.service';
import { EncryptionService } from './services/encryption.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { TraceContextService } from '../infrastructure/logging/trace-context.service';

/**
 * SharedModule — exports utilities used across all feature modules.
 * Marked @Global so it does NOT need to be imported per-module.
 */
@Global()
@Module({
  providers: [IdentifierService, EncryptionService, TenantContextService, TraceContextService],
  exports: [IdentifierService, EncryptionService, TenantContextService, TraceContextService],
})
export class SharedModule {}

