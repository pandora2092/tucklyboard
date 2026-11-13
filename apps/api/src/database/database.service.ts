import { Injectable, NotFoundException, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class Store extends PrismaClient implements OnApplicationShutdown, OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    for (const user of await this.user.findMany({ select: { id: true } })) {
      await this.ensurePersonalSpace(user.id);
    }
  }
  async onApplicationShutdown() {
    await this.$disconnect();
  }
  private readonly personalReady = new Map<string, Promise<string>>();
  ensurePersonalSpace(userId: string): Promise<string> {
    let task = this.personalReady.get(userId);
    if (!task) {
      task = this.initializePersonal(userId).catch(error => {
        this.personalReady.delete(userId);
        throw error;
      });
      this.personalReady.set(userId, task);
    }
    return task;
  }
  private async initializePersonal(userId: string) {
    const id = `personal_${userId}`;
    await this.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO "Space" ("id","name","ownerId","personalUserId") VALUES (${id},'Моё пространство',${userId},${userId}) ON CONFLICT ("id") DO NOTHING`;
      await tx.$executeRaw`INSERT INTO "SpaceMember" ("spaceId","userId","role") VALUES (${id},${userId},'owner') ON CONFLICT ("spaceId","userId") DO NOTHING`;
      await tx.collection.updateMany({ where: { userId, spaceId: null }, data: { spaceId: id } });
      await tx.$executeRaw`INSERT INTO "ItemCollection" ("itemId","collectionId") SELECT i."id",i."collectionId" FROM "Item" i JOIN "Collection" c ON c."id"=i."collectionId" WHERE i."userId"=${userId} AND i."spaceId" IS NULL AND c."spaceId"=${id} ON CONFLICT DO NOTHING`;
      await tx.item.updateMany({ where: { userId, spaceId: null }, data: { spaceId: id } });
    });
    return id;
  }
  async userUpsert(
    id: number,
    name: string,
    username?: string,
    channel: 'app' | 'bot' | 'none' = 'app',
  ) {
    const now = new Date();
    const user = await this.user.upsert({
      where: { telegramId: String(id) },
      update: {
        name,
        username: username ?? null,
        ...(channel !== 'none' ? { lastSeenAt: now } : {}),
      },
      create: {
        telegramId: String(id),
        name,
        username,
        lastSeenAt: channel === 'none' ? null : now,
      },
    });
    if (channel !== 'none') {
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      const counter = channel === 'app' ? 'apiRequests' : 'botMessages';
      await this.userActivity.upsert({
        where: { userId_day: { userId: user.id, day } },
        create: { userId: user.id, day, [counter]: 1 },
        update: { [counter]: { increment: 1 } },
      });
    }
    await this.ensurePersonalSpace(user.id);
    return user;
  }
  async collectionOwned(userId: string, id?: string | null) {
    if (id && !(await this.collection.findFirst({ where: { id, userId } }))) {
      throw new NotFoundException('Коллекция не найдена');
    }
  }
  async ownedItem(userId: string, id: string) {
    const item = await this.item.findFirst({ where: { id, userId } });
    if (!item) {
      throw new NotFoundException('Карточка не найдена');
    }
    return item;
  }
}
