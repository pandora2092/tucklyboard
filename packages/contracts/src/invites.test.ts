import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createWebInviteUrl } from './invites';

void test('share links exclude Telegram session data and all unrelated parameters', () => {
  const token = 'a'.repeat(32);
  const url = createWebInviteUrl(
    'https://app.example/library?auth_date=old&invite=old#tgWebAppData=synthetic-private-session&tgWebAppVersion=9.6',
    token,
  );
  assert.equal(url, `https://app.example/library?invite=${token}`);
  assert.equal(new URL(url).hash, '');
});
void test('share links never retain URL credentials', () => {
  assert.equal(
    createWebInviteUrl('https://user:password@app.example/', 'token'),
    'https://app.example/?invite=token',
  );
});
