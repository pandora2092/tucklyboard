import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { Store } from '../database/database.service';

import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

void test('DEV_AUTH cannot bypass Telegram authentication for admin routes', async () => {
  const previous = process.env.DEV_AUTH;
  const previousNode = process.env.NODE_ENV;
  process.env.DEV_AUTH = 'true';
  process.env.NODE_ENV = 'development';
  let writes = 0;
  const auth = new AuthService({
    userUpsert: () => {
      writes++;
      throw new Error('Unexpected write');
    },
  } as unknown as Store);
  const headers: Record<string, string> = {};
  const req = { headers: {} } as Request;
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;
  try {
    await assert.rejects(new AdminGuard(auth).canActivate(context), UnauthorizedException);
    assert.equal(writes, 0);
    assert.equal(headers['Cache-Control'], 'private, no-store');
  } finally {
    if (previous === undefined) {
      delete process.env.DEV_AUTH;
    } else {
      process.env.DEV_AUTH = previous;
    }
    if (previousNode === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNode;
    }
  }
});
