import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chooseSpace, readLastSpace, writeLastSpace } from './last-space';

const spaces = [
  { id: 'personal', personal: true },
  { id: 'family', personal: false },
  { id: 'work', personal: false },
];

void test('restores an accessible last space and prioritizes explicit navigation', () => {
  assert.equal(chooseSpace(spaces, '', 'family'), 'family');
  assert.equal(chooseSpace(spaces, 'work', 'family'), 'work');
  assert.equal(chooseSpace(spaces, 'personal', 'family'), 'personal');
});

void test('removed spaces fall back to the personal space before making catalogue requests', () => {
  assert.equal(chooseSpace(spaces, '', 'removed'), 'personal');
  assert.equal(chooseSpace(spaces, 'removed', 'removed'), 'personal');
  assert.equal(chooseSpace([], '', 'family'), '');
});

void test('space preference persists per account and unavailable storage does not break navigation', () => {
  const values = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  writeLastSpace('account-one', 'family', storage);
  writeLastSpace('account-two', 'work', storage);
  assert.equal(readLastSpace('account-one', storage), 'family');
  assert.equal(readLastSpace('account-two', storage), 'work');
  const blocked = () => {
    throw new Error('Storage blocked');
  };
  assert.equal(readLastSpace('account-one', blocked), '');
  assert.doesNotThrow(() => writeLastSpace('account-one', 'family', blocked));
});
