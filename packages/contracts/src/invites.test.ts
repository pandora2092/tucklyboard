import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createWebInviteUrl, isInviteToken, parseInviteStartParameter } from './invites';

void test('short invitations and existing invitations resolve to their original tokens', () => {
  for (const token of ['Ab_-'.repeat(5) + 'Qw', 'Ab_-'.repeat(8)]) {
    assert.equal(isInviteToken(token), true);
    assert.equal(parseInviteStartParameter(`j_${token}`), token);
    assert.equal(parseInviteStartParameter(`join_${token}`), token);
  }
});

void test('unrelated start parameters and malformed tokens are not invitations', () => {
  for (const value of [
    undefined,
    null,
    '',
    'admin',
    'join_short',
    'j_' + 'a'.repeat(21),
    'j_' + 'a'.repeat(23),
    'join_' + 'a'.repeat(33),
    'j_' + '!'.repeat(22),
  ]) {
    assert.equal(parseInviteStartParameter(value), '');
  }
});

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
