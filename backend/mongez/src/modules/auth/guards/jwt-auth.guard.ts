import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { isValidStorageSignature } from '../../../infrastructure/storage/storage-signature.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.path && request.path.includes('/files/key/') && request.query && request.query.signature) {
      const pathParts = request.path.split('/files/key/');
      const key = decodeURIComponent(pathParts[1]?.split('/')[0] || '');
      const expires = request.query.expires;
      const signature = request.query.signature;

      if (key && expires && signature) {
        if (isValidStorageSignature(this.configService, key, expires as string, signature as string)) {
          const expiresAt = Number(expires);
          if (Number.isFinite(expiresAt) && Math.floor(Date.now() / 1000) <= expiresAt) {
            return true;
          }
        }
      }
      return false; // Signature invalid or expired
    }
    return super.canActivate(context);
  }
}