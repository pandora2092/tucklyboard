import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMetadata } from './site-metadata';

void test('metadata prioritizes OpenGraph and cleans whitespace without executing HTML', () => {
  assert.deepEqual(
    parseMetadata(
      '<title>Fallback</title><meta property="og:title" content="Hello &amp; world"><meta name="description" content=" A   description "><meta name="author" content="Author"><script>throw new Error()</script>',
    ),
    { title: 'Hello & world', description: 'A description', author: 'Author' },
  );
  assert.deepEqual(parseMetadata('<body>No metadata</body>'), {
    title: null,
    description: null,
    author: null,
  });
  assert.equal(parseMetadata('<title>' + 'a'.repeat(500) + '</title>').title?.length, 300);
});

void test('discovered oEmbed supplies content title and author while preserving page description', async () => {
  const { SiteMetadataService } = await import('./site-metadata');
  const { PublicHttp } = await import('./public-http');
  class Http extends PublicHttp {
    override async get(url: string) {
      return url === 'https://site.example/post'
        ? {
            url,
            contentType: 'text/html',
            bytes: Buffer.from(
              '<title>Generic site</title><meta name="description" content="Description"><link rel="alternate" type="application/json+oembed" href="/embed">',
            ),
          }
        : {
            url,
            contentType: 'application/json',
            bytes: Buffer.from('{"title":"Actual post","author_name":"Author"}'),
          };
    }
  }
  assert.deepEqual(await new SiteMetadataService(new Http()).get('https://site.example/post'), {
    title: 'Actual post',
    description: 'Description',
    author: 'Author',
  });
});

void test('failed YouTube oEmbed falls back to page metadata', async () => {
  const { SiteMetadataService } = await import('./site-metadata');
  const { PublicHttp } = await import('./public-http');
  class Http extends PublicHttp {
    override async get(url: string) {
      if (url.includes('/oembed')) {
        throw new Error('Unavailable');
      }
      return { url, contentType: 'text/html', bytes: Buffer.from('<title>Video title</title>') };
    }
  }
  assert.equal(
    (await new SiteMetadataService(new Http()).get('https://youtu.be/dQw4w9WgXcQ')).title,
    'Video title',
  );
});
