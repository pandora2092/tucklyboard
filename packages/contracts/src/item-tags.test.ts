import assert from 'node:assert/strict';
import { test } from 'node:test';

import { editedTagDismissals, effectiveItemTags, ITEM_TAG_LIMIT } from './item-tags';

void test('automatically applied tags share one editable list without duplicates or dismissed tags', () => {
  assert.deepEqual(
    effectiveItemTags({
      tags: ['личное', 'фото'],
      autoTags: ['фото', 'природа', 'скрытый'],
      dismissedAutoTags: ['скрытый'],
    }),
    ['личное', 'фото', 'природа'],
  );
});
void test('manual tags keep their places when automatic tags would exceed the field limit', () => {
  const manual = Array.from({ length: ITEM_TAG_LIMIT }, (_, i) => `тег-${i}`);
  assert.deepEqual(
    effectiveItemTags({ tags: manual, autoTags: ['новый'], dismissedAutoTags: [] }),
    manual,
  );
});
void test('removing an automatic or manual tag prevents it from being re-applied', () => {
  assert.deepEqual(
    editedTagDismissals(
      { tags: ['личное'], autoTags: ['фото', 'природа'], dismissedAutoTags: ['раньше'] },
      ['природа'],
    ),
    ['раньше', 'личное', 'фото'],
  );
});
void test('explicitly adding a removed tag enables it again', () => {
  assert.deepEqual(
    editedTagDismissals({ tags: [], autoTags: ['фото'], dismissedAutoTags: ['фото', 'природа'] }, [
      'фото',
    ]),
    ['природа'],
  );
});
