import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

import { Injectable } from '@nestjs/common';
import ipaddr from 'ipaddr.js';

import { COPY } from '@tuckly/contracts';

export type PublicAddress = { address: string; family: number };
export type RemoteResult = { bytes: Buffer; contentType: string; url: string };
export type FetchOptions = { maxBytes: number; accept: string; signal?: AbortSignal };
type Resolver = (hostname: string) => Promise<PublicAddress[]>;

export function publicUrl(value: string) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port)) ||
    value.length > 4096
  ) {
    throw new Error('Unsupported preview URL');
  }
  url.hash = '';
  return url;
}

export function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export async function resolvePublicAddress(url: URL, resolve: Resolver) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6 }]
    : await resolve(hostname);
  if (!addresses.length || addresses.some(value => !isPublicAddress(value.address))) {
    throw new Error('Non-public preview address');
  }
  // Prefer IPv4 on dual-stack hosts; many deployments have no working IPv6 route.
  return addresses.find(value => value.family === 4) || addresses[0];
}

export function pinnedLookup(address: PublicAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
    } else {
      callback(null, address.address, address.family);
    }
  };
}

export async function collectLimited(stream: AsyncIterable<Uint8Array>, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > limit) {
      throw new Error('Preview response too large');
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new Error('Preview timed out'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([task, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function connect(url: URL, address: PublicAddress, signal: AbortSignal, accept: string) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      url,
      {
        agent: false,
        lookup: pinnedLookup(address),
        family: address.family,
        signal,
        maxHeaderSize: 16384,
        headers: {
          Accept: accept,
          'Accept-Encoding': 'identity',
          'User-Agent': COPY.previewUserAgent,
        },
      },
      resolve,
    );
    req.on('error', reject);
    req.end();
  });
}

@Injectable()
export class PublicHttp {
  protected address(url: URL, signal: AbortSignal) {
    return abortable(
      resolvePublicAddress(url, hostname => lookup(hostname, { all: true, verbatim: true })),
      signal,
    );
  }

  protected connect(url: URL, address: PublicAddress, signal: AbortSignal, accept: string) {
    return connect(url, address, signal, accept);
  }

  async get(rawUrl: string, options: FetchOptions): Promise<RemoteResult> {
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(6000)])
      : AbortSignal.timeout(6000);
    let url = publicUrl(rawUrl);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const address = await this.address(url, signal);
      signal.throwIfAborted();
      // The socket uses only the validated address; HTTP Host and TLS hostname stay unchanged.
      const response = await this.connect(url, address, signal, options.accept);
      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
          if (!response.headers.location || redirects === 3) {
            throw new Error('Too many preview redirects');
          }
          url = publicUrl(new URL(response.headers.location, url).href);
          continue;
        }
        if (
          response.statusCode !== 200 ||
          (response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity') ||
          Number(response.headers['content-length'] || 0) > options.maxBytes
        ) {
          throw new Error('Preview response unavailable');
        }
        return {
          bytes: await collectLimited(response, options.maxBytes),
          contentType: response.headers['content-type'] || '',
          url: url.href,
        };
      } finally {
        response.destroy();
      }
    }
    throw new Error('Preview unavailable');
  }
}
