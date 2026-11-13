import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { load } from 'cheerio/slim';

import { imageMime } from '../telegram/telegram-media.service';

import { PublicHttp, publicUrl } from './public-http';

export type LinkImage = { bytes: Buffer; mime: string };
type Cached = { value: LinkImage | null; expires: number };
const IMAGE_LIMIT = 2 * 1024 * 1024;
const CACHE_LIMIT = 32 * 1024 * 1024;

export function youtubeId(value: string) {
  try {
    const url = publicUrl(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null | undefined;
    if (['youtu.be', 'www.youtu.be'].includes(host)) {
      id = parts[0];
    } else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(host)
    ) {
      id =
        url.pathname.replace(/\/+$/, '') === '/watch'
          ? url.searchParams.get('v')
          : ['shorts', 'embed', 'live', 'v'].includes(parts[0])
            ? parts[1]
            : null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function imageCandidates(html: string, pageUrl: string) {
  const $ = load(html);
  const candidates: string[] = [];
  const values = new Map<string, string[]>();
  $('meta').each((_index, element) => {
    const key = ($(element).attr('property') || $(element).attr('name') || '').toLowerCase();
    const value = $(element).attr('content')?.trim();
    if (value) {
      values.set(key, [...(values.get(key) || []), value]);
    }
  });
  const base = $('base[href]').first().attr('href');
  let baseUrl = pageUrl;
  try {
    baseUrl = base ? publicUrl(new URL(base, pageUrl).href).href : pageUrl;
  } catch {
    /* Ignore unsupported base URLs; every image is checked independently. */
  }
  const raw = [
    ...[
      'og:image:secure_url',
      'og:image',
      'og:image:url',
      'twitter:image',
      'twitter:image:src',
    ].flatMap(key => values.get(key) || []),
    ...$('link[rel="image_src"]')
      .toArray()
      .map(element => $(element).attr('href') || ''),
  ];
  for (const value of raw) {
    try {
      const url = publicUrl(new URL(value, baseUrl).href).href;
      if (!candidates.includes(url)) {
        candidates.push(url);
      }
    } catch {
      /* Ignore malformed image metadata. */
    }
    if (candidates.length === 4) {
      break;
    }
  }
  return candidates;
}

@Injectable()
export class LinkPreview {
  private readonly cache = new Map<string, Cached>();
  private readonly pending = new Map<string, Promise<LinkImage | null>>();
  private readonly running = new Set<Promise<LinkImage | null>>();
  private cacheBytes = 0;

  constructor(@Inject(PublicHttp) private readonly http: PublicHttp) {}

  async image(url: string): Promise<LinkImage> {
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) {
      if (cached.value) {
        return cached.value;
      }
      throw new NotFoundException('У ссылки нет доступного превью');
    }
    let task = this.pending.get(url);
    if (!task) {
      if (this.pending.size >= 64) {
        throw new NotFoundException('Превью временно недоступно');
      }
      task = this.resolve(url)
        .then(value => {
          this.remember(url, value);
          return value;
        })
        .finally(() => this.pending.delete(url));
      this.pending.set(url, task);
    }
    const image = await task;
    if (!image) {
      throw new NotFoundException('У ссылки нет доступного превью');
    }
    return image;
  }

  private remember(url: string, value: LinkImage | null) {
    const old = this.cache.get(url);
    this.cacheBytes -= old?.value?.bytes.length || 0;
    this.cache.delete(url);
    this.cache.set(url, { value, expires: Date.now() + (value ? 30 * 60000 : 60000) });
    this.cacheBytes += value?.bytes.length || 0;
    while (this.cache.size > 128 || this.cacheBytes > CACHE_LIMIT) {
      const key = this.cache.keys().next().value;
      if (key === undefined) {
        break;
      }
      this.cacheBytes -= this.cache.get(key)?.value?.bytes.length || 0;
      this.cache.delete(key);
    }
  }

  private async resolve(url: string) {
    const signal = AbortSignal.timeout(12000);
    while (this.running.size >= 4) {
      await Promise.race(this.running);
      if (signal.aborted) {
        return null;
      }
    }
    const task = this.build(url, signal).catch(() => null);
    this.running.add(task);
    try {
      return await task;
    } finally {
      this.running.delete(task);
    }
  }

  private async readImage(url: string, signal: AbortSignal): Promise<LinkImage | null> {
    try {
      const result = await this.http.get(url, { maxBytes: IMAGE_LIMIT, accept: 'image/*', signal });
      const mime = imageMime(result.bytes);
      return mime ? { bytes: result.bytes, mime } : null;
    } catch {
      return null;
    }
  }

  private async build(url: string, signal: AbortSignal): Promise<LinkImage | null> {
    const id = youtubeId(url);
    if (id) {
      for (const quality of ['maxresdefault', 'hqdefault']) {
        const image = await this.readImage(`https://i.ytimg.com/vi/${id}/${quality}.jpg`, signal);
        if (image) {
          return image;
        }
      }
      return null;
    }
    const page = await this.http.get(url, {
      maxBytes: 1024 * 1024,
      accept: 'text/html,application/xhtml+xml,image/*',
      signal,
    });
    const mime = imageMime(page.bytes);
    if (mime) {
      return { bytes: page.bytes, mime };
    }
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(page.contentType)) {
      return null;
    }
    for (const candidate of imageCandidates(page.bytes.toString('utf8'), page.url)) {
      const image = await this.readImage(candidate, signal);
      if (image) {
        return image;
      }
    }
    return null;
  }
}
