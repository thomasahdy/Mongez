import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // Platform admin check: matches ADMIN_EMAIL config or defaults to thomas@mongez.io
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') || 'thomas@mongez.io';
    const isAdmin = user.email === adminEmail;

    if (!isAdmin) {
      throw new ForbiddenException('Platform administrator access required');
    }
    return true;
  }
}
