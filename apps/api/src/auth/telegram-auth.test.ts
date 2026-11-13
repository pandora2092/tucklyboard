import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import { verifyTelegram } from './telegram-auth';

const token = 'test-token';
function signed(date: number) {
  const p = new URLSearchParams({
    auth_date: String(date),
    user: JSON.stringify({ id: 123, first_name: 'Ann' }),
  });
  const check = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', key).update(check).digest('hex'));
  return p.toString();
}
void test('accepts signed Telegram data', () =>
  assert.equal(verifyTelegram(signed(1000), token, 1000000).id, 123));
void test('rejects tampering', () =>
  assert.throws(() => verifyTelegram(signed(1000).replace('Ann', 'Eve'), token, 1000000)));
void test('rejects expired data', () =>
  assert.throws(() => verifyTelegram(signed(1000), token, 5000000)));
void test('rejects future data', () =>
  assert.throws(() => verifyTelegram(signed(1000), token, 1000)));
