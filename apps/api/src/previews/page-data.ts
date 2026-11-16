import { load } from 'cheerio/slim';

// Modern pages often include several megabytes of hydration data.
export const PAGE_LIMIT = 4 * 1024 * 1024;

export function tiktokMetadata(html: string, pageUrl: string) {
  const url = new URL(pageUrl);
  if (!['www.tiktok.com', 'tiktok.com'].includes(url.hostname)) {
    return null;
  }
  const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!id) {
    return null;
  }
  try {
    const $ = load(html);
    const value = JSON.parse($('#__UNIVERSAL_DATA_FOR_REHYDRATION__').text());
    const item = value?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    // Only use the requested video's data, never recommendations or account images.
    if (!item || item.id !== id) {
      return null;
    }
    return {
      title: typeof item.desc === 'string' ? item.desc : undefined,
      author: typeof item.author?.nickname === 'string' ? item.author.nickname : undefined,
      images: [item.video?.originCover, item.video?.cover].filter(
        (value): value is string => typeof value === 'string' && Boolean(value),
      ),
    };
  } catch {
    return null;
  }
}
