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
