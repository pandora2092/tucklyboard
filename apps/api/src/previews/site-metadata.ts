import { Inject, Injectable } from '@nestjs/common';
import { load } from 'cheerio/slim';

import { youtubeId } from './link-preview.service';
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
    const video = youtubeId(url);
    if (video) {
      const endpoint = new URL('https://www.youtube.com/oembed');
      endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${video}`);
      endpoint.searchParams.set('format', 'json');
      const page = await this.http.get(endpoint.href, {
        maxBytes: 256 * 1024,
        accept: 'application/json',
      });
      const value: unknown = JSON.parse(page.bytes.toString('utf8'));
      if (value && typeof value === 'object') {
        return {
          title: clean(
            'title' in value && typeof value.title === 'string' ? value.title : undefined,
            300,
          ),
          description: null,
          author: clean(
            'author_name' in value && typeof value.author_name === 'string'
              ? value.author_name
              : undefined,
            200,
          ),
        };
      }
    }
    const page = await this.http.get(url, {
      maxBytes: 1024 * 1024,
      accept: 'text/html,application/xhtml+xml',
    });
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(page.contentType)) {
      throw new Error('No page metadata');
    }
    return parseMetadata(page.bytes.toString('utf8'));
  }
}
