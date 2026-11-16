import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TelegramModule } from '../telegram/telegram.module';

import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { StatusesService } from './statuses.service';

@Module({
  imports: [DatabaseModule, AuthModule, TelegramModule],
  controllers: [SpacesController],
  providers: [SpacesService, StatusesService],
  exports: [SpacesService],
})
export class SpacesModule {}
