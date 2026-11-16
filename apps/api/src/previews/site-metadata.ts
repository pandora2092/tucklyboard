import { Inject, Injectable } from '@nestjs/common';
import { load } from 'cheerio/slim';

import { youtubeId } from './link-preview.service';
import { embedEndpoints, readEmbed } from './oembed';
import { PAGE_LIMIT, tiktokMetadata } from './page-data';
import { PublicHttp } from './public-http';

export type SiteMetadata = {
  title: string | null;
  description: string | null;
  author: string | null;
};
const clean = (value: string | undefined, limit: number) =>
  value?.replace(/\s+/g, ' ').trim().slice(0, limit) || null;
export function parseMetadata(html: string): SiteMetadata {
  const $ = load(html);
  const meta = (key: string) =>
    $('meta')
      .toArray()
      .find(
        element =>
          ($(element).attr('property') || $(element).attr('name') || '').toLowerCase() === key,
      );
  const content = (key: string) => {
    const element = meta(key);
    return element ? $(element).attr('content') : undefined;
  };
  return {
    title: clean(content('og:title') || content('twitter:title') || $('title').first().text(), 300),
    description: clean(
      content('og:description') || content('twitter:description') || content('description'),
      4000,
    ),
    author: clean(
      content('author') || content('article:author') || content('citation_author'),
      200,
    ),
  };
}
@Injectable()
export class SiteMetadataService {
  constructor(@Inject(PublicHttp) private readonly http: PublicHttp) {}
  async get(url: string): Promise<SiteMetadata> {
    const signal = AbortSignal.timeout(12000);
    const video = youtubeId(url);
    if (video) {
      const endpoint = new URL('https://www.youtube.com/oembed');
      endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${video}`);
      endpoint.searchParams.set('format', 'json');
      const data = await readEmbed(this.http, endpoint.href, signal);
      if (data?.title) {
        return {
          title: clean(data.title, 300),
          description: null,
          author: clean(data.author_name, 200),
        };
      }
    }
    const page = await this.http.get(url, {
      maxBytes: PAGE_LIMIT,
      accept: 'text/html,application/xhtml+xml',
      signal,
    });
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(page.contentType)) {
      throw new Error('No page metadata');
    }
    const html = page.bytes.toString('utf8');
    const metadata = parseMetadata(html);
    const tiktok = tiktokMetadata(html, page.url);
    metadata.title = clean(tiktok?.title, 300) || metadata.title;
    metadata.author = clean(tiktok?.author, 200) || metadata.author;
    for (const endpoint of embedEndpoints(html, page.url)) {
      const data = await readEmbed(this.http, endpoint, signal);
      if (!data) {
        continue;
      }
      metadata.title = clean(data.title, 300) || metadata.title;
      metadata.author = clean(data.author_name, 200) || metadata.author;
      break;
    }
    return metadata;
  }
}
