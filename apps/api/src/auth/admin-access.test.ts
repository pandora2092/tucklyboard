import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isAdmin } from './admin-access';

void test('admin access is closed by default and only matches complete numeric IDs', () => {
  const previous = process.env.ADMIN_TELEGRAM_IDS;
  try {
    delete process.env.ADMIN_TELEGRAM_IDS;
    assert.equal(isAdmin('123'), false);
    process.env.ADMIN_TELEGRAM_IDS = ' 123, 456 , @username, 0123, * ';
    assert.equal(isAdmin('123'), true);
    assert.equal(isAdmin('456'), true);
    assert.equal(isAdmin('12'), false);
    assert.equal(isAdmin('0123'), false);
    assert.equal(isAdmin('@username'), false);
    assert.equal(isAdmin(''), false);
  } finally {
    if (previous === undefined) {
      delete process.env.ADMIN_TELEGRAM_IDS;
    } else {
      process.env.ADMIN_TELEGRAM_IDS = previous;
    }
  }
});
