import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.path && request.path.includes('/files/key/') && request.query && request.query.signature) {
      return true;
    }
    return super.canActivate(context);
  }
}