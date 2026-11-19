import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BRAND, BRAND_ARTWORK, COPY } from '@tuckly/contracts';

import { bootMarkup } from './boot-markup';

void test('the first HTML screen includes the animated logo and a lightweight live loader', () => {
  const markup = bootMarkup();
  assert.match(markup, /id="app-boot"/);
  assert.ok(markup.includes(BRAND.name));
  assert.ok(markup.includes(COPY.loadingApp));
  assert.ok(markup.includes(`d="${BRAND_ARTWORK.flower}"`));
  assert.ok(markup.includes(`viewBox="${BRAND_ARTWORK.logoViewBox}"`));
  assert.ok(markup.includes('app-intro-dots'));
  assert.equal((markup.match(/<span><\/span>/g) || []).length, 3);
  for (const path of BRAND_ARTWORK.letters) {
    assert.ok(markup.includes(`d="${path}"`));
  }
  assert.match(markup, /class="brand-logo-lettering"/);
  assert.match(markup, /pathLength="1"/);
  assert.match(markup, /opacity="0.16"/);
  assert.doesNotMatch(markup, /<(img|script|iframe)\b/);
  assert.doesNotMatch(markup, /\b(src|href)=/);
});
