import { Bot } from 'grammy';
import type { Message, User } from 'grammy/types';

import { COPY } from '@tuckly/contracts';

import { isAdmin } from '../auth/admin-access';
import { canonicalUrl } from '../common/normalize-url';
import { linkFromText, source } from '../common/urls';
import { Store } from '../database/database.service';
import { resolveStatus } from '../database/statuses';

import { extractMedia } from './telegram-media.service';

export async function saveIncoming(db: Store, message: Message, from: User) {
  if (message.chat.type !== 'private' || message.chat.id !== from.id) {
    return null;
  }
  const user = await db.userUpsert(from.id, from.first_name, from.username, 'bot');
  const eventId = `${message.chat.id}:${message.message_id}`;
  const media = extractMedia(message);
  const text = message.text || message.caption || '';
  if (!media && (!text || message.document)) {
    return null;
  }
  const url = media ? undefined : linkFromText(text);
  const spaceId = await db.ensurePersonalSpace(user.id);
  const normalized = url ? canonicalUrl(url) : undefined;
  return db.$transaction(async tx => {
    const status = await resolveStatus(tx, spaceId);
    if (normalized) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${spaceId + '|' + normalized},0))`;
      const candidates = await tx.item.findMany({
        where: {
          spaceId,
          OR: [{ canonicalUrl: normalized }, { canonicalUrl: null, url: { not: null } }],
        },
      });
      const existing = candidates.find(item => {
        try {
          return (
            item.canonicalUrl === normalized || (item.url && canonicalUrl(item.url) === normalized)
          );
        } catch {
          return false;
        }
      });
      if (existing) {
        return existing;
      }
    }
    return tx.item.upsert({
      where: { telegramMessageId: eventId },
      update: {},
      create: {
        userId: user.id,
        spaceId,
        status,
        type: media?.type || (url ? 'link' : 'text'),
        title: url
          ? source(url) || url
          : text.slice(0, 160) || (media?.type === 'video' ? 'Видео' : 'Фото'),
        titleMode: url ? 'auto' : 'custom',
        text,
        url,
        canonicalUrl: normalized,
        source: media ? 'Telegram' : source(normalized),
        ...media,
        telegramMessageId: eventId,
      },
    });
  });
}
export function createBot(db: Store, token: string) {
  const bot = new Bot(token, {
    client: {
      apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
    },
  });
  const openAdmin = async (ctx: import('grammy').Context) => {
    if (!ctx.from || !isAdmin(String(ctx.from.id))) {
      return ctx.reply(COPY.adminOnly);
    }
    if (!process.env.MINI_APP_URL) {
      return ctx.reply('Админка ещё не настроена: требуется MINI_APP_URL');
    }
    const url = new URL(process.env.MINI_APP_URL);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/admin`;
    url.search = '';
    url.hash = '';
    return ctx.reply(COPY.adminLogin, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: url.toString() } }]],
      },
    });
  };
  bot.chatType('private').command('admin', openAdmin);
  bot.chatType('private').command('start', async ctx => {
    if (ctx.match === 'admin') {
      return openAdmin(ctx);
    }
    await db.userUpsert(ctx.from.id, ctx.from.first_name, ctx.from.username, 'bot');
    return ctx.reply(
      COPY.welcome,
      process.env.MINI_APP_URL
        ? {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: COPY.bot.openCollection,
                    web_app: {
                      url: (() => {
                        const url = new URL(process.env.MINI_APP_URL!);
                        if (/^join_[\w-]{32}$/.test(ctx.match)) {
                          url.searchParams.set('invite', ctx.match.slice(5));
                        }
                        return url.toString();
                      })(),
                    },
                  },
                ],
              ],
            },
          }
        : {},
    );
  });
  bot.on('message', async ctx => {
    if (ctx.chat.type !== 'private' || !ctx.from) {
      return;
    }
    try {
      const item = await saveIncoming(db, ctx.message, ctx.from);
      await ctx.reply(item ? COPY.bot.saved : COPY.bot.unsupported);
    } catch {
      await ctx.reply(COPY.bot.saveError);
    }
  });
  bot.catch(() => console.error('Telegram update failed'));
  return bot;
}
