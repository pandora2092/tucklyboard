import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import {
  collectLimited,
  isPublicAddress,
  pinnedLookup,
  PublicHttp,
  publicUrl,
  resolvePublicAddress,
  type PublicAddress,
} from './public-http';

void test('blocks loopback, private, link-local, mapped and non-public ranges', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
    'not-an-ip',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

void test('accepts only HTTP(S) without credentials on standard ports', () => {
  for (const url of [
    'file:///etc/passwd',
    'ftp://example.com/a',
    'data:text/html,test',
    'https://user:secret@example.com',
    'https://example.com:8080/a',
  ]) {
    assert.throws(() => publicUrl(url), undefined, url);
  }
  assert.equal(publicUrl('https://example.com/a#tracking').href, 'https://example.com/a');
});

void test('rejects mixed public/private DNS and numeric loopback encodings', async () => {
  await assert.rejects(
    resolvePublicAddress(publicUrl('https://example.com'), async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]),
  );
  for (const url of ['http://2130706433/', 'http://0x7f000001/', 'http://[::ffff:127.0.0.1]/']) {
    await assert.rejects(resolvePublicAddress(publicUrl(url), async () => []));
  }
});

void test('pins the socket lookup to the address validated earlier', () => {
  const lookup = pinnedLookup({ address: '8.8.8.8', family: 4 });
  lookup('example.com', {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, '8.8.8.8');
    assert.equal(family, 4);
  });
  lookup('example.com', { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
  });
});

void test('bounds streamed responses even without Content-Length', async () => {
  await assert.rejects(collectLimited(Readable.from([Buffer.alloc(7), Buffer.alloc(7)]), 10));
  assert.deepEqual(await collectLimited(Readable.from([Buffer.from('ok')]), 10), Buffer.from('ok'));
});

class RedirectHttp extends PublicHttp {
  readonly requests: string[] = [];
  constructor(private readonly location: string) {
    super();
  }
  protected override address(url: URL, _signal: AbortSignal) {
    return resolvePublicAddress(url, async () => [{ address: '8.8.8.8', family: 4 }]);
  }
  protected override async connect(
    url: URL,
    _address: PublicAddress,
    _signal: AbortSignal,
    _accept: string,
  ) {
    this.requests.push(url.href);
    return Object.assign(Readable.from([]), {
      statusCode: 302,
      headers: { location: this.location },
    }) as unknown as IncomingMessage;
  }
}

void test('revalidates redirects before connecting to a private host', async () => {
  const http = new RedirectHttp('http://169.254.169.254/latest/meta-data/');
  await assert.rejects(http.get('https://example.com', { maxBytes: 100, accept: 'text/html' }));
  assert.equal(http.requests.length, 1);
});

void test('bounds redirect loops and rejects an already cancelled request', async () => {
  const http = new RedirectHttp('/again');
  await assert.rejects(http.get('https://example.com', { maxBytes: 100, accept: 'text/html' }));
  assert.equal(http.requests.length, 4);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    http.get('https://example.com', {
      maxBytes: 100,
      accept: 'text/html',
      signal: controller.signal,
    }),
  );
  assert.equal(http.requests.length, 4);
});

void test('prefers a validated IPv4 address when IPv6 routing may be unavailable', async () => {
  const result = await resolvePublicAddress(publicUrl('https://example.com'), async () => [
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '8.8.8.8', family: 4 },
  ]);
  assert.equal(result.address, '8.8.8.8');
});
