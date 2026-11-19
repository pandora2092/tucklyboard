import type { Space } from '@tuckly/contracts';

type SpaceOption = Pick<Space, 'id' | 'personal'>;
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage: StorageAccess = () => window.localStorage;
// The authenticated account's personal space is a stable, account-specific key.
const key = (personalSpaceId: string) => `tuckly:last-space:${personalSpaceId}`;

export function readLastSpace(personalSpaceId: string, storage = browserStorage): string {
  try {
    return storage().getItem(key(personalSpaceId)) || '';
  } catch {
    return '';
  }
}

export function writeLastSpace(personalSpaceId: string, spaceId: string, storage = browserStorage) {
  try {
    storage().setItem(key(personalSpaceId), spaceId);
  } catch {
    // Storage may be unavailable in a private or restricted WebView.
  }
}

export function chooseSpace(spaces: SpaceOption[], current: string, remembered: string): string {
  // Explicit navigation (including an invitation) takes precedence over storage.
  return (
    spaces.find(space => space.id === current)?.id ||
    spaces.find(space => space.id === remembered)?.id ||
    spaces.find(space => space.personal)?.id ||
    spaces[0]?.id ||
    ''
  );
}
