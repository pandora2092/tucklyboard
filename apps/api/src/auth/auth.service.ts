import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { Store } from '../database/database.service';

import { verifyTelegram } from './telegram-auth';

@Injectable()
export class AuthService {
  constructor(@Inject(Store) private readonly db: Store) {}
  async authenticate(
    req: Request,
    options: { telegramOnly?: boolean; trackActivity?: boolean } = {},
  ) {
    const raw = req.headers.authorization?.replace(/^tma /, '');
    let identity: { id: number; first_name: string; username?: string };
    try {
      if (raw && process.env.BOT_TOKEN) {
        identity = verifyTelegram(raw, process.env.BOT_TOKEN);
      } else if (
        !options.telegramOnly &&
        process.env.DEV_AUTH === 'true' &&
        process.env.NODE_ENV !== 'production'
      ) {
        identity = { id: 1, first_name: 'Локальный пользователь' };
      } else {
        throw new Error();
      }
    } catch {
      throw new UnauthorizedException('Откройте приложение заново через Telegram');
    }
    return this.db.userUpsert(
      identity.id,
      identity.first_name,
      identity.username,
      options.trackActivity === false ? 'none' : 'app',
    );
  }
}
