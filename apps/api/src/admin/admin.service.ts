import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AdminQuery } from '@tuckly/contracts';

import { Store } from '../database/database.service';

function since(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date;
}
const userSelect = {
  id: true,
  telegramId: true,
  name: true,
  username: true,
  createdAt: true,
  lastSeenAt: true,
  _count: { select: { items: true, collections: true, ownedSpaces: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(@Inject(Store) private readonly db: Store) {}
  async overview() {
    const active = (days: number) =>
      this.db.user.count({ where: { activities: { some: { day: { gte: since(days) } } } } });
    const [
      users,
      newUsers7d,
      activeToday,
      active7d,
      active30d,
      items,
      collections,
      spaces,
      tracking,
    ] = await this.db.$transaction([
      this.db.user.count(),
      this.db.user.count({ where: { createdAt: { gte: since(7) } } }),
      active(1),
      active(7),
      active(30),
      this.db.item.count(),
      this.db.collection.count(),
      this.db.space.count({ where: { personalUserId: null } }),
      this.db.userActivity.aggregate({ _min: { day: true } }),
    ]);
    return {
      users,
      newUsers7d,
      activeToday,
      active7d,
      active30d,
      items,
      collections,
      spaces,
      trackingSince: tracking._min.day,
      generatedAt: new Date(),
    };
  }
  async users(query: AdminQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { telegramId: { contains: query.q } },
              { name: { contains: query.q, mode: 'insensitive' } },
              { username: { contains: query.q.replace(/^@/, ''), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.activeDays
        ? { activities: { some: { day: { gte: since(query.activeDays) } } } }
        : {}),
    };
    const [total, users] = await this.db.$transaction([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        select: userSelect,
        skip: (query.page - 1) * 25,
        take: 25,
        orderBy: [{ lastSeenAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      }),
    ]);
    return { total, page: query.page, pageSize: 25, users };
  }
  async user(id: string) {
    const user = await this.db.user.findUnique({ where: { id }, select: userSelect });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    const typesQuery = this.db.item.groupBy({
      by: ['type'],
      orderBy: { type: 'asc' },
      where: { userId: id },
      _count: { _all: true },
    });
    const [activity, itemTypes] = await this.db.$transaction([
      this.db.userActivity.findMany({
        where: { userId: id, day: { gte: since(30) } },
        orderBy: { day: 'desc' },
      }),
      typesQuery,
    ]);
    return {
      user,
      activity: activity.map(({ day, apiRequests, botMessages }) => ({
        day,
        apiRequests,
        botMessages,
      })),
      itemTypes: itemTypes.map(row => ({ type: row.type, count: row._count._all })),
    };
  }
}
