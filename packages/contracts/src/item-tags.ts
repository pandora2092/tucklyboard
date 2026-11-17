export const ITEM_TAG_LIMIT = 20;

type TagFields = { tags: string[]; autoTags: string[]; dismissedAutoTags: string[] };

/** Manual choices come first; automatically applied tags fill the remaining slots. */
export function effectiveItemTags(item: TagFields): string[] {
  return [
    ...new Set([
      ...item.tags,
      ...item.autoTags.filter(tag => !item.dismissedAutoTags.includes(tag)),
    ]),
  ].slice(0, ITEM_TAG_LIMIT);
}

/** Remember removals so enrichment cannot put an unwanted tag back. */
export function editedTagDismissals(item: TagFields, nextTags: string[]): string[] {
  return [
    ...new Set([
      ...item.dismissedAutoTags,
      ...effectiveItemTags(item).filter(tag => !nextTags.includes(tag)),
    ]),
  ].filter(tag => !nextTags.includes(tag));
}
