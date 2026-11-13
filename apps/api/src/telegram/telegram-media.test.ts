import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Item } from '@prisma/client';

import { extractMedia, imageMime, previewFileId, validMedia } from './telegram-media.service';

const base = {
  message_id: 1,
  date: 1,
  chat: { id: 1, type: 'private' as const },
};
void test('indexes large Telegram video without a download-size restriction', () => {
  const media = extractMedia({
    ...base,
    video: {
      file_id: 'video',
      file_unique_id: 'unique',
      width: 1,
      height: 1,
      duration: 1,
      file_size: 4_000_000_000,
      mime_type: 'video/mp4',
    },
  });
  assert.equal(media?.telegramFileSize, 4_000_000_000n);
  assert.equal(media?.telegramMediaKind, 'video');
});
void test('keeps highest-quality photo reference and a separate small thumbnail', () => {
  const media = extractMedia({
    ...base,
    photo: [
      { file_id: 'thumb', file_unique_id: 't', width: 320, height: 320 },
      { file_id: 'original', file_unique_id: 'o', width: 1280, height: 1280 },
    ],
  });
  assert.equal(media?.telegramFileId, 'original');
  assert.equal(media?.telegramThumbnailFileId, 'thumb');
});
void test('recognizes image documents and ignores other documents', () => {
  const doc = {
    file_id: 'file',
    file_unique_id: 'unique',
    mime_type: 'image/png',
  };
  assert.equal(extractMedia({ ...base, document: doc })?.telegramMediaKind, 'document');
  assert.equal(
    extractMedia({
      ...base,
      document: { ...doc, mime_type: 'application/pdf' },
    }),
    null,
  );
});
void test('large originals without thumbnails are not downloaded for previews', () => {
  const item = {
    type: 'photo',
    telegramFileId: 'original',
    telegramThumbnailFileId: null,
    telegramFileSize: 30_000_000n,
  } as Item;
  assert.equal(previewFileId(item), null);
  assert.equal(previewFileId({ ...item, telegramThumbnailFileId: 'thumb' }), 'thumb');
  assert.equal(previewFileId({ ...item, telegramFileSize: null }), null);
});
void test('rejects HTML disguised as a photo and validates supported file signatures', () => {
  const html = Buffer.from('<script>alert(1)</script>');
  assert.equal(validMedia(html, 'image/png'), false);
  assert.equal(imageMime(html), null);
  assert.equal(validMedia(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(validMedia(Buffer.from('0000ftypisom'), 'video/mp4'), true);
});

void test('uses verified upload MIME when Telegram returns a generic document MIME', () => {
  const media = extractMedia(
    {
      ...base,
      document: {
        file_id: 'doc',
        file_unique_id: 'unique',
        mime_type: 'application/octet-stream',
      },
    },
    'image/png',
  );
  assert.equal(media?.type, 'photo');
  assert.equal(media?.mime, 'image/png');
});
