import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Item } from '@prisma/client';
import { Api, GrammyError, InputFile } from 'grammy';
import type { Message } from 'grammy/types';

import { MEDIA_MIMES, UPLOAD_LIMIT } from '@tuckly/contracts';

export { UPLOAD_LIMIT, MEDIA_MIMES };
const PREVIEW_LIMIT = 2 * 1024 * 1024;
export function extractMedia(message: Message, verifiedUploadMime?: string) {
  const photo = message.photo?.at(-1);
  const document = message.document;
  const video = message.video;
  if (
    !photo &&
    !video &&
    !(document && /^(image|video)\//.test(verifiedUploadMime || document.mime_type || ''))
  ) {
    return null;
  }
  const file = photo || video || document!;
  const mime = photo
    ? 'image/jpeg'
    : video?.mime_type || verifiedUploadMime || document?.mime_type || 'video/mp4';
  const thumbnail = photo
    ? message.photo?.find(p => p.width >= 160 && p.width <= 640) || message.photo?.[0]
    : video?.thumbnail || document?.thumbnail;
  return {
    type: mime.startsWith('image/') ? 'photo' : 'video',
    telegramFileId: file.file_id,
    telegramFileUniqueId: file.file_unique_id,
    telegramMediaKind: photo ? 'photo' : video ? 'video' : 'document',
    telegramThumbnailFileId: thumbnail?.file_id,
    telegramFileSize: file.file_size === undefined ? null : BigInt(file.file_size),
    mime,
  };
}
export function previewFileId(item: Item) {
  if (item.telegramThumbnailFileId) {
    return item.telegramThumbnailFileId;
  }
  // Small photos sent as documents may not have a Telegram-generated thumbnail.
  if (
    item.type === 'photo' &&
    item.telegramFileSize !== null &&
    item.telegramFileSize <= BigInt(PREVIEW_LIMIT)
  ) {
    return item.telegramFileId;
  }
  return null;
}

@Injectable()
export class TelegramMedia {
  private client?: Api;
  get configured() {
    return Boolean(process.env.BOT_TOKEN);
  }
  private api() {
    if (!process.env.BOT_TOKEN) {
      throw new ServiceUnavailableException('Для медиа настройте BOT_TOKEN и откройте чат с ботом');
    }
    return (this.client ??= new Api(process.env.BOT_TOKEN, {
      apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
      timeoutSeconds: 60,
    }));
  }
  private failure(error: unknown): never {
    if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
      throw error;
    }
    if (error instanceof GrammyError && error.error_code === 403) {
      throw new BadRequestException(
        'Откройте чат с ботом, нажмите /start и разрешите ему отправлять сообщения',
      );
    }
    // Do not expose Telegram request URLs, tokens or file identifiers in API errors/logs.
    throw new BadGatewayException('Telegram временно не смог обработать файл. Попробуйте ещё раз');
  }
  async upload(chatId: string, bytes: Buffer, filename: string, title: string, mime: string) {
    try {
      const message = await this.api().sendDocument(chatId, new InputFile(bytes, filename), {
        caption: title.slice(0, 1024),
      });
      const media = extractMedia(message, mime);
      if (!media) {
        throw new BadRequestException('Telegram не распознал фото или видео');
      }
      return { media, messageId: `${message.chat.id}:${message.message_id}` };
    } catch (error) {
      this.failure(error);
    }
  }
  async send(chatId: string, item: Item) {
    if (!item.telegramFileId) {
      throw new BadRequestException('Этот файл ещё не перенесён в Telegram. Перешлите его боту');
    }
    try {
      const api = this.api();
      const options = { caption: item.title.slice(0, 1024) };
      if (item.telegramMediaKind === 'photo') {
        await api.sendPhoto(chatId, item.telegramFileId, options);
      } else if (item.telegramMediaKind === 'video') {
        await api.sendVideo(chatId, item.telegramFileId, options);
      } else {
        await api.sendDocument(chatId, item.telegramFileId, options);
      }
    } catch (error) {
      this.failure(error);
    }
  }
  async preview(item: Item): Promise<Buffer> {
    const id = previewFileId(item);
    if (!id) {
      throw new BadRequestException('У этого файла нет превью. Получите оригинал в Telegram');
    }
    try {
      const file = await this.api().getFile(id);
      if (
        !file.file_path ||
        (file.file_size || 0) > PREVIEW_LIMIT ||
        !/^[\w./-]+$/.test(file.file_path) ||
        file.file_path.split('/').includes('..')
      ) {
        throw new BadRequestException('Превью недоступно');
      }
      const root = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org';
      const response = await fetch(`${root}/file/bot${process.env.BOT_TOKEN}/${file.file_path}`, {
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      if (
        !response.ok ||
        !response.body ||
        Number(response.headers.get('content-length') || 0) > PREVIEW_LIMIT
      ) {
        await response.body?.cancel();
        throw new Error('preview');
      }
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          size += value.byteLength;
          if (size > PREVIEW_LIMIT) {
            throw new Error('size');
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return Buffer.concat(chunks);
    } catch (error) {
      this.failure(error);
    }
  }
}

export function imageMime(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
export function validMedia(bytes: Buffer, mime: string) {
  if (mime.startsWith('image/')) {
    return imageMime(bytes) === mime;
  }
  if (mime === 'video/mp4') {
    return bytes.toString('ascii', 4, 8) === 'ftyp';
  }
  if (mime === 'video/webm') {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return false;
}
