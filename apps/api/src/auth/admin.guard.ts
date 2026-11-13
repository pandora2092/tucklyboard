import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';

import { COPY } from '@tuckly/contracts';

import { isAdmin } from './admin-access';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'private, no-store');
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = await this.auth.authenticate(req, { telegramOnly: true, trackActivity: false });
    if (!isAdmin(req.user.telegramId)) {
      throw new ForbiddenException(COPY.adminOnly);
    }
    return true;
  }
}
