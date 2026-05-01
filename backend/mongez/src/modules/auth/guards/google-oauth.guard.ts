import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      accessType: 'offline',
      prompt: 'consent',
    });
  }

  // To allow adding custom logic if needed before or after the request
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
