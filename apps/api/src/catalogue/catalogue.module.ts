import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PreviewsModule } from '../previews/previews.module';
import { SpacesModule } from '../spaces/spaces.module';
import { TelegramModule } from '../telegram/telegram.module';

import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { LegacyMedia } from './legacy-media.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TelegramModule,
    SpacesModule,
    PreviewsModule,
    IntelligenceModule,
  ],
  controllers: [CatalogueController],
  providers: [CatalogueService, LegacyMedia],
})
export class CatalogueModule {}
