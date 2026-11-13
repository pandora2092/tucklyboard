import assert from 'node:assert/strict';
import test from 'node:test';

import { autoTags, cosine, documentText, topicScore } from './topics';

void test('bilingual topics connect recipes and dinner without matching unrelated notes', () => {
  assert.ok(autoTags('A pasta recipe for dinner').includes('рецепты'));
  assert.ok(topicScore('что приготовить на ужин', 'Pasta recipe') > 0);
  assert.equal(topicScore('что приготовить на ужин', 'React TypeScript API'), 0);
  assert.ok(autoTags('React tutorial').includes('программирование'));
});
void test('dismissed tags are excluded from searchable document', () => {
  const text = documentText({
    title: 'Title',
    text: 'My note',
    tags: ['manual'],
    autoTags: ['hidden', 'accepted'],
    dismissedAutoTags: ['hidden'],
  });
  assert.ok(!text.includes('hidden'));
  assert.ok(text.includes('accepted'));
  assert.ok(text.includes('My note'));
});
void test('cosine rejects mismatched and zero vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.equal(cosine([1], [1, 0]), 0);
  assert.equal(cosine([1, 0], [0, 1]), 0);
});
