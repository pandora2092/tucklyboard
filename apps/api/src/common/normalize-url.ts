import { youtubeId } from '../previews/link-preview.service';

export function canonicalUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Нужна публичная HTTP(S) ссылка без логина и пароля');
  }
  const video = youtubeId(url.href);
  if (video) {
    return `https://www.youtube.com/watch?v=${video}`;
  }
  url.hostname = url.hostname.toLowerCase();
  for (const key of Array.from(url.searchParams.keys())) {
    if (
      /^utm_/i.test(key) ||
      ['fbclid', 'gclid', 'dclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid'].includes(
        key.toLowerCase(),
      )
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (!/^#!?\//.test(url.hash)) {
    url.hash = '';
  }
  return url.href;
}
