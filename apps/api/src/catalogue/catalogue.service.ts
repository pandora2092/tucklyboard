import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Item, type User } from '@prisma/client';

import {
  BRAND,
  CATALOGUE_LIMITS,
  editedTagDismissals,
  effectiveItemTags,
  ItemSchema,
  SmartRulesSchema,
  type BulkAction,
  type CreateItem,
  type ItemDetails,
  type ItemQuery,
  type SmartRules,
  type UpdateCollection,
  type UpdateItem,
} from '@tuckly/contracts';

import { canonicalUrl } from '../common/normalize-url';
import { source } from '../common/urls';
import { Store } from '../database/database.service';
import { resolveStatus } from '../database/statuses';
import { EmbeddingsService } from '../intelligence/embeddings.service';
import { EnrichmentService } from '../intelligence/enrichment.service';
import { autoTags, cosine, documentText, topicScore } from '../intelligence/topics';
import { LinkPreview } from '../previews/link-preview.service';
import { SpacesService } from '../spaces/spaces.service';
import { previewFileId, TelegramMedia, validMedia } from '../telegram/telegram-media.service';

import { LegacyMedia } from './legacy-media.service';
import {
  matchesSmartRules,
  smartWhere,
  tagWhere,
  type SmartCollectionDefinition,
} from './smart-collections';

