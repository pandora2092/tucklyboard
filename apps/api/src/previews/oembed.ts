import { load } from 'cheerio/slim';

import { PublicHttp, publicUrl } from './public-http';

export type EmbedMetadata = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  url?: string;
  type?: string;
};

export function embedEndpoints(html: string, pageUrl: string) {
  const $ = load(html);
  const endpoints: string[] = [];
  const base = $('base[href]').first().attr('href');
  let baseUrl = pageUrl;
  try {
    baseUrl = base ? publicUrl(new URL(base, pageUrl).href).href : pageUrl;
  } catch {
    /* Use the final page URL if its base is invalid. */
  }
  $('link[href]').each((_index, element) => {
    const rel = ($(element).attr('rel') || '').toLowerCase().split(/\s+/);
    const type = ($(element).attr('type') || '').toLowerCase().split(';')[0].trim();
    if (!rel.includes('alternate') || type !== 'application/json+oembed') {
      return;
    }
    try {
      endpoints.push(publicUrl(new URL($(element).attr('href')!, baseUrl).href).href);
    } catch {
      /* Ignore invalid discovery URLs. */
    }
  });
  const url = publicUrl(pageUrl);
  let provider: string | undefined;
  if (['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'].includes(url.hostname)) {
    provider = 'https://www.tiktok.com/oembed';
  }
  if (provider) {
    const endpoint = new URL(provider);
    endpoint.searchParams.set('url', url.href);
    endpoint.searchParams.set('format', 'json');
    endpoints.push(endpoint.href);
  }
  return [...new Set(endpoints)].slice(0, 2);
}

export async function readEmbed(http: PublicHttp, endpoint: string, signal: AbortSignal) {
  try {
    const result = await http.get(endpoint, {
      maxBytes: 256 * 1024,
      accept: 'application/json',
      signal,
    });
    const value: unknown = JSON.parse(result.bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const fields = value as Record<string, unknown>;
    const data: EmbedMetadata = {};
    for (const key of ['title', 'author_name', 'thumbnail_url', 'url', 'type'] as const) {
      if (typeof fields[key] === 'string') {
        data[key] = fields[key];
      }
    }
    return data;
  } catch {
    return null;
  }
}
