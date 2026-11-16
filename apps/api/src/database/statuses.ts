import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { DEFAULT_STATUSES } from '@tuckly/contracts';

export async function lockStatuses(tx: Prisma.TransactionClient, spaceId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'statuses:' + spaceId},0))`;
}
export async function ensureStatuses(tx: Prisma.TransactionClient, spaceId: string) {
  await lockStatuses(tx, spaceId);
  if (!(await tx.bookmarkStatus.count({ where: { spaceId } }))) {
    await tx.bookmarkStatus.createMany({
      data: DEFAULT_STATUSES.map(status => ({ ...status, spaceId })),
    });
  }
}
export async function resolveStatus(tx: Prisma.TransactionClient, spaceId: string, key?: string) {
  await lockStatuses(tx, spaceId);
  const status = await tx.bookmarkStatus.findFirst({
    where: {
      spaceId,
      ...(key ? { key } : { isDefault: true }),
    },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { key: 'asc' }],
  });
  if (!status) {
    throw new BadRequestException('Выберите существующий статус этого пространства');
  }
  return status.key;
}
