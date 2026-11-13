import assert from 'node:assert/strict';
import { test } from 'node:test';

import { imageCandidates, LinkPreview, youtubeId } from './link-preview.service';
import { PublicHttp, type FetchOptions, type RemoteResult } from './public-http';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2foAAAAASUVORK5CYII=',
  'base64',
);
class FixtureHttp extends PublicHttp {
  readonly requests: string[] = [];
  constructor(
    private readonly respond: (
      url: string,
      options: FetchOptions,
    ) => RemoteResult | Promise<RemoteResult>,
  ) {
    super();
  }
  override async get(url: string, options: FetchOptions) {
    this.requests.push(url);
    return this.respond(url, options);
  }
}
const image = (url: string): RemoteResult => ({ bytes: png, contentType: 'image/png', url });

void test('extracts YouTube video IDs from watch, short, live, embed and share URLs', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20',
    'https://youtu.be/dQw4w9WgXcQ?si=share',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/watch/?v=dQw4w9WgXcQ',
  ]) {
    assert.equal(youtubeId(url), 'dQw4w9WgXcQ', url);
  }
  for (const url of [
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=invalid',
    'https://youtube.com@127.0.0.1/watch?v=dQw4w9WgXcQ',
  ]) {
    assert.equal(youtubeId(url), null, url);
  }
});

void test('parses OG/Twitter metadata, entities, relative URLs and ignores scripts', () => {
  const html = `<script>const fake='<meta property="og:image" content="https://bad.example/fake.jpg">'</script><base href="/assets/"><meta content="cover.jpg?a=1&amp;b=2" property="og:image"><meta name="twitter:image" content="//cdn.example/card.png"><meta property="og:image" content="javascript:alert(1)">`;
  assert.deepEqual(imageCandidates(html, 'https://site.example/posts/one'), [
    'https://site.example/assets/cover.jpg?a=1&b=2',
    'https://cdn.example/card.png',
  ]);
});

void test('falls back from missing high-resolution YouTube cover and deduplicates concurrent requests', async () => {
  const http = new FixtureHttp(url => {
    if (url.endsWith('/maxresdefault.jpg')) {
      throw new Error('404');
    }
    return image(url);
  });
  const previews = new LinkPreview(http);
  const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
  const [one, two] = await Promise.all([previews.image(url), previews.image(url)]);
  assert.deepEqual(one.bytes, png);
  assert.equal(one.mime, 'image/png');
  assert.equal(one, two);
  assert.deepEqual(http.requests, [
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  ]);
  await previews.image(url);
  assert.equal(http.requests.length, 2);
});

void test('fetches Open Graph images and falls back to a Twitter card', async () => {
  const http = new FixtureHttp(url => {
    if (url === 'https://site.example/post') {
      return {
        url,
        contentType: 'text/html; charset=utf-8',
        bytes: Buffer.from(
          '<meta property="og:image" content="/broken.jpg"><meta name="twitter:image" content="/good.png">',
        ),
      };
    }
    if (url.endsWith('/broken.jpg')) {
      throw new Error('unavailable');
    }
    return image(url);
  });
  assert.deepEqual((await new LinkPreview(http).image('https://site.example/post')).bytes, png);
  assert.deepEqual(http.requests, [
    'https://site.example/post',
    'https://site.example/broken.jpg',
    'https://site.example/good.png',
  ]);
});

void test('caches missing images without repeatedly fetching the page and rejects non-image covers', async () => {
  const http = new FixtureHttp(url => ({
    url,
    contentType: 'text/html',
    bytes: Buffer.from('<meta property="og:image" content="/not-an-image">'),
  }));
  const previews = new LinkPreview(http);
  await assert.rejects(previews.image('https://site.example/post'));
  await assert.rejects(previews.image('https://site.example/post'));
  assert.equal(http.requests.length, 2);
});

void test('bounds concurrent outbound preview jobs', async () => {
  let running = 0;
  let peak = 0;
  const http = new FixtureHttp(async url => {
    ++running;
    peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 5));
    --running;
    return image(url);
  });
  const previews = new LinkPreview(http);
  await Promise.all(
    Array.from({ length: 12 }, (_value, i) => previews.image(`https://site.example/${i}`)),
  );
  assert.equal(peak, 4);
});
