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
