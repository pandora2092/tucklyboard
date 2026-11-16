import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';

import type { CreateStatus, UpdateStatus } from '@tuckly/contracts';

import { Store } from '../database/database.service';
import { lockStatuses } from '../database/statuses';

import { SpacesService } from './spaces.service';

@Injectable()
export class StatusesService {
  constructor(
    @Inject(Store) private readonly db: Store,
    @Inject(SpacesService) private readonly spaces: SpacesService,
  ) {}
  async list(user: User, spaceId: string) {
    await this.spaces.access(user, spaceId);
    const rows = await this.db.bookmarkStatus.findMany({
      where: { spaceId },
      orderBy: [{ position: 'asc' }, { key: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return rows.map(({ _count, ...status }) => ({ ...status, itemCount: _count.items }));
  }
  private async change<T>(
    user: User,
    spaceId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    await this.spaces.access(user, spaceId, false, true);
    try {
      return await this.db.$transaction(async tx => {
        await lockStatuses(tx, spaceId);
        return work(tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Статус с таким названием уже существует');
      }
      throw error;
    }
  }
  private async existing(tx: Prisma.TransactionClient, spaceId: string, key: string) {
    const row = await tx.bookmarkStatus.findUnique({ where: { spaceId_key: { spaceId, key } } });
    if (!row) {
      throw new NotFoundException('Статус не найден');
    }
    return row;
  }
  private async uniqueName(
    tx: Prisma.TransactionClient,
    spaceId: string,
    name: string,
    key?: string,
  ) {
    if (
      await tx.bookmarkStatus.findFirst({
        where: {
          spaceId,
          name: { equals: name, mode: 'insensitive' },
          ...(key ? { key: { not: key } } : {}),
        },
      })
    ) {
      throw new ConflictException('Статус с таким названием уже существует');
    }
  }
  async create(user: User, spaceId: string, data: CreateStatus) {
    return this.change(user, spaceId, async tx => {
      if ((await tx.bookmarkStatus.count({ where: { spaceId } })) >= 30) {
        throw new BadRequestException('В пространстве может быть до 30 статусов');
      }
      await this.uniqueName(tx, spaceId, data.name);
      const last = await tx.bookmarkStatus.aggregate({
        where: { spaceId },
        _max: { position: true },
      });
      return tx.bookmarkStatus.create({
        data: { ...data, spaceId, key: randomUUID(), position: (last._max.position ?? -1) + 1 },
      });
    });
  }
  async update(user: User, spaceId: string, key: string, data: UpdateStatus) {
    return this.change(user, spaceId, async tx => {
      const current = await this.existing(tx, spaceId, key);
      if (data.name) {
        await this.uniqueName(tx, spaceId, data.name, key);
      }
      if (data.isDefault === false && current.isDefault) {
        throw new BadRequestException('Сначала выберите другой статус по умолчанию');
      }
      if (data.isDefault) {
        await tx.bookmarkStatus.updateMany({
          where: { spaceId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.bookmarkStatus.update({ where: { spaceId_key: { spaceId, key } }, data });
    });
  }
  async reorder(user: User, spaceId: string, keys: string[]) {
    return this.change(user, spaceId, async tx => {
      const rows = await tx.bookmarkStatus.findMany({ where: { spaceId } });
      if (
        keys.length !== rows.length ||
        new Set(keys).size !== keys.length ||
        keys.some(key => !rows.some(row => row.key === key))
      ) {
        throw new BadRequestException('Передайте все статусы пространства без повторений');
      }
      for (const [position, key] of keys.entries()) {
        await tx.bookmarkStatus.update({
          where: { spaceId_key: { spaceId, key } },
          data: { position },
        });
      }
      return { ok: true };
    });
  }
  async remove(user: User, spaceId: string, key: string, replacementKey?: string) {
    return this.change(user, spaceId, async tx => {
      const current = await this.existing(tx, spaceId, key);
      if ((await tx.bookmarkStatus.count({ where: { spaceId } })) <= 1) {
        throw new BadRequestException('В пространстве должен остаться хотя бы один статус');
      }
      if (replacementKey === key) {
        throw new BadRequestException('Выберите другой статус для переноса');
      }
      const replacement = replacementKey ? await this.existing(tx, spaceId, replacementKey) : null;
      const collections = await tx.collection.findMany({
        where: { spaceId, rules: { not: Prisma.DbNull } },
      });
      const references = collections.filter(
        row =>
          row.rules &&
          typeof row.rules === 'object' &&
          !Array.isArray(row.rules) &&
          row.rules.status === key,
      );
      const count = await tx.item.count({ where: { spaceId, status: key } });
      if (!replacement && (current.isDefault || count || references.length)) {
        throw new BadRequestException('Выберите статус для переноса закладок и правил коллекций');
      }
      if (replacement) {
        await tx.item.updateMany({
          where: { spaceId, status: key },
          data: { status: replacement.key },
        });
        for (const row of references) {
          await tx.collection.update({
            where: { id: row.id },
            data: { rules: { ...(row.rules as Prisma.InputJsonObject), status: replacement.key } },
          });
        }
      }
      await tx.bookmarkStatus.delete({ where: { spaceId_key: { spaceId, key } } });
      if (current.isDefault && replacement) {
        await tx.bookmarkStatus.update({
          where: { spaceId_key: { spaceId, key: replacement.key } },
          data: { isDefault: true },
        });
      }
      return { ok: true };
    });
  }
}
