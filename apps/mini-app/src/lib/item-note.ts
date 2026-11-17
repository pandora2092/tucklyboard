import type { Item } from '@tuckly/contracts';

// Telegram saves the whole message as text. For a message containing only the
// original link, use the page description as the editable note instead.
export function initialItemNote(item: Item | null): string {
  if (!item) {
    return '';
  }
  if (item.type === 'link' && item.url && item.text.trim() === item.url.trim()) {
    return item.sourceDescription || '';
  }
  return item.text;
}
