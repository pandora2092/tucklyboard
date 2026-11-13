import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalUrl } from './normalize-url';

void test('YouTube share, shorts, embed and watch use one canonical URL', () => {
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ?si=tracking',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ]) {
    assert.equal(canonicalUrl(url), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }
});
void test('normalization removes tracking while preserving meaningful query and SPA routes', () => {
  assert.equal(
    canonicalUrl('https://example.com/page?utm_source=tg&b=2&a=1#section'),
    'https://example.com/page?a=1&b=2',
  );
  assert.equal(canonicalUrl('https://example.com/#/post/12'), 'https://example.com/#/post/12');
  assert.throws(() => canonicalUrl('file:///etc/passwd'));
  assert.throws(() => canonicalUrl('https://user:pass@example.com'));
});
