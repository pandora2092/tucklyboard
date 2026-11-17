import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SpaceSchema } from './index';
import {
  DEFAULT_SPACE_BACKGROUND,
  SPACE_BACKGROUND_PATTERNS,
  SpaceBackgroundSchema,
} from './space-backgrounds';
import { UpdateSpaceSchema } from './space-themes';

void test('existing spaces without a background retain the dot pattern', () => {
  assert.deepEqual(
    SpaceSchema.parse({ id: 'old', name: 'Space', personal: true, role: 'owner', memberCount: 1 })
      .background,
    DEFAULT_SPACE_BACKGROUND,
  );
});

void test('background updates support each pattern and reject invalid control values', () => {
  for (const pattern of Object.keys(SPACE_BACKGROUND_PATTERNS)) {
    assert.equal(
      UpdateSpaceSchema.parse({ background: { pattern, contrast: 80, scale: 'large' } }).background
        ?.pattern,
      pattern,
    );
  }
  for (const contrast of [9, 81, 42.5, '42', null]) {
    assert.equal(
      SpaceBackgroundSchema.safeParse({ ...DEFAULT_SPACE_BACKGROUND, contrast }).success,
      false,
    );
  }
  for (const patch of [
    { pattern: 'url(https://example.com)' },
    { scale: 'huge' },
    { unknown: true },
  ]) {
    assert.equal(
      UpdateSpaceSchema.safeParse({ background: { ...DEFAULT_SPACE_BACKGROUND, ...patch } })
        .success,
      false,
    );
  }
  assert.equal(UpdateSpaceSchema.safeParse({ background: { pattern: 'none' } }).success, false);
  assert.equal(UpdateSpaceSchema.safeParse({ background: null }).success, false);
});
