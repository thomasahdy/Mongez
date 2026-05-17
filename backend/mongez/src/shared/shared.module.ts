import { Module, Global } from '@nestjs/common';
import { IdentifierService } from './services/identifier.service';

/**
 * SharedModule — exports utilities used across all feature modules.
 * Marked @Global so it does NOT need to be imported per-module.
 */
@Global()
@Module({
  providers: [IdentifierService],
  exports: [IdentifierService],
})
export class SharedModule {}
