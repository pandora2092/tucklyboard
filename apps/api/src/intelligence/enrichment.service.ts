import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { canonicalUrl } from '../common/normalize-url';
import { Store } from '../database/database.service';
import { SiteMetadataService } from '../previews/site-metadata';

import { EmbeddingsService } from './embeddings.service';
import { autoTags, documentText } from './topics';

@Injectable()
export class EnrichmentService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active = false;
  private inFlight?: Promise<void>;
  private stopped = false;
  constructor(
    @Inject(Store) private readonly db: Store,
    @Inject(SiteMetadataService) private readonly metadata: SiteMetadataService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {}
  onApplicationBootstrap() {
    if (process.env.ENRICHMENT_ENABLED === 'false') {
      return;
    }
    this.timer = setInterval(() => {
      void this.schedule().catch(() => {
        console.warn('Background enrichment failed; pending items will be retried.');
      });
    }, 3000);
    this.timer.unref();
    void this.schedule().catch(() => {
      console.warn('Background enrichment failed; pending items will be retried.');
    });
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.inFlight;
  }
  async retry(id: string) {
    await this.db.item.updateMany({
      where: { id },
      data: { metadataStatus: 'pending', metadataUpdatedAt: null },
    });
    if (process.env.ENRICHMENT_ENABLED !== 'false') {
      void this.schedule().catch(() => {
        console.warn('Background enrichment failed; pending items will be retried.');
      });
    }
  }
  private schedule() {
    if (!this.inFlight) {
      this.inFlight = this.tick().finally(() => {
        this.inFlight = undefined;
      });
    }
    return this.inFlight;
  }
  async tick() {
    if (this.active || this.stopped) {
      return;
    }
    this.active = true;
    try {
      const rows = await this.db.item.findMany({
        where: {
          OR: [
            { metadataStatus: 'pending' },
            {
              metadataStatus: 'processing',
              metadataUpdatedAt: { lt: new Date(Date.now() - 120000) },
            },
          ],
        },
        take: 4,
        orderBy: { createdAt: 'asc' },
      });
      await Promise.all(rows.map(row => this.enrich(row.id)));
      if (this.embeddings.configured && !this.stopped) {
        const missing = await this.db.item.findMany({
          where: {
            metadataStatus: { in: ['ready', 'unavailable'] },
            OR: [{ embeddingModel: null }, { embeddingModel: { not: this.embeddings.model } }],
          },
          take: 2,
        });
        for (const item of missing) {
          const text = documentText(item);
          const vector = await this.embeddings.embed(text);
          if (vector) {
            await this.db.item.updateMany({
              where: { id: item.id },
              data: {
                embedding: vector,
                embeddingModel: this.embeddings.model,
                embeddingFingerprint: this.embeddings.fingerprint(text),
              },
            });
          }
        }
      }
    } finally {
      this.active = false;
    }
  }
  async enrich(id: string) {
    const now = new Date();
    const claimed = await this.db.item.updateMany({
      where: {
        id,
        OR: [
          { metadataStatus: 'pending' },
          {
            metadataStatus: 'processing',
            metadataUpdatedAt: { lt: new Date(Date.now() - 120000) },
          },
        ],
      },
      data: { metadataStatus: 'processing', metadataUpdatedAt: now },
    });
    if (!claimed.count) {
      return;
    }
    const item = await this.db.item.findUnique({ where: { id } });
    if (!item) {
      return;
    }
    let title = item.sourceTitle;
    let description = item.sourceDescription;
    let author = item.author;
    let status = 'ready';
    if (item.url) {
      try {
        const data = await this.metadata.get(item.url);
        title = data.title;
        description = data.description;
        author = data.author;
      } catch {
        status = 'unavailable';
      }
    }
    const tags = autoTags(
      [item.title, title, description, item.text, item.source].filter(Boolean).join(' '),
    );
    await this.db.item.updateMany({
      where: { id, metadataUpdatedAt: now },
      data: {
        sourceTitle: title,
        sourceDescription: description,
        author,
        autoTags: tags,
        metadataStatus: status,
        embeddingModel: null,
        embedding: [],
      },
    });
    if (title) {
      await this.db.item.updateMany({
        where: { id, titleMode: 'auto', metadataUpdatedAt: now },
        data: { title },
      });
    }
    if (item.url && item.spaceId && !item.canonicalUrl) {
      try {
        await this.db.item.updateMany({
          where: { id, canonicalUrl: null },
          data: { canonicalUrl: canonicalUrl(item.url) },
        });
      } catch {
        /* Existing duplicate cards are kept; new saves reuse the first canonical match. */
      }
    }
  }
}
