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
    const req = context.switchToHttp().getRequest();
    if (req.query.state && req.query.scope?.includes('drive')) {
      return true;
    }
    return super.canActivate(context);
  }
}
