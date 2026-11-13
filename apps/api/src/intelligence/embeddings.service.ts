import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingsService {
  get model() {
    return process.env.EMBEDDINGS_MODEL || 'nomic-embed-text';
  }
  get configured() {
    return Boolean(process.env.EMBEDDINGS_URL);
  }
  fingerprint(text: string) {
    return createHash('sha256')
      .update(this.model + '\n' + text)
      .digest('hex');
  }
  async embed(text: string): Promise<number[] | null> {
    if (!process.env.EMBEDDINGS_URL) {
      return null;
    }
    try {
      const response = await fetch(process.env.EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.EMBEDDINGS_API_KEY
            ? { Authorization: `Bearer ${process.env.EMBEDDINGS_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({ model: this.model, input: text.slice(0, 12000) }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        return null;
      }
      const json: unknown = await response.json();
      let vector: unknown;
      if (json && typeof json === 'object') {
        if ('embeddings' in json && Array.isArray(json.embeddings)) {
          vector = json.embeddings[0];
        }
        if ('data' in json && Array.isArray(json.data)) {
          vector = json.data[0]?.embedding;
        }
      }
      if (
        Array.isArray(vector) &&
        vector.length > 0 &&
        vector.length <= 4096 &&
        vector.every(value => typeof value === 'number' && Number.isFinite(value))
      ) {
        return vector;
      }
    } catch {
      /* A missing model must not prevent saving or topic-based search. */
    }
    return null;
  }
}
