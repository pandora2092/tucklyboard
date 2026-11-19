export function createWebInviteUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  // A copied Mini App address can contain the owner's signed Telegram session.
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  url.searchParams.set('invite', token);
  return url.toString();
}
export const INVITE_START_PREFIX = 'j_';

export function isInviteToken(token: string): boolean {
  return /^(?:[\w-]{22}|[\w-]{32})$/.test(token);
}

export function parseInviteStartParameter(value: string | null | undefined): string {
  const prefix = value?.startsWith(INVITE_START_PREFIX)
    ? INVITE_START_PREFIX
    : value?.startsWith('join_')
      ? 'join_'
      : null;
  const token = prefix && value ? value.slice(prefix.length) : '';
  return isInviteToken(token) ? token : '';
}
