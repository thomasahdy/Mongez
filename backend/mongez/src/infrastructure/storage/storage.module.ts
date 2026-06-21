import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * StorageModule — Global provider of StorageService.
 * Exposed globally so FilesModule, UsersModule (avatar), and future
 * modules can inject it without per-module imports.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}