import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';

import {
  BRAND,
  ItemSchema,
  SmartRulesSchema,
  type BulkAction,
  type CreateItem,
  type ItemDetails,
  type ItemQuery,
  type SmartRules,
  type UpdateItem,
} from '@tuckly/contracts';

import { canonicalUrl } from '../common/normalize-url';
import { source } from '../common/urls';
import { Store } from '../database/database.service';
import { EmbeddingsService } from '../intelligence/embeddings.service';
import { EnrichmentService } from '../intelligence/enrichment.service';
import { autoTags, cosine, documentText, topicScore } from '../intelligence/topics';
import { LinkPreview } from '../previews/link-preview.service';
import { SpacesService } from '../spaces/spaces.service';
import { previewFileId, TelegramMedia, validMedia } from '../telegram/telegram-media.service';

import { LegacyMedia } from './legacy-media.service';

const include = {
  collections: { include: { collection: true } },
  user: { select: { id: true, name: true } },
  collection: true,
} satisfies Prisma.ItemInclude;
type FullItem = Prisma.ItemGetPayload<{ include: typeof include }>;
function tagWhere(tag: string): Prisma.ItemWhereInput {
  return {
    OR: [
      { tags: { has: tag } },
      { autoTags: { has: tag }, NOT: { dismissedAutoTags: { has: tag } } },
    ],
  };
}
export function smartWhere(rules: SmartRules): Prisma.ItemWhereInput {
  const AND: Prisma.ItemWhereInput[] = [];
  if (rules.type) {
    AND.push({ type: rules.type });
  }
  if (rules.source) {
    AND.push({ source: rules.source });
  }
  if (rules.status) {
    AND.push({ status: rules.status });
  }
  if (rules.addedBy) {
    AND.push({ userId: rules.addedBy });
  }
  if (rules.days) {
    AND.push({ createdAt: { gte: new Date(Date.now() - rules.days * 86400000) } });
  }
  for (const tag of rules.tags || []) {
    AND.push(tagWhere(tag));
  }
  return { AND };
}
@Injectable()
export class CatalogueService {
  constructor(
    @Inject(Store) private readonly db: Store,
    @Inject(TelegramMedia) private readonly telegram: TelegramMedia,
    @Inject(LegacyMedia) private readonly legacy: LegacyMedia,
    @Inject(LinkPreview) private readonly links: LinkPreview,
    @Inject(SpacesService) private readonly spaces: SpacesService,
    @Inject(EnrichmentService) private readonly enrichment: EnrichmentService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {}
  private async view(item: FullItem, canEdit = true, wasDuplicate = false) {
    const isTelegram = Boolean(item.telegramFileId);
    return ItemSchema.parse({
      ...item,
      createdAt: item.createdAt.toISOString(),
      collections: item.collections.map(entry => ({
        id: entry.collection.id,
        name: entry.collection.name,
      })),
      collection: item.collections[0]?.collection || null,
      collectionId: item.collections[0]?.collectionId || null,
      addedBy: item.user,
      canEdit,
      wasDuplicate,
      storage: isTelegram ? 'telegram' : item.mediaKey ? 'legacy-s3' : null,
      fileSize: item.telegramFileSize === null ? null : Number(item.telegramFileSize),
      previewUrl:
        (isTelegram && this.telegram.configured && previewFileId(item)) ||
        (!isTelegram && Boolean(item.url))
          ? `/api/items/${item.id}/preview`
          : null,
      mediaUrl: !isTelegram ? await this.legacy.url(item.mediaKey) : null,
      canSendToChat: isTelegram && this.telegram.configured,
    });
  }
  private async owned(user: User, id: string, write = false) {
    const item = await this.db.item.findUnique({ where: { id }, include });
    if (!item) {
      throw new NotFoundException('Карточка не найдена');
    }
    const access = await this.spaces.access(user, item.spaceId || undefined, write);
    if (!item.spaceId && item.userId !== user.id) {
      throw new NotFoundException();
    }
    return { item, access };
  }
  private async collectionIds(spaceId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) {
      return unique;
    }
    const count = await this.db.collection.count({
      where: { id: { in: unique }, spaceId, rules: { equals: Prisma.DbNull } },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Выберите обычные коллекции этого пространства');
    }
    return unique;
  }
  private ids(data: { collectionId?: string | null; collectionIds?: string[] }) {
    return data.collectionIds || (data.collectionId ? [data.collectionId] : []);
  }
  async collections(user: User, spaceId?: string) {
    const access = await this.spaces.access(user, spaceId);
    const rows = await this.db.collection.findMany({
      where: { spaceId: access.id },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      rows.map(async collection => {
        const parsed = SmartRulesSchema.safeParse(collection.rules);
        const count = await this.db.item.count({
          where: {
            spaceId: access.id,
            ...(parsed.success
              ? smartWhere(parsed.data)
              : { collections: { some: { collectionId: collection.id } } }),
          },
        });
        return {
          id: collection.id,
          name: collection.name,
          spaceId: access.id,
          rules: parsed.success ? parsed.data : null,
          _count: { items: count },
        };
      }),
    );
  }
  async createCollection(user: User, name: string, spaceId?: string, rules?: SmartRules) {
    const access = await this.spaces.access(user, spaceId, true);
    const row = await this.db.collection.upsert({
      where: { spaceId_name: { spaceId: access.id, name } },
      update: {},
      create: {
        name,
        userId: user.id,
        spaceId: access.id,
        ...(rules ? { rules: rules as Prisma.InputJsonValue } : {}),
      },
    });
    return {
      id: row.id,
      name: row.name,
      spaceId: row.spaceId,
      rules: row.rules,
      _count: { items: 0 },
    };
  }
  async sources(user: User, spaceId?: string) {
    const access = await this.spaces.access(user, spaceId);
    const rows = await this.db.item.groupBy({
      by: ['source'],
      where: { spaceId: access.id, source: { not: '' } },
      _count: { _all: true },
      orderBy: { source: 'asc' },
    });
    return rows.map(row => ({ source: row.source, count: row._count._all }));
  }
  async list(user: User, q: ItemQuery) {
    const access = await this.spaces.access(user, q.spaceId);
    const AND: Prisma.ItemWhereInput[] = [{ spaceId: access.id }];
    if (q.type) {
      AND.push({ type: q.type });
    }
    if (q.source) {
      AND.push({ source: q.source });
    }
    if (q.status) {
      AND.push({ status: q.status });
    }
    if (q.tag) {
      AND.push(tagWhere(q.tag));
    }
    if (q.collection === 'inbox') {
      AND.push({ collections: { none: {} } });
    } else if (q.collection) {
      const collection = await this.db.collection.findFirst({
        where: { id: q.collection, spaceId: access.id },
      });
      if (!collection) {
        throw new NotFoundException('Коллекция недоступна');
      }
      const rules = SmartRulesSchema.safeParse(collection.rules);
      AND.push(
        rules.success
          ? smartWhere(rules.data)
          : { collections: { some: { collectionId: collection.id } } },
      );
    }
    if (q.q && q.searchMode === 'semantic') {
      const rows = await this.db.item.findMany({
        where: { AND },
        include,
        take: 2000,
        orderBy: { createdAt: 'desc' },
      });
      const vector = await this.embeddings.embed(q.q);
      let embedded = false;
      const ranked = rows
        .map(item => {
          const text = documentText(item);
          let score = topicScore(q.q!, text);
          if (
            vector &&
            item.embeddingModel === this.embeddings.model &&
            item.embeddingFingerprint === this.embeddings.fingerprint(text) &&
            item.embedding.length === vector.length
          ) {
            embedded = true;
            const similarity = cosine(vector, item.embedding);
            score = similarity > 0.22 ? Math.max(score, similarity) : score;
          }
          return { item, score };
        })
        .filter(value => value.score > 0)
        .sort(
          (a, b) => b.score - a.score || b.item.createdAt.getTime() - a.item.createdAt.getTime(),
        );
      const offset = q.cursor && /^semantic:\d+$/.test(q.cursor) ? Number(q.cursor.slice(9)) : 0;
      const slice = ranked.slice(offset, offset + 40);
      return {
        items: await Promise.all(slice.map(row => this.view(row.item, access.role !== 'viewer'))),
        nextCursor: ranked.length > offset + 40 ? `semantic:${offset + 40}` : null,
        searchEngine: embedded ? 'embeddings' : 'topics',
      };
    }
    if (q.q) {
      AND.push({
        OR: [
          ...['title', 'text', 'source', 'sourceTitle', 'sourceDescription', 'author'].map(key => ({
            [key]: { contains: q.q, mode: 'insensitive' },
          })),
          { tags: { has: q.q } },
          { autoTags: { has: q.q }, NOT: { dismissedAutoTags: { has: q.q } } },
        ],
      });
    }
    const rows = await this.db.item.findMany({
      where: { AND },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 41,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: await Promise.all(
        rows.slice(0, 40).map(item => this.view(item, access.role !== 'viewer')),
      ),
      nextCursor: rows.length > 40 ? rows[39].id : null,
      searchEngine: 'text',
    };
  }
  async add(user: User, data: CreateItem) {
    const access = await this.spaces.access(user, data.spaceId, true);
    const ids = await this.collectionIds(access.id, this.ids(data));
    let normalized: string | undefined;
    try {
      normalized = data.url ? canonicalUrl(data.url) : undefined;
    } catch {
      throw new BadRequestException('Неверная ссылка');
    }
    const result = await this.db.$transaction(async tx => {
      if (normalized) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${access.id + '|' + normalized},0))`;
        const candidates = await tx.item.findMany({
          where: {
            spaceId: access.id,
            OR: [{ canonicalUrl: normalized }, { canonicalUrl: null, url: { not: null } }],
          },
        });
        const existing = candidates.find(
          item =>
            item.canonicalUrl === normalized ||
            (() => {
              try {
                return item.url && canonicalUrl(item.url) === normalized;
              } catch {
                return false;
              }
            })(),
        );
        if (existing) {
          await tx.itemCollection.createMany({
            data: ids.map(collectionId => ({ itemId: existing.id, collectionId })),
            skipDuplicates: true,
          });
          if (data.tags.length) {
            await tx.item.update({
              where: { id: existing.id },
              data: {
                tags: [...new Set([...existing.tags, ...data.tags])].slice(0, 20),
                embeddingModel: null,
                embedding: [],
              },
            });
          }
          return {
            item: await tx.item.findUniqueOrThrow({ where: { id: existing.id }, include }),
            duplicate: true,
          };
        }
      }
      const custom = Boolean(data.title?.trim() && data.title !== data.url);
      const title =
        data.title?.trim() || (data.url ? source(normalized) : data.text.slice(0, 80)) || 'Заметка';
      const item = await tx.item.create({
        data: {
          userId: user.id,
          spaceId: access.id,
          type: data.type,
          title,
          titleMode: custom ? 'custom' : 'auto',
          text: data.text,
          url: data.url,
          canonicalUrl: normalized,
          source: source(normalized),
          tags: data.tags,
          autoTags: autoTags(title + ' ' + data.text),
          collections: { create: ids.map(collectionId => ({ collectionId })) },
        },
        include,
      });
      return { item, duplicate: false };
    });
    return this.view(result.item, true, result.duplicate);
  }
  async upload(user: User, file: Express.Multer.File | undefined, data: ItemDetails) {
    const access = await this.spaces.access(user, data.spaceId, true);
    const ids = await this.collectionIds(access.id, this.ids(data));
    if (!file?.buffer.length || !validMedia(file.buffer, file.mimetype)) {
      throw new BadRequestException('Выберите корректное фото или видео');
    }
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };
    const sent = await this.telegram.upload(
      user.telegramId,
      file.buffer,
      `${BRAND.name}.${extensions[file.mimetype]}`,
      data.title,
      file.mimetype,
    );
    try {
      const item = await this.db.item.create({
        data: {
          userId: user.id,
          spaceId: access.id,
          title: data.title,
          text: data.text,
          tags: data.tags,
          ...sent.media,
          source: 'Telegram',
          telegramMessageId: sent.messageId,
          collections: { create: ids.map(collectionId => ({ collectionId })) },
        },
        include,
      });
      return this.view(item);
    } catch {
      throw new BadGatewayException(
        'Файл отправлен в Telegram, но карточку сохранить не удалось. Перешлите его боту',
      );
    }
  }
  async send(user: User, id: string) {
    const { item } = await this.owned(user, id);
    await this.telegram.send(user.telegramId, item);
    return { ok: true as const };
  }
  async preview(user: User, id: string) {
    const { item } = await this.owned(user, id);
    if (item.telegramFileId) {
      return this.telegram.preview(item);
    }
    if (item.url) {
      return (await this.links.image(item.url)).bytes;
    }
    throw new NotFoundException('Превью не найдено');
  }
  async edit(user: User, id: string, data: UpdateItem) {
    const { item } = await this.owned(user, id, true);
    const ids =
      data.collectionIds !== undefined || data.collectionId !== undefined
        ? await this.collectionIds(item.spaceId!, this.ids(data))
        : undefined;
    const { collectionId: _legacy, collectionIds: _collections, ...values } = data;
    await this.db.$transaction(async tx => {
      await tx.item.update({
        where: { id },
        data: {
          ...values,
          ...(data.title && data.title !== item.title ? { titleMode: 'custom' } : {}),
          embeddingModel: null,
          embedding: [],
          ...(data.text !== undefined
            ? { metadataStatus: 'pending', metadataUpdatedAt: null }
            : {}),
        },
      });
      if (ids) {
        await tx.itemCollection.deleteMany({ where: { itemId: id } });
        await tx.itemCollection.createMany({
          data: ids.map(collectionId => ({ itemId: id, collectionId })),
          skipDuplicates: true,
        });
        await tx.item.update({ where: { id }, data: { collectionId: ids[0] || null } });
      }
    });
    return { ok: true as const };
  }
  async remove(user: User, id: string) {
    await this.owned(user, id, true);
    await this.db.item.delete({ where: { id } });
    return { ok: true as const };
  }
  async retry(user: User, id: string) {
    await this.owned(user, id, true);
    await this.enrichment.retry(id);
    return { ok: true as const };
  }
  async bulk(user: User, data: BulkAction) {
    const access = await this.spaces.access(user, data.spaceId, true);
    const ids = [...new Set(data.ids)];
    const rows = await this.db.item.findMany({ where: { id: { in: ids }, spaceId: access.id } });
    if (rows.length !== ids.length) {
      throw new NotFoundException('Часть карточек недоступна');
    }
    const folders = await this.collectionIds(access.id, data.collectionIds || []);
    if (['addCollections', 'removeCollections'].includes(data.action) && !folders.length) {
      throw new BadRequestException('Выберите коллекции');
    }
    await this.db.$transaction(async tx => {
      if (data.action === 'delete') {
        await tx.item.deleteMany({ where: { id: { in: ids }, spaceId: access.id } });
      }
      if (data.action === 'markDone' || data.action === 'markSaved') {
        await tx.item.updateMany({
          where: { id: { in: ids }, spaceId: access.id },
          data: { status: data.action === 'markDone' ? 'done' : 'saved' },
        });
      }
      if (data.action === 'addCollections') {
        await tx.itemCollection.createMany({
          data: ids.flatMap(itemId => folders.map(collectionId => ({ itemId, collectionId }))),
          skipDuplicates: true,
        });
      }
      if (data.action === 'removeCollections') {
        await tx.itemCollection.deleteMany({
          where: { itemId: { in: ids }, collectionId: { in: folders } },
        });
      }
      if (data.action === 'addTags') {
        for (const item of rows) {
          await tx.item.update({
            where: { id: item.id },
            data: {
              tags: [...new Set([...item.tags, ...(data.tags || [])])].slice(0, 20),
              embeddingModel: null,
              embedding: [],
            },
          });
        }
      }
    });
    return { ok: true as const };
  }
  async copy(user: User, id: string, spaceId: string, ids: string[], includeNote: boolean) {
    const { item } = await this.owned(user, id);
    const access = await this.spaces.access(user, spaceId, true);
    const folders = await this.collectionIds(access.id, ids);
    const normalized = item.url ? canonicalUrl(item.url) : null;
    const result = await this.db.$transaction(async tx => {
      if (normalized) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${access.id + '|' + normalized},0))`;
        const rows = await tx.item.findMany({
          where: {
            spaceId: access.id,
            OR: [{ canonicalUrl: normalized }, { canonicalUrl: null, url: { not: null } }],
          },
        });
        const existing = rows.find(row => {
          try {
            return (
              row.canonicalUrl === normalized || (row.url && canonicalUrl(row.url) === normalized)
            );
          } catch {
            return false;
          }
        });
        if (existing) {
          await tx.itemCollection.createMany({
            data: folders.map(collectionId => ({ itemId: existing.id, collectionId })),
            skipDuplicates: true,
          });
          return {
            item: await tx.item.findUniqueOrThrow({ where: { id: existing.id }, include }),
            duplicate: true,
          };
        }
      }
      const created = await tx.item.create({
        data: {
          userId: user.id,
          spaceId: access.id,
          type: item.type,
          title: item.title,
          titleMode: item.titleMode,
          text: includeNote ? item.text : '',
          url: item.url,
          canonicalUrl: normalized,
          source: item.source,
          sourceTitle: item.sourceTitle,
          sourceDescription: item.sourceDescription,
          author: item.author,
          autoTags: autoTags(
            [item.title, item.sourceTitle, item.sourceDescription, includeNote ? item.text : '']
              .filter(Boolean)
              .join(' '),
          ),
          tags: item.tags,
          metadataStatus: item.metadataStatus === 'processing' ? 'pending' : item.metadataStatus,
          mediaKey: item.mediaKey,
          mime: item.mime,
          telegramFileId: item.telegramFileId,
          telegramFileUniqueId: item.telegramFileUniqueId,
          telegramMediaKind: item.telegramMediaKind,
          telegramThumbnailFileId: item.telegramThumbnailFileId,
          telegramFileSize: item.telegramFileSize,
          collections: { create: folders.map(collectionId => ({ collectionId })) },
        },
        include,
      });
      return { item: created, duplicate: false };
    });
    return this.view(result.item, true, result.duplicate);
  }
}
