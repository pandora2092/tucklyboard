import assert from 'node:assert/strict';
import test from 'node:test';

import { EmbeddingsService } from './embeddings.service';

void test('optional embedding adapter validates vectors and supports both response shapes', async () => {
  const originalFetch = globalThis.fetch;
  const saved = {
    url: process.env.EMBEDDINGS_URL,
    model: process.env.EMBEDDINGS_MODEL,
    key: process.env.EMBEDDINGS_API_KEY,
  };
  const service = new EmbeddingsService();
  try {
    delete process.env.EMBEDDINGS_URL;
    assert.equal(await service.embed('hello'), null);
    process.env.EMBEDDINGS_URL = 'http://model.test/api/embed';
    process.env.EMBEDDINGS_MODEL = 'test-model';
    process.env.EMBEDDINGS_API_KEY = 'secret';
    let payload: unknown;
    globalThis.fetch = async (_input, init) => {
      assert.equal(typeof init?.body, 'string');
      payload = JSON.parse(init!.body as string);
      assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer secret');
      return Response.json({ embeddings: [[1, 0, 0.5]] });
    };
    assert.deepEqual(await service.embed('text'), [1, 0, 0.5]);
    assert.deepEqual(payload, { model: 'test-model', input: 'text' });
    globalThis.fetch = async () => Response.json({ data: [{ embedding: [0.5, 1] }] });
    assert.deepEqual(await service.embed('text'), [0.5, 1]);
    globalThis.fetch = async () => Response.json({ embeddings: [['bad', 1]] });
    assert.equal(await service.embed('text'), null);
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(await service.embed('text'), null);
    const first = service.fingerprint('text');
    process.env.EMBEDDINGS_MODEL = 'another-model';
    assert.notEqual(service.fingerprint('text'), first);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      EMBEDDINGS_URL: saved.url,
      EMBEDDINGS_MODEL: saved.model,
      EMBEDDINGS_API_KEY: saved.key,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
