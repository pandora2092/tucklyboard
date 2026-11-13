import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { PreviewsModule } from '../previews/previews.module';

import { EmbeddingsService } from './embeddings.service';
import { EnrichmentService } from './enrichment.service';

@Module({
  imports: [DatabaseModule, PreviewsModule],
  providers: [EmbeddingsService, EnrichmentService],
  exports: [EmbeddingsService, EnrichmentService],
})
export class IntelligenceModule {}
