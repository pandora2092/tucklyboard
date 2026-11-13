export function linkFromText(text: string) {
  const match = text.match(/https?:\/\/[^\s]+/i)?.[0];
  try {
    if (match && match.length <= 2000) {
      return new URL(match).href;
    }
  } catch {
    /* A matched token may not be a valid URL. */
  }
  return undefined;
}
export function source(url?: string) {
  return url ? new URL(url).hostname.replace(/^www\./, '') : '';
}
