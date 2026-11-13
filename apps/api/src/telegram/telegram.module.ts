import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { TelegramBotService } from './telegram-bot.service';
import { TelegramMedia } from './telegram-media.service';

@Module({
  imports: [DatabaseModule],
  providers: [TelegramMedia, TelegramBotService],
  exports: [TelegramMedia],
})
export class TelegramModule {}