const include = {
  collections: { include: { collection: true } },
  user: { select: { id: true, name: true } },
  collection: true,
  statusDefinition: true,
} satisfies Prisma.ItemInclude;
type FullItem = Prisma.ItemGetPayload<{ include: typeof include }>;
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
  private async smartDefinitions(spaceId: string | null): Promise<SmartCollectionDefinition[]> {
    if (!spaceId) {
      return [];
    }
    const rows = await this.db.collection.findMany({
      where: { spaceId, NOT: { rules: { equals: Prisma.DbNull } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, rules: true },
    });
    return rows.flatMap(row => {
      const parsed = SmartRulesSchema.safeParse(row.rules);
      return parsed.success ? [{ id: row.id, name: row.name, rules: parsed.data }] : [];
    });
  }
  private async view(
    item: FullItem,
    canEdit = true,
    wasDuplicate = false,
    definitions?: SmartCollectionDefinition[],
  ) {
    const smartCollections = (definitions ?? (await this.smartDefinitions(item.spaceId)))
      .filter(collection => matchesSmartRules(item, collection.rules))
      .map(({ id, name }) => ({ id, name }));
    const isTelegram = Boolean(item.telegramFileId);
    return ItemSchema.parse({
      ...item,
      tags: effectiveItemTags(item),
      smartCollections,
      statusInfo: item.statusDefinition,
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
    const row = await this.db.$transaction(async tx => {
      if (rules?.status) {
        await resolveStatus(tx, access.id, rules.status);
      }
      return tx.collection.upsert({
        where: { spaceId_name: { spaceId: access.id, name } },
        update: {},
        create: {
          name,
          userId: user.id,
          spaceId: access.id,
          ...(rules ? { rules: rules as Prisma.InputJsonValue } : {}),
        },
      });
    });
    return {
      id: row.id,
      name: row.name,
      spaceId: row.spaceId,
      rules: row.rules,
      _count: { items: 0 },
    };
  }
  private async editableCollection(user: User, id: string) {
    const collection = await this.db.collection.findUnique({ where: { id } });
    if (!collection?.spaceId) {
      throw new NotFoundException('Коллекция недоступна');
    }
    await this.spaces.access(user, collection.spaceId, true);
    return collection;
  }
  async updateCollection(user: User, id: string, data: UpdateCollection) {
    const collection = await this.editableCollection(user, id);
    if (data.rules !== undefined && collection.rules === null) {
      throw new BadRequestException('Условия можно менять только у умной коллекции');
    }
    try {
      await this.db.$transaction(async tx => {
        if (data.rules?.status) {
          await resolveStatus(tx, collection.spaceId!, data.rules.status);
        }
        await tx.collection.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.rules !== undefined ? { rules: data.rules as Prisma.InputJsonValue } : {}),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Коллекция с таким названием уже есть');
      }
      throw error;
    }
    return { ok: true };
  }
  async removeCollection(user: User, id: string) {
    const collection = await this.editableCollection(user, id);
    await this.db.$transaction(async tx => {
      await tx.item.updateMany({
        where: { spaceId: collection.spaceId, collectionId: id },
        data: { collectionId: null },
      });
      await tx.itemCollection.deleteMany({ where: { collectionId: id } });
      await tx.collection.delete({ where: { id } });
    });
    return { ok: true };
  }
  async sources(user: User, query: Pick<ItemQuery, 'spaceId' | 'type'>) {
    const access = await this.spaces.access(user, query.spaceId);
    const rows = await this.db.item.groupBy({
      by: ['source'],
      where: {
        spaceId: access.id,
        source: { not: '' },
        ...(query.type ? { type: query.type } : {}),
      },
      _count: { _all: true },
      orderBy: { source: 'asc' },
    });
    return rows.map(row => ({ source: row.source, count: row._count._all }));
  }
  async tags(user: User, query: Pick<ItemQuery, 'spaceId' | 'type'>) {
    const access = await this.spaces.access(user, query.spaceId);
    const rows = await this.db.item.findMany({
      where: { spaceId: access.id, ...(query.type ? { type: query.type } : {}) },
      select: { tags: true, autoTags: true, dismissedAutoTags: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of effectiveItemTags(row)) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
  }
  async list(user: User, q: ItemQuery) {
    const access = await this.spaces.access(user, q.spaceId);
    const definitions = await this.smartDefinitions(access.id);
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
      for (const collection of definitions) {
        const condition = smartWhere(collection.rules);
        // An empty rule set matches every item, so this inbox is empty.
        AND.push(
          Array.isArray(condition.AND) && !condition.AND.length
            ? { id: { in: [] } }
            : { NOT: condition },
        );
      }
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
        take: CATALOGUE_LIMITS.semanticCandidates,
        orderBy: { createdAt: 'desc' },
      });
      const scopeTotal = await this.db.item.count({ where: { AND } });
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
      const slice = ranked.slice(offset, offset + CATALOGUE_LIMITS.pageSize);
      return {
        items: await Promise.all(
          slice.map(row => this.view(row.item, access.role !== 'viewer', false, definitions)),
        ),
        nextCursor:
          ranked.length > offset + CATALOGUE_LIMITS.pageSize
            ? `semantic:${offset + CATALOGUE_LIMITS.pageSize}`
            : null,
        total: ranked.length,
        searchScopeLimit:
          scopeTotal > CATALOGUE_LIMITS.semanticCandidates
            ? CATALOGUE_LIMITS.semanticCandidates
            : null,
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
    const total = await this.db.item.count({ where: { AND } });
    const rows = await this.db.item.findMany({
      where: { AND },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: CATALOGUE_LIMITS.pageSize + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      items: await Promise.all(
        rows
          .slice(0, CATALOGUE_LIMITS.pageSize)
          .map(item => this.view(item, access.role !== 'viewer', false, definitions)),
      ),
      nextCursor:
        rows.length > CATALOGUE_LIMITS.pageSize ? rows[CATALOGUE_LIMITS.pageSize - 1].id : null,
      total,
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
      const status = await resolveStatus(tx, access.id, data.status);
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
          status,
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
    // Reject an invalid status before sending the user's file to Telegram.
    await this.db.$transaction(tx => resolveStatus(tx, access.id, data.status));
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
      const item = await this.db.$transaction(async tx => {
        const status = await resolveStatus(tx, access.id, data.status);
        return tx.item.create({
          data: {
            userId: user.id,
            spaceId: access.id,
            status,
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
      if (data.status !== undefined) {
        await resolveStatus(tx, item.spaceId!, data.status);
      }
      await tx.item.update({
        where: { id },
        data: {
          ...values,
          ...(data.tags !== undefined
            ? { dismissedAutoTags: editedTagDismissals(item, data.tags) }
            : {}),
          ...(data.title && data.title !== item.title ? { titleMode: 'custom' } : {}),
          embeddingModel: null,
          embedding: [],
          ...(data.text !== undefined || data.tags !== undefined
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
    if (data.action === 'copyToSpace' || data.action === 'moveToSpace') {
      if (!data.destinationSpaceId) {
        throw new BadRequestException('Выберите пространство');
      }
      const destination = await this.spaces.access(user, data.destinationSpaceId, true);
      if (destination.id === access.id) {
        throw new BadRequestException('Выберите другое пространство');
      }
      await this.db.$transaction(
        async tx => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Item" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
          );
          const items = await tx.item.findMany({
            where: { id: { in: ids }, spaceId: access.id },
            orderBy: { id: 'asc' },
          });
          if (items.length !== ids.length) {
            throw new NotFoundException('Часть карточек недоступна');
          }
          for (const item of items) {
            await this.transferInto(
              tx,
              user,
              item,
              destination.id,
              [],
              data.includeNote ?? false,
              data.action === 'moveToSpace',
            );
          }
        },
        { timeout: 30000 },
      );
      return { ok: true as const };
    }
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
      if (
        data.action === 'markDone' ||
        data.action === 'markSaved' ||
        data.action === 'setStatus'
      ) {
        if (data.action === 'setStatus' && !data.status) {
          throw new BadRequestException('Выберите статус');
        }
        const status = await resolveStatus(
          tx,
          access.id,
          data.action === 'setStatus' ? data.status : data.action === 'markDone' ? 'done' : 'saved',
        );
        await tx.item.updateMany({
          where: { id: { in: ids }, spaceId: access.id },
          data: { status },
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
  async move(user: User, id: string, spaceId: string) {
    return this.transfer(user, id, spaceId, [], true, true);
  }
  async copy(user: User, id: string, spaceId: string, ids: string[], includeNote: boolean) {
    return this.transfer(user, id, spaceId, ids, includeNote, false);
  }
  private async transfer(
    user: User,
    id: string,
    spaceId: string,
    ids: string[],
    includeNote: boolean,
    move: boolean,
  ) {
    const { item } = await this.owned(user, id, move);
    const destination = await this.spaces.access(user, spaceId, true);
    if (item.spaceId === destination.id) {
      throw new BadRequestException('Выберите другое пространство');
    }
    const folders = await this.collectionIds(destination.id, ids);
    const result = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.item.findFirst({ where: { id, spaceId: item.spaceId } });
      if (!current) {
        throw new NotFoundException('Карточка недоступна');
      }
      return this.transferInto(tx, user, current, destination.id, folders, includeNote, move);
    });
    return this.view(result.item, true, result.duplicate);
  }
  private async transferInto(
    tx: Prisma.TransactionClient,
    user: User,
    item: Item,
    spaceId: string,
    folders: string[],
    includeNote: boolean,
    move: boolean,
  ) {
    const normalized = item.url ? canonicalUrl(item.url) : null;
    const status = await resolveStatus(tx, spaceId);
    if (normalized) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${spaceId + '|' + normalized},0))`;
      const rows = await tx.item.findMany({
        where: {
          spaceId,
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
        if (move) {
          throw new BadRequestException(
            'В выбранном пространстве уже есть такая ссылка. Исходные карточки оставлены на месте',
          );
        }
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
    if (move) {
      await tx.itemCollection.deleteMany({ where: { itemId: item.id } });
      const moved = await tx.item.update({
        where: { id: item.id },
        data: { spaceId, status, collectionId: null, canonicalUrl: normalized },
        include,
      });
      return { item: moved, duplicate: false };
    }
    const created = await tx.item.create({
      data: {
        userId: user.id,
        spaceId,
        status,
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
        dismissedAutoTags: item.dismissedAutoTags,
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
  }
}
