import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CreateItemSchema, ItemQuerySchema, ItemSchema, UpdateItemSchema } from './index';

void test('create requires HTTP(S) link and refuses internal file references', () => {
  assert.equal(CreateItemSchema.safeParse({ type: 'link', title: 'Link' }).success, false);
  assert.equal(
    CreateItemSchema.safeParse({
      type: 'link',
      title: 'Link',
      url: 'javascript:alert(1)',
    }).success,
    false,
  );
  assert.equal(
    CreateItemSchema.safeParse({
      type: 'text',
      title: 'Text',
      telegramFileId: 'private',
    }).success,
    false,
  );
  assert.deepEqual(CreateItemSchema.parse({ type: 'text', title: 'Text' }), {
    type: 'text',
    title: 'Text',
    text: '',
    tags: [],
  });
});
void test('partial updates do not erase fields absent from PATCH', () => {
  assert.deepEqual(UpdateItemSchema.parse({ title: 'New' }), { title: 'New' });
  assert.equal(UpdateItemSchema.safeParse({ telegramFileId: 'other-user' }).success, false);
});
void test('query rejects arrays and unsupported media types', () => {
  assert.equal(ItemQuerySchema.safeParse({ tag: ['one', 'two'] }).success, false);
  assert.equal(ItemQuerySchema.safeParse({ type: 'document' }).success, false);
});
void test('public item contract strips private references and rejects malformed responses', () => {
  const data = {
    id: 'id',
    type: 'photo',
    title: 'Photo',
    text: '',
    url: null,
    source: 'Telegram',
    tags: [],
    collectionId: null,
    mime: 'image/png',
    createdAt: '2026-11-11T00:00:00.000Z',
    storage: 'telegram',
    fileSize: 12,
    previewUrl: '/api/items/id/preview',
    mediaUrl: null,
    canSendToChat: true,
    telegramFileId: 'secret',
  };
  assert.equal('telegramFileId' in ItemSchema.parse(data), false);
  assert.equal(ItemSchema.safeParse({ ...data, createdAt: 'not a date' }).success, false);
});
