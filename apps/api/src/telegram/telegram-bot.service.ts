import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Bot } from 'grammy';

import { Store } from '../database/database.service';

import { createBot } from './bot';

@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnModuleDestroy {
  private bot?: Bot;
  constructor(@Inject(Store) private readonly db: Store) {}
  onApplicationBootstrap() {
    if (!process.env.BOT_TOKEN || process.env.BOT_POLLING === 'false') {
      return;
    }
    this.bot = createBot(this.db, process.env.BOT_TOKEN);
    void this.bot
      .start()
      .catch(() => console.error('Telegram polling failed: check bot configuration'));
  }
  async onModuleDestroy() {
    if (this.bot?.isRunning()) {
      await this.bot.stop();
    }
  }
}
