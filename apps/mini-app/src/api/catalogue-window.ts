import { CATALOGUE_LIMITS, type ItemList, type ItemQuery } from '@tuckly/contracts';

import { catalogueApi } from './catalogue';

/** Rebuild the loaded window without discarding later pages after an edit. */
export async function loadCatalogueWindow(
  query: ItemQuery,
  targetCount: number,
  signal: AbortSignal,
  list: typeof catalogueApi.list = (filters, requestSignal) =>
    catalogueApi.list(filters, requestSignal),
): Promise<ItemList> {
  const first = await list(query, signal);
  const items = new Map(first.items.map(item => [item.id, item]));
  const visited = new Set<string>();
  let nextCursor = first.nextCursor;
  while (nextCursor && items.size < Math.max(CATALOGUE_LIMITS.pageSize, targetCount)) {
    if (visited.has(nextCursor)) {
      throw new Error('Не удалось продолжить загрузку списка. Повторите попытку.');
    }
    visited.add(nextCursor);
    const page = await list({ ...query, cursor: nextCursor }, signal);
    for (const item of page.items) {
      items.set(item.id, item);
    }
    nextCursor = page.nextCursor;
  }
  return { ...first, items: [...items.values()], nextCursor };
}
