import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOGUE_LIMITS, type Item, type ItemList } from '@tuckly/contracts';

import { loadCatalogueWindow } from './catalogue-window';

// Only identity matters to the window loader; response validation lives in the API client.
const item = (id: string) => ({ id }) as Item;

void test('refresh keeps all loaded pages and the cursor for the next page', async () => {
  const requests: string[] = [];
  const result = await loadCatalogueWindow(
    { tag: 'saved' },
    120,
    new AbortController().signal,
    (query, signal) => {
      assert.equal(query.tag, 'saved');
      assert(signal);
      const start = Number(query.cursor || 0);
      requests.push(String(start));
      return Promise.resolve({
        items: Array.from({ length: CATALOGUE_LIMITS.pageSize }, (_, i) => item(String(start + i))),
        total: 500,
        nextCursor: String(start + CATALOGUE_LIMITS.pageSize),
      });
    },
  );
  assert.equal(result.items.length, 120);
  assert.equal(result.total, 500);
  assert.equal(result.nextCursor, '120');
  assert.deepEqual(requests, ['0', '40', '80']);
});

void test('refresh finishes when deletion has shortened the remaining list', async () => {
  let calls = 0;
  const result = await loadCatalogueWindow({}, 120, new AbortController().signal, () => {
    calls++;
    return Promise.resolve({ items: [item('only-card')], total: 1, nextCursor: null });
  });
  assert.equal(calls, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.nextCursor, null);
});

void test('overlapping pages do not duplicate cards and later copies contain fresh metadata', async () => {
  const pages: ItemList[] = [
    { items: [item('a'), item('b')], total: 3, nextCursor: 'next' },
    { items: [{ ...item('b'), title: 'Updated' }, item('c')], total: 3, nextCursor: null },
  ];
  const result = await loadCatalogueWindow({}, 80, new AbortController().signal, () =>
    Promise.resolve(pages.shift()!),
  );
  assert.deepEqual(
    result.items.map(item => item.id),
    ['a', 'b', 'c'],
  );
  assert.equal(result.items[1].title, 'Updated');
});

void test('a failed later page rejects the refresh instead of replacing the loaded list with a partial window', async () => {
  let calls = 0;
  await assert.rejects(
    loadCatalogueWindow({}, 80, new AbortController().signal, () => {
      if (++calls > 1) {
        return Promise.reject(new Error('Offline'));
      }
      return Promise.resolve({ items: [item('a')], total: 80, nextCursor: 'next' });
    }),
    /Offline/,
  );
});

void test('repeated cursors cannot cause an endless refresh', async () => {
  await assert.rejects(
    loadCatalogueWindow({}, 80, new AbortController().signal, () =>
      Promise.resolve({ items: [item('a')], total: 80, nextCursor: 'same' }),
    ),
    /продолжить загрузку/,
  );
});
