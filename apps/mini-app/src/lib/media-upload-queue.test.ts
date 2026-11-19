import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ItemDetails } from '@tuckly/contracts';

import { MediaUploadQueue } from './media-upload-queue';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const details = (): ItemDetails => ({
  title: 'Фото',
  text: 'Заметка',
  tags: ['тег'],
  collectionIds: ['collection'],
  spaceId: 'original-space',
  status: 'later',
});

void test('uploads run sequentially and keep their destination independently of the dialog', async () => {
  const first = deferred();
  const calls: ItemDetails[] = [];
  let saved = 0;
  const queue = new MediaUploadQueue(
    async (_, data) => {
      calls.push(data);
      if (calls.length === 1) {
        await first.promise;
      }
    },
    () => {
      saved++;
    },
  );
  const data = details();
  queue.enqueue(new File(['first'], 'first.png'), data, 'Семья');
  data.spaceId = 'other-space';
  data.collectionIds?.push('other-collection');
  queue.enqueue(new File(['second'], 'second.png'), details(), 'Семья');
  assert.deepEqual(
    queue.getSnapshot().map(job => job.state),
    ['uploading', 'queued'],
  );
  assert.equal(calls.length, 1);
  queue.dismiss(1);
  assert.equal(queue.getSnapshot().length, 2, 'active jobs cannot be discarded');
  first.resolve();
  await tick();
  assert.equal(saved, 2);
  assert.deepEqual(calls[0], details(), 'destination and metadata are a snapshot');
  assert.deepEqual(
    queue.getSnapshot().map(job => job.state),
    ['saved', 'saved'],
  );
  assert.ok(
    queue.getSnapshot().every(job => !('draft' in job)),
    'completed jobs release their files',
  );
});

void test('failed uploads retain the file and metadata for one explicit retry without blocking the queue', async () => {
  const first = deferred();
  const retry = deferred();
  const file = new File(['photo'], 'photo.png');
  const calls: File[] = [];
  const queue = new MediaUploadQueue(
    async current => {
      calls.push(current);
      if (calls.length === 1) {
        await first.promise;
      }
      if (calls.length === 3) {
        await retry.promise;
      }
    },
    () => {},
  );
  queue.enqueue(file, details(), 'Семья');
  queue.enqueue(new File(['next'], 'next.png'), details(), 'Семья');
  first.reject(new Error('Нет соединения'));
  await tick();
  assert.deepEqual(
    queue.getSnapshot().map(job => job.state),
    ['error', 'saved'],
  );
  const failed = queue.getSnapshot()[0];
  assert.equal(failed.state === 'error' && failed.draft.file, file);
  queue.retry(1);
  queue.retry(1);
  assert.equal(calls.length, 3, 'repeated retry clicks cannot submit twice');
  assert.equal(calls[2], file);
  retry.resolve();
  await tick();
  assert.deepEqual(
    queue.getSnapshot().map(job => job.state),
    ['saved', 'saved'],
  );
});
