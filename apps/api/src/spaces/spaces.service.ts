import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { DEFAULT_STATUSES, type SpaceRole, type SpaceTheme } from '@tuckly/contracts';

import { Store } from '../database/database.service';
import { TelegramMedia } from '../telegram/telegram-media.service';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class SpacesService {
  constructor(
    @Inject(Store) private readonly db: Store,
    @Inject(TelegramMedia) private readonly telegram: TelegramMedia,
  ) {}
  async access(user: User, spaceId?: string, write = false, owner = false) {
    const id = spaceId || (await this.db.ensurePersonalSpace(user.id));
    const member = await this.db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: user.id } },
      include: { space: true },
    });
    if (!member) {
      throw new NotFoundException('Пространство недоступно');
    }
    if ((write && member.role === 'viewer') || (owner && member.role !== 'owner')) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return { id, role: member.role as SpaceRole, space: member.space };
  }
  async list(user: User) {
    await this.db.ensurePersonalSpace(user.id);
    const rows = await this.db.spaceMember.findMany({
      where: { userId: user.id },
      include: { space: { include: { _count: { select: { members: true } } } } },
      orderBy: { space: { createdAt: 'asc' } },
    });
    return rows.map(row => ({
      id: row.spaceId,
      name: row.space.name,
      theme: row.space.theme,
      role: row.role,
      personal: row.space.personalUserId === user.id,
      memberCount: row.space._count.members,
    }));
  }
  async create(user: User, name: string) {
    const space = await this.db.space.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'owner' } },
        statuses: { create: DEFAULT_STATUSES.map(status => ({ ...status })) },
      },
    });
    return {
      id: space.id,
      name: space.name,
      theme: space.theme,
      role: 'owner',
      personal: false,
      memberCount: 1,
    };
  }
  async updateTheme(user: User, id: string, theme: SpaceTheme) {
    await this.access(user, id, false, true);
    await this.db.space.update({ where: { id }, data: { theme } });
    return { ok: true };
  }
  async members(user: User, id: string) {
    await this.access(user, id);
    const members = await this.db.spaceMember.findMany({
      where: { spaceId: id },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return members.map(member => ({
      userId: member.userId,
      name: member.user.name,
      role: member.role,
    }));
  }
  async changeRole(user: User, spaceId: string, userId: string, role: 'editor' | 'viewer') {
    const access = await this.access(user, spaceId, false, true);
    if (access.space.ownerId === userId) {
      throw new BadRequestException('Роль владельца менять нельзя');
    }
    const changed = await this.db.spaceMember.updateMany({
      where: { spaceId, userId },
      data: { role },
    });
    if (!changed.count) {
      throw new NotFoundException();
    }
    return { ok: true };
  }
  async removeMember(user: User, spaceId: string, userId: string) {
    const access = await this.access(user, spaceId, false, user.id !== userId);
    if (access.space.ownerId === userId) {
      throw new BadRequestException('Владелец не может покинуть пространство');
    }
    await this.db.spaceMember.deleteMany({ where: { spaceId, userId } });
    return { ok: true };
  }
  async invite(user: User, spaceId: string, role: 'editor' | 'viewer', days: number) {
    const access = await this.access(user, spaceId, false, true);
    if (access.space.personalUserId) {
      throw new BadRequestException('Для приглашений создайте отдельное пространство');
    }
    const bot = await this.telegram.botUsername();
    const token = randomBytes(24).toString('base64url');
    const row = await this.db.spaceInvite.create({
      data: {
        spaceId,
        role,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + days * 86400000),
      },
    });
    return {
      id: row.id,
      role,
      expiresAt: row.expiresAt.toISOString(),
      revoked: false,
      uses: 0,
      token,
      telegramUrl: bot ? `https://t.me/${bot}?start=join_${token}` : null,
    };
  }
  async invites(user: User, id: string) {
    await this.access(user, id, false, true);
    return (
      await this.db.spaceInvite.findMany({ where: { spaceId: id }, orderBy: { expiresAt: 'desc' } })
    ).map(row => ({
      id: row.id,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      revoked: Boolean(row.revokedAt),
      uses: row.uses,
    }));
  }
  async revoke(user: User, spaceId: string, id: string) {
    await this.access(user, spaceId, false, true);
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
      await tx.spaceInvite.updateMany({
        where: { id, spaceId },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }
  async deleteInvite(user: User, spaceId: string, id: string) {
    await this.access(user, spaceId, false, true);
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
      await tx.spaceInvite.deleteMany({ where: { id, spaceId } });
    });
    return { ok: true };
  }
  async inviteInfo(token: string) {
    const invite = await this.validInvite(token);
    return { spaceName: invite.space.name, role: invite.role };
  }
  private async validInvite(token: string) {
    if (!/^[\w-]{32}$/.test(token)) {
      throw new NotFoundException('Приглашение недействительно');
    }
    const row = await this.db.spaceInvite.findUnique({
      where: { tokenHash: hash(token) },
      include: { space: true },
    });
    if (!row || row.revokedAt || row.expiresAt <= new Date() || row.uses >= row.maxUses) {
      throw new NotFoundException('Приглашение истекло или отозвано');
    }
    return row;
  }
  async join(user: User, token: string) {
    const invite = await this.validInvite(token);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invite.id},0))`;
      const current = await tx.spaceInvite.findUnique({ where: { id: invite.id } });
      if (
        !current ||
        current.revokedAt ||
        current.expiresAt <= new Date() ||
        current.uses >= current.maxUses
      ) {
        throw new NotFoundException('Приглашение недействительно');
      }
      const existing = await tx.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: invite.spaceId, userId: user.id } },
      });
      if (!existing) {
        await tx.spaceMember.create({
          data: { spaceId: invite.spaceId, userId: user.id, role: current.role },
        });
        await tx.spaceInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
      }
      return { spaceId: invite.spaceId };
    });
  }
}
