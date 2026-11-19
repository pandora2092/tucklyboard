import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Item } from '@prisma/client';

import { matchesSmartRules } from './smart-collections';

const now = Date.UTC(2026, 10, 19, 12);
const item = {
  type: 'text',
  source: 'Telegram',
  status: 'saved',
  userId: 'author',
  createdAt: new Date(now - 86400000),
  tags: ['Умная'],
  autoTags: ['обучение', 'скрытый'],
  dismissedAutoTags: ['скрытый'],
} as Item;
void test('a smart collection requires every condition, including exact manual or active automatic tags', () => {
  assert.equal(
    matchesSmartRules(
      item,
      {
        type: 'text',
        source: 'Telegram',
        status: 'saved',
        addedBy: 'author',
        days: 1,
        tags: ['Умная', 'обучение'],
      },
      now,
    ),
    true,
  );
  for (const rules of [
    { type: 'photo' as const },
    { source: 'Other' },
    { status: 'done' },
    { addedBy: 'other' },
    { tags: ['умная'] },
    { tags: ['скрытый'] },
    { tags: ['Умная', 'missing'] },
  ]) {
    assert.equal(matchesSmartRules(item, rules, now), false);
  }
  assert.equal(
    matchesSmartRules({ ...item, createdAt: new Date(now - 86400001) }, { days: 1 }, now),
    false,
  );
  assert.equal(
    matchesSmartRules({ ...item, tags: ['скрытый'] }, { tags: ['скрытый'] }, now),
    true,
    'explicit manual tag overrides dismissal',
  );
  assert.equal(matchesSmartRules(item, {}, now), true);
});
