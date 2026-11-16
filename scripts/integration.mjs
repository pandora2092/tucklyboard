import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';

import { config } from 'dotenv';

config({ quiet: true });
const { EnrichmentService } = await import('../apps/api/dist/intelligence/enrichment.service.js');
const { Store } = await import('../apps/api/dist/database/database.service.js');
const { saveIncoming, createBot } = await import('../apps/api/dist/telegram/bot.js');
const {
  BRAND,
  ItemListSchema,
  CollectionsSchema,
  MeSchema,
  AdminOverviewSchema,
  AdminUsersSchema,
  AdminUserDetailSchema,
} = await import('@tuckly/contracts');
const token = 'integration-test';
const id = Date.now();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2foAAAAASUVORK5CYII=',
  'base64',
);
const calls = [];
let blocked = false;
const telegram = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    let payload = {};
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const form = await new Response(bytes, {
        headers: { 'Content-Type': req.headers['content-type'] },
      }).formData();
      for (const [key, value] of form) {
        payload[key] = typeof value === 'string' ? value : Buffer.from(await value.arrayBuffer());
      }
    } else if (bytes.length) {
      payload = JSON.parse(bytes.toString());
    }
    const method = req.url.split('/').at(-1);
    calls.push({ method, payload });
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/file/')) {
      res.setHeader('Content-Type', 'image/png');
      res.end(png);
      return;
    }
    if (blocked && ['sendDocument', 'sendPhoto', 'sendVideo'].includes(method)) {
      res.end(
        JSON.stringify({
          ok: false,
          error_code: 403,
          description: 'Forbidden',
        }),
      );
      return;
    }
    let result;
    if (method === 'getMe') {
      result = { id: 999, is_bot: true, first_name: 'Test bot', username: 'tuckly_test_bot' };
    } else if (method === 'getFile') {
      result = {
        file_id: payload.file_id,
        file_unique_id: 'thumbnail-unique',
        file_size: png.length,
        file_path: 'photos/preview.png',
      };
    } else if (method === 'sendMessage') {
      result = {
        message_id: calls.length,
        date: 1,
        chat: { id: Number(payload.chat_id), type: 'private' },
        text: payload.text,
      };
    } else if (['sendDocument', 'sendPhoto', 'sendVideo'].includes(method)) {
      result = {
        message_id: calls.length,
        date: 1,
        chat: { id: Number(payload.chat_id), type: 'private' },
        document: {
          file_id: 'uploaded-file',
          file_unique_id: 'uploaded-unique',
          file_size: png.length,
          mime_type: 'application/octet-stream',
          thumbnail: {
            file_id: 'thumbnail',
            file_unique_id: 'thumb-unique',
            width: 160,
            height: 160,
            file_size: png.length,
          },
        },
      };
    } else {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          ok: false,
          error_code: 500,
          description: 'Unexpected mock method',
        }),
      );
      return;
    }
    res.end(JSON.stringify({ ok: true, result }));
  } catch {
    res.statusCode = 500;
    res.end('{}');
  }
});
await new Promise(resolve => telegram.listen(0, '127.0.0.1', resolve));
const root = `http://127.0.0.1:${telegram.address().port}`;
process.env.TELEGRAM_API_ROOT = root;
function authorization(userId) {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: 'Integration' }),
  });
  const check = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return `tma ${p}`;
}
const server = spawn(process.execPath, ['dist/main.js'], {
  cwd: 'apps/api',
  env: {
    ...process.env,
    ENRICHMENT_ENABLED: 'false',
    BOT_TOKEN: token,
    BOT_USERNAME: '',
    BOT_POLLING: 'false',
    ADMIN_TELEGRAM_IDS: String(id),
    DEV_AUTH: 'false',
    PORT: '3002',
    HTTP_HOST: '127.0.0.1',
    TELEGRAM_API_ROOT: root,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', b => (logs += b));
server.stderr.on('data', b => (logs += b));
const db = new Store();
async function request(path, method = 'GET', body, userId = id) {
  return fetch(`http://127.0.0.1:3002/api/${path}`, {
    method,
    headers: {
      ...(!(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(userId ? { Authorization: authorization(userId) } : {}),
    },
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }),
  });
}
function uploadForm(collectionId, body = png, mime = 'image/png') {
  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({ title: 'Telegram upload', tags: ['photo'], collectionId }),
  );
  form.append('file', new Blob([body], { type: mime }), 'photo.png');
  return form;
}
const from = { id, is_bot: false, first_name: 'Integration' };
const message = {
  message_id: 100,
  date: 1,
  from,
  chat: { id, type: 'private' },
  caption: 'Photo in Telegram',
  photo: [
    {
      file_id: 'small-photo',
      file_unique_id: 'small-unique',
      width: 160,
      height: 160,
      file_size: png.length,
    },
    {
      file_id: 'large-photo',
      file_unique_id: 'large-unique',
      width: 1280,
      height: 1280,
      file_size: 100000,
    },
  ],
};
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) {
      break;
    }
    try {
      if ((await request('health')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait until the test API has started listening. */
    }
    await setTimeout(100);
  }
  assert.ok(ready, `API did not start: ${logs}`);
  assert.equal((await request('items', 'GET', undefined, null)).status, 401);
  // Every admin endpoint requires signed Telegram credentials AND an allowlisted ID.
  for (const path of ['admin/overview', 'admin/users', 'admin/users/missing']) {
    assert.equal((await request(path, 'GET', undefined, null)).status, 401);
    assert.equal((await request(path, 'GET', undefined, id + 1)).status, 403);
  }
  const tampered = await fetch('http://127.0.0.1:3002/api/admin/users', {
    headers: { Authorization: authorization(id).replace('Integration', 'Tampered') },
  });
  assert.equal(tampered.status, 401);
  const statsResponse = await request('admin/overview');
  assert.equal(statsResponse.status, 200);
  assert.equal(statsResponse.headers.get('cache-control'), 'private, no-store');
  AdminOverviewSchema.parse(await statsResponse.json());
  assert.equal((await request('admin/users?page=0')).status, 400);
  assert.equal((await request('admin/users?activeDays=2')).status, 400);
  assert.equal((await request('admin/users/missing')).status, 404);
  const collection = await (
    await request('collections', 'POST', { name: 'Integration collection' })
  ).json();
  assert.ok(collection.id);
  const response = await request('items', 'POST', {
    type: 'link',
    title: 'Integration link',
    text: 'Keep this note when PATCH omits text',
    url: 'https://example.com/integration',
    tags: ['test'],
    collectionId: collection.id,
  });
  assert.equal(response.status, 201);
  const item = await response.json();
  const duplicate = await (
    await request('items', 'POST', {
      type: 'link',
      title: 'Duplicate',
      url: 'https://example.com/integration',
    })
  ).json();
  assert.equal(duplicate.id, item.id);
  assert.equal((await (await request('items?tag=test')).json()).items.length, 1);
  assert.equal((await (await request('items', 'GET', undefined, id + 1)).json()).items.length, 0);
  assert.equal(
    (await request(`items/${item.id}`, 'PATCH', { title: 'Stolen' }, id + 1)).status,
    404,
  );
  assert.equal((await request(`items/${item.id}`, 'DELETE', undefined, id + 1)).status, 404);
  assert.equal(
    (
      await request(
        'items',
        'POST',
        { type: 'text', title: 'Other', collectionId: collection.id },
        id + 1,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`items/${item.id}`, 'PATCH', {
        title: 'Edited',
        tags: ['edited'],
      })
    ).status,
    200,
  );
  assert.equal((await request('uploads', 'POST', { mime: 'image/png', size: 10 })).status, 410);
  assert.equal(
    (
      await request('items', 'POST', {
        type: 'photo',
        title: 'Injected file',
        telegramFileId: 'someone-else',
      })
    ).status,
    400,
  );
  assert.equal((await request('items?type=unsupported')).status, 400);
  MeSchema.parse(await (await request('me')).json());
  CollectionsSchema.parse(await (await request('collections')).json());
  const edited = ItemListSchema.parse(await (await request('items')).json()).items.find(
    value => value.id === item.id,
  );
  assert.equal(edited.text, 'Keep this note when PATCH omits text');
  const savedLink = ItemListSchema.parse(await (await request('items')).json()).items.find(
    value => value.id === item.id,
  );
  assert.equal(savedLink.previewUrl, `/api/items/${item.id}/preview`);
  assert.equal((await request(`items/${item.id}/preview`, 'GET', undefined, id + 1)).status, 404);
  assert.equal((await request(`items/${item.id}/preview`, 'GET', undefined, null)).status, 401);
  const internal = await (
    await request('items', 'POST', {
      type: 'link',
      title: 'Internal URL must not be fetched',
      url: 'http://127.0.0.1:3002/api/health',
    })
  ).json();
  assert.equal((await request(`items/${internal.id}/preview`)).status, 404);
  // Multiple collections, canonical deduplication and atomic bulk operations.
  const second = await (await request('collections', 'POST', { name: 'Second collection' })).json();
  const canonical = await (
    await request('items', 'POST', {
      type: 'link',
      url: 'https://youtu.be/dQw4w9WgXcQ?si=one',
      text: 'Private note',
      collectionIds: [collection.id, second.id],
    })
  ).json();
  assert.equal(canonical.collections.length, 2);
  assert.equal(canonical.metadataStatus, 'pending');
  const youtubeDuplicate = await (
    await request('items', 'POST', {
      type: 'link',
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ&utm_source=two',
    })
  ).json();
  assert.equal(youtubeDuplicate.id, canonical.id);
  assert.equal(youtubeDuplicate.wasDuplicate, true);
  assert.equal(youtubeDuplicate.text, 'Private note');
  assert.equal(
    (await request(`items/${canonical.id}`, 'PATCH', { collectionIds: [second.id] })).status,
    200,
  );
  assert.equal(
    (
      await request('items/bulk', 'POST', {
        ids: [canonical.id],
        action: 'addTags',
        tags: ['guide'],
      })
    ).status,
    201,
  );
  const smart = await (
    await request('collections', 'POST', {
      name: 'Guides',
      rules: { type: 'link', tags: ['guide'], status: 'saved' },
    })
  ).json();
  assert.equal((await (await request(`items?collection=${smart.id}`)).json()).items.length, 1);
  assert.equal(
    (await request('items/bulk', 'POST', { ids: [canonical.id], action: 'markDone' })).status,
    201,
  );
  assert.equal((await (await request(`items?collection=${smart.id}`)).json()).items.length, 0);
  assert.equal(
    (
      await request('items/bulk', 'POST', {
        ids: [canonical.id],
        action: 'addCollections',
        collectionIds: [smart.id],
      })
    ).status,
    404,
  );
  assert.ok((await (await request('sources')).json()).some(s => s.source === 'youtube.com'));
  const recipe = await (
    await request('items', 'POST', { type: 'text', title: 'Pasta recipe', text: 'A dinner idea' })
  ).json();
  assert.ok(
    (
      await (
        await request(
          'items?q=' + encodeURIComponent('что приготовить на ужин') + '&searchMode=semantic',
        )
      ).json()
    ).items.some(i => i.id === recipe.id),
  );
  // Background metadata preserves custom titles and personal notes.
  const enrichment = new EnrichmentService(
    db,
    {
      get: async () => ({
        title: 'React tutorial',
        description: 'Learn TypeScript programming',
        author: 'Test author',
      }),
    },
    { configured: false },
  );
  await enrichment.enrich(canonical.id);
  let enriched = await db.item.findUniqueOrThrow({ where: { id: canonical.id } });
  assert.equal(enriched.title, 'React tutorial');
  assert.equal(enriched.text, 'Private note');
  assert.equal(enriched.sourceDescription, 'Learn TypeScript programming');
  assert.ok(enriched.autoTags.includes('программирование'));
  assert.equal(
    (
      await request(`items/${canonical.id}`, 'PATCH', {
        title: 'My custom title',
        dismissedAutoTags: ['программирование'],
      })
    ).status,
    200,
  );
  assert.equal((await request(`items/${canonical.id}/enrich`, 'POST')).status, 201);
  await enrichment.enrich(canonical.id);
  enriched = await db.item.findUniqueOrThrow({ where: { id: canonical.id } });
  assert.equal(enriched.title, 'My custom title');
  assert.ok(enriched.dismissedAutoTags.includes('программирование'));
  const failure = new EnrichmentService(
    db,
    {
      get: async () => {
        throw new Error('Unavailable');
      },
    },
    { configured: false },
  );
  await db.item.update({ where: { id: canonical.id }, data: { metadataStatus: 'pending' } });
  await failure.enrich(canonical.id);
  assert.equal(
    (await db.item.findUniqueOrThrow({ where: { id: canonical.id } })).metadataStatus,
    'unavailable',
  );
  // Repeated startup must not restore removed legacy collection memberships.
  await db.item.update({ where: { id: canonical.id }, data: { collectionId: second.id } });
  assert.equal(
    (
      await request('items/bulk', 'POST', {
        ids: [canonical.id],
        action: 'removeCollections',
        collectionIds: [second.id],
      })
    ).status,
    201,
  );
  const restarted = new Store();
  try {
    await restarted.ensurePersonalSpace(enriched.userId);
  } finally {
    await restarted.$disconnect();
  }
  assert.equal(await db.itemCollection.count({ where: { itemId: canonical.id } }), 0);
  const concurrent = await Promise.all(
    [1, 2, 3].map(() =>
      request('items', 'POST', {
        type: 'link',
        url: 'https://example.com/concurrent?utm_source=test',
      }).then(r => r.json()),
    ),
  );
  assert.equal(new Set(concurrent.map(i => i.id)).size, 1);
  // Shared spaces require membership; readers cannot mutate, editors can.
  const shared = await (await request('spaces', 'POST', { name: 'Shared integration' })).json();
  assert.equal(shared.theme, 'sage');
  assert.equal(
    (await request(`spaces/${shared.id}`, 'PATCH', { theme: 'ocean' }, null)).status,
    401,
  );
  assert.equal(
    (await request(`spaces/${shared.id}`, 'PATCH', { theme: 'ocean' }, id + 1)).status,
    404,
  );
  assert.equal((await request(`spaces/${shared.id}`, 'PATCH', { theme: 'unknown' })).status, 400);
  assert.equal(
    (await request(`spaces/${shared.id}`, 'PATCH', { theme: 'ocean', ownerId: 'other' })).status,
    400,
  );
  assert.equal((await request(`spaces/${shared.id}`, 'PATCH', { theme: 'ocean' })).status, 200);
  assert.equal((await db.space.findUniqueOrThrow({ where: { id: shared.id } })).theme, 'ocean');
  assert.equal(
    (await (await request('spaces')).json()).find(space => space.id === shared.id).theme,
    'ocean',
  );
  const invite = await (
    await request(`spaces/${shared.id}/invites`, 'POST', { role: 'viewer', days: 7 })
  ).json();
  assert.equal(invite.telegramUrl, `https://t.me/tuckly_test_bot?start=join_${invite.token}`);
  assert.equal((await request(`items?spaceId=${shared.id}`, 'GET', undefined, id + 1)).status, 404);
  assert.equal(
    (await request(`invites/${invite.token}/join`, 'POST', undefined, id + 1)).status,
    201,
  );
  assert.equal(
    (await request(`invites/${invite.token}/join`, 'POST', undefined, id + 1)).status,
    201,
  );
  assert.equal((await (await request(`spaces/${shared.id}/invites`)).json())[0].uses, 1);
  assert.equal(
    (await request(`spaces/${shared.id}`, 'PATCH', { theme: 'rose' }, id + 1)).status,
    403,
  );
  assert.equal(
    (await (await request('spaces', 'GET', undefined, id + 1)).json()).find(
      space => space.id === shared.id,
    ).theme,
    'ocean',
  );
  const copied = await (
    await request(`items/${canonical.id}/copy`, 'POST', { spaceId: shared.id })
  ).json();
  assert.equal(copied.text, '');
  assert.equal(copied.spaceId, shared.id);
  assert.equal(
    (await (await request(`items?spaceId=${shared.id}`, 'GET', undefined, id + 1)).json()).items[0]
      .canEdit,
    false,
  );
  assert.equal(
    (await request(`items/${copied.id}`, 'PATCH', { title: 'Forbidden' }, id + 1)).status,
    403,
  );
  assert.equal((await request(`items/${copied.id}`, 'DELETE', undefined, id + 1)).status, 403);
  assert.equal(
    (
      await request(
        'items/bulk',
        'POST',
        { spaceId: shared.id, ids: [copied.id], action: 'delete' },
        id + 1,
      )
    ).status,
    403,
  );
  const reader = await db.user.findUniqueOrThrow({ where: { telegramId: String(id + 1) } });
  assert.equal(
    (await request(`spaces/${shared.id}/members/${reader.id}`, 'PATCH', { role: 'editor' })).status,
    200,
  );
  assert.equal(
    (await request(`spaces/${shared.id}`, 'PATCH', { theme: 'rose' }, id + 1)).status,
    403,
  );
  assert.equal(
    (await request(`items/${copied.id}`, 'PATCH', { title: 'Shared edit' }, id + 1)).status,
    200,
  );
  assert.equal(
    (
      await request(
        'items',
        'POST',
        { type: 'text', title: 'Shared note', spaceId: shared.id },
        id + 1,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request('items/bulk', 'POST', {
        spaceId: shared.id,
        ids: [copied.id, canonical.id],
        action: 'delete',
      })
    ).status,
    404,
  );
  assert.ok(await db.item.findUnique({ where: { id: copied.id } }));
  const me = await (await request('me')).json();
  assert.equal(me.isAdmin, true);
  assert.equal((await (await request('me', 'GET', undefined, id + 1)).json()).isAdmin, false);
  const adminList = AdminUsersSchema.parse(await (await request(`admin/users?q=${id}`)).json());
  assert.equal(adminList.total, 1);
  assert.equal(adminList.users[0].id, me.id);
  assert.ok(adminList.users[0].createdAt);
  const detail = AdminUserDetailSchema.parse(await (await request(`admin/users/${me.id}`)).json());
  assert.ok(detail.user._count.items > 0);
  assert.ok(detail.itemTypes.some(row => row.type === 'link' && row.count > 0));
  assert.ok(detail.activity.some(row => row.apiRequests > 0));
  assert.ok(!JSON.stringify(detail).includes('Private note'));
  const activityBefore = await db.userActivity.findMany({ where: { userId: me.id } });
  await request('admin/overview');
  await request('admin/users');
  await request(`admin/users/${me.id}`);
  assert.deepEqual(await db.userActivity.findMany({ where: { userId: me.id } }), activityBefore);
  assert.equal((await request(`spaces/${shared.id}/members/${me.id}`, 'DELETE')).status, 400);
  assert.equal((await request(`spaces/${shared.id}/members/${reader.id}`, 'DELETE')).status, 200);
  assert.equal((await request(`items/${copied.id}/preview`, 'GET', undefined, id + 1)).status, 404);
  assert.equal(
    (await request(`spaces/${shared.id}/invites/${invite.id}/revoke`, 'POST')).status,
    201,
  );
  assert.equal((await (await request(`spaces/${shared.id}/invites`)).json())[0].revoked, true);
  assert.equal(
    (await request(`invites/${invite.token}/join`, 'POST', undefined, id + 1)).status,
    404,
  );
  assert.equal((await request(`spaces/${shared.id}/invites/${invite.id}`, 'DELETE')).status, 200);
  assert.equal((await (await request(`spaces/${shared.id}/invites`)).json()).length, 0);
  const toDelete = await (
    await request(`spaces/${shared.id}/invites`, 'POST', { role: 'viewer', days: 7 })
  ).json();
  await request(`invites/${toDelete.token}/join`, 'POST', undefined, id + 1);
  assert.equal(
    (await request(`spaces/${shared.id}/invites/${toDelete.id}`, 'DELETE', undefined, id + 1))
      .status,
    403,
  );
  const otherSpace = await (await request('spaces', 'POST', { name: 'Invite isolation' })).json();
  assert.equal(
    (await request(`spaces/${otherSpace.id}/invites/${toDelete.id}`, 'DELETE')).status,
    200,
  );
  assert.equal((await request(`invites/${toDelete.token}`)).status, 200);
  assert.equal((await request(`spaces/${shared.id}/invites/${toDelete.id}`, 'DELETE')).status, 200);
  assert.equal((await request(`invites/${toDelete.token}`)).status, 404);
  assert.equal(
    (await request(`invites/${toDelete.token}/join`, 'POST', undefined, id + 1)).status,
    404,
  );
  assert.equal((await (await request(`spaces/${shared.id}/invites`)).json()).length, 0);
  assert.equal((await request(`items?spaceId=${shared.id}`, 'GET', undefined, id + 1)).status, 200);
  const expired = await (
    await request(`spaces/${shared.id}/invites`, 'POST', { role: 'editor', days: 1 })
  ).json();
  await db.spaceInvite.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
  assert.equal(
    (await request(`invites/${expired.token}/join`, 'POST', undefined, id + 1)).status,
    404,
  );
  // Telegram ingestion stores identifiers, including large media, without calling getFile.
  const beforeIngest = calls.length;
  const photo = await saveIncoming(db, message, from);
  const repeat = await saveIncoming(db, message, from);
  assert.equal(repeat.id, photo.id);
  assert.equal(photo.telegramFileId, 'large-photo');
  assert.equal(photo.mediaKey, null);
  assert.equal(calls.length, beforeIngest);
  const large = await saveIncoming(
    db,
    {
      ...message,
      message_id: 101,
      photo: undefined,
      video: {
        file_id: 'large-video',
        file_unique_id: 'video-unique',
        width: 1920,
        height: 1080,
        duration: 60,
        file_size: 80 * 1024 * 1024,
        mime_type: 'video/mp4',
      },
    },
    from,
  );
  assert.equal(large.telegramFileSize, BigInt(80 * 1024 * 1024));
  assert.equal(calls.length, beforeIngest);
  assert.equal(
    await saveIncoming(db, { ...message, chat: { id: -1, type: 'group', title: 'Group' } }, from),
    null,
  );
  const bot = createBot(db, token);
  bot.botInfo = {
    id: 999,
    is_bot: true,
    first_name: BRAND.name,
    username: `${BRAND.name}_test_bot`,
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  };
  const beforeStart = await db.item.count({ where: { userId: me.id } });
  const originalAdmins = process.env.ADMIN_TELEGRAM_IDS;
  process.env.ADMIN_TELEGRAM_IDS = String(id);
  try {
    await bot.handleUpdate({
      update_id: 10,
      message: {
        ...message,
        message_id: 200,
        photo: undefined,
        caption: undefined,
        text: '/start',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });
    assert.equal(await db.item.count({ where: { userId: me.id } }), beforeStart);
    assert.ok(
      (await db.userActivity.findMany({ where: { userId: me.id } })).some(
        row => row.botMessages > 0,
      ),
    );
    process.env.MINI_APP_URL = `https://${BRAND.name}.example`;
    await bot.handleUpdate({
      update_id: 11,
      message: {
        ...message,
        message_id: 201,
        photo: undefined,
        caption: undefined,
        text: '/admin',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });
    assert.equal(
      calls.at(-1).payload.reply_markup.inline_keyboard[0][0].web_app.url,
      `https://${BRAND.name}.example/admin`,
    );
    await bot.handleUpdate({
      update_id: 12,
      message: {
        ...message,
        from: { ...from, id: id + 1 },
        chat: { id: id + 1, type: 'private' },
        message_id: 202,
        photo: undefined,
        caption: undefined,
        text: '/admin',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });
    assert.equal(calls.at(-1).payload.reply_markup, undefined);
    assert.match(calls.at(-1).payload.text, /только администраторам/);
  } finally {
    if (originalAdmins === undefined) {
      delete process.env.ADMIN_TELEGRAM_IDS;
    } else {
      process.env.ADMIN_TELEGRAM_IDS = originalAdmins;
    }
  }
  await bot.handleUpdate({
    update_id: 1,
    message: {
      ...message,
      message_id: 102,
      text: 'Bot text note',
      photo: undefined,
      caption: undefined,
    },
  });
  assert.equal(await db.item.count({ where: { telegramMessageId: `${id}:102` } }), 1);
  // Identifiers/token URLs must not leave the backend.
  const rawList = await (await request('items')).json();
  assert.equal(rawList.items.find(value => value.id === photo.id).telegramFileId, undefined);
  assert.ok(!JSON.stringify(rawList).includes(token));
  const list = ItemListSchema.parse(rawList);
  const publicPhoto = list.items.find(i => i.id === photo.id);
  assert.equal(publicPhoto.storage, 'telegram');
  assert.ok(publicPhoto.previewUrl);
  assert.equal(publicPhoto.canSendToChat, true);
  assert.equal(publicPhoto.telegramFileId, undefined);
  assert.equal(publicPhoto.telegramMessageId, undefined);
  assert.ok(!JSON.stringify(list).includes(token));
  const beforePrivate = calls.length;
  assert.equal((await request(`items/${photo.id}/send`, 'POST', undefined, id + 1)).status, 404);
  assert.equal((await request(`items/${photo.id}/preview`, 'GET', undefined, id + 1)).status, 404);
  assert.equal((await request(`items/${photo.id}/preview`, 'GET', undefined, null)).status, 401);
  assert.equal(calls.length, beforePrivate);
  const preview = await request(`items/${photo.id}/preview`);
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png);
  assert.equal(preview.headers.get('cache-control'), 'private, no-store');
  assert.equal((await request(`items/${large.id}/send`, 'POST', { chatId: id + 1 })).status, 201);
  const last = calls.at(-1);
  assert.equal(last.method, 'sendVideo');
  assert.equal(last.payload.video, 'large-video');
  assert.equal(String(last.payload.chat_id), String(id));
  // Browser upload is sent to Telegram and then indexed; no S3 and no disk files.
  const upload = await request('items/media', 'POST', uploadForm(collection.id));
  const uploaded = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(uploaded));
  assert.equal(uploaded.storage, 'telegram');
  const stored = await db.item.findUnique({ where: { id: uploaded.id } });
  assert.equal(stored.mediaKey, null);
  assert.equal(stored.telegramFileId, 'uploaded-file');
  const sent = calls.find(
    c =>
      c.method === 'sendDocument' && Object.values(c.payload).some(value => Buffer.isBuffer(value)),
  );
  assert.ok(sent);
  assert.ok(Object.values(sent.payload).some(v => Buffer.isBuffer(v) && v.equals(png)));
  assert.equal(String(sent.payload.chat_id), String(id));
  const beforeInvalid = calls.length;
  assert.equal(
    (
      await request(
        'items/media',
        'POST',
        uploadForm(collection.id, Buffer.from('<script>bad</script>')),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request('items/media', 'POST', uploadForm(collection.id), id + 1)).status,
    404,
  );
  assert.equal((await request('items/media', 'POST', uploadForm(collection.id), null)).status, 401);
  assert.equal(calls.length, beforeInvalid);
  const oversized = await request(
    'items/media',
    'POST',
    uploadForm(collection.id, Buffer.alloc(21 * 1024 * 1024)),
  );
  assert.equal(oversized.status, 413);
  blocked = true;
  const failed = await request(`items/${photo.id}/send`, 'POST');
  assert.equal(failed.status, 400);
  assert.ok(!(await failed.text()).includes(token));
  const count = await db.item.count({ where: { userId: photo.userId } });
  assert.equal((await request('items/media', 'POST', uploadForm(collection.id))).status, 400);
  assert.equal(await db.item.count({ where: { userId: photo.userId } }), count);
  blocked = false;
  // Deleting the catalogue entry does not delete the original Telegram message/file.
  const beforeDelete = calls.length;
  assert.equal((await request(`items/${uploaded.id}`, 'DELETE')).status, 200);
  assert.equal(calls.length, beforeDelete);
  assert.equal((await request(`items/${uploaded.id}/send`, 'POST')).status, 404);
  const legacy = await db.item.create({
    data: {
      userId: photo.userId,
      type: 'photo',
      title: 'Legacy',
      mediaKey: 'old/file',
    },
  });
  assert.equal((await request(`items/${legacy.id}/send`, 'POST')).status, 400);
  assert.equal((await request(`items/${legacy.id}`, 'DELETE')).status, 200);
  // Custom statuses are scoped to spaces; only owners can manage definitions.
  const personal = (await (await request('spaces')).json()).find(space => space.personal);
  const statusPath = `spaces/${personal.id}/statuses`;
  const initialStatuses = await (await request(statusPath)).json();
  assert.deepEqual(
    initialStatuses.map(row => row.key),
    ['saved', 'done'],
  );
  assert.equal(initialStatuses.filter(row => row.isDefault).length, 1);
  assert.equal((await request(statusPath, 'GET', undefined, id + 1)).status, 404);
  assert.equal((await request(statusPath, 'POST', { name: 'Bad', color: 'red' })).status, 400);
  const readingResponse = await request(statusPath, 'POST', {
    name: 'Читаю',
    color: '#aabbcc',
  });
  assert.equal(readingResponse.status, 201);
  const reading = await readingResponse.json();
  assert.equal(
    (await request(statusPath, 'POST', { name: 'читаю', color: '#aabbcc' })).status,
    409,
  );
  assert.equal(
    (await request(`${statusPath}/${reading.key}`, 'PATCH', { isDefault: true })).status,
    200,
  );
  assert.equal(
    (await request(`${statusPath}/${reading.key}`, 'PATCH', { isDefault: false })).status,
    400,
  );
  const statusNote = await (
    await request('items', 'POST', { type: 'text', title: 'Custom default' })
  ).json();
  assert.equal(statusNote.status, reading.key);
  assert.equal(statusNote.statusInfo.name, 'Читаю');
  assert.equal(
    (await request(`items/${statusNote.id}`, 'PATCH', { status: 'missing' })).status,
    400,
  );
  assert.equal(
    (await request('items', 'POST', { type: 'text', title: 'Bad status', status: 'missing' }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('collections', 'POST', {
        name: 'Bad status rule',
        rules: { status: 'missing' },
      })
    ).status,
    400,
  );
  const readingCollection = await (
    await request('collections', 'POST', { name: 'Reading rule', rules: { status: reading.key } })
  ).json();
  assert.equal(
    (await (await request(`items?collection=${readingCollection.id}`)).json()).items.length,
    1,
  );
  assert.equal(
    (
      await request(`${statusPath}/${reading.key}`, 'PATCH', {
        name: 'Изучаю',
        color: '#123456',
      })
    ).status,
    200,
  );
  const renamedItems = await (await request(`items?status=${reading.key}`)).json();
  assert.ok(
    renamedItems.items.some(row => row.id === statusNote.id && row.statusInfo.name === 'Изучаю'),
  );
  assert.ok(
    (await (await request(`items?collection=${readingCollection.id}`)).json()).items.some(
      row => row.id === statusNote.id,
    ),
  );
  assert.equal(
    (await request(`${statusPath}/order`, 'PATCH', { keys: [reading.key, 'saved', 'saved'] }))
      .status,
    400,
  );
  assert.equal(
    (await request(`${statusPath}/order`, 'PATCH', { keys: [reading.key, 'done', 'saved'] }))
      .status,
    200,
  );
  assert.equal((await (await request(statusPath)).json())[0].key, reading.key);
  assert.equal(
    (await request('items/bulk', 'POST', { ids: [statusNote.id], action: 'setStatus' })).status,
    400,
  );
  assert.equal(
    (
      await request('items/bulk', 'POST', {
        ids: [statusNote.id],
        action: 'setStatus',
        status: 'done',
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(`items/${statusNote.id}`, 'PATCH', { status: reading.key })).status,
    200,
  );
  const statusShared = await (await request('spaces', 'POST', { name: 'Status sharing' })).json();
  const sharedStatusPath = `spaces/${statusShared.id}/statuses`;
  const sharedReading = await (
    await request(sharedStatusPath, 'POST', {
      name: 'В работе',
      color: '#445566',
    })
  ).json();
  assert.equal(
    (await request(`${sharedStatusPath}/${sharedReading.key}`, 'PATCH', { isDefault: true }))
      .status,
    200,
  );
  const statusInvite = await (
    await request(`spaces/${statusShared.id}/invites`, 'POST', { role: 'editor', days: 1 })
  ).json();
  assert.equal(
    (await request(`invites/${statusInvite.token}/join`, 'POST', undefined, id + 1)).status,
    201,
  );
  assert.equal((await request(sharedStatusPath, 'GET', undefined, id + 1)).status, 200);
  for (const [path, method, body] of [
    [sharedStatusPath, 'POST', { name: 'No permission', color: '#445566' }],
    [`${sharedStatusPath}/${sharedReading.key}`, 'PATCH', { name: 'No permission' }],
    [`${sharedStatusPath}/order`, 'PATCH', { keys: ['done', 'saved', sharedReading.key] }],
    [`${sharedStatusPath}/${sharedReading.key}`, 'DELETE', { replacementKey: 'saved' }],
  ]) {
    assert.equal((await request(path, method, body, id + 1)).status, 403);
  }
  const statusCopy = await (
    await request(`items/${statusNote.id}/copy`, 'POST', { spaceId: statusShared.id })
  ).json();
  assert.equal(statusCopy.status, sharedReading.key);
  assert.equal(
    (await request(`items/${statusCopy.id}`, 'PATCH', { status: 'done' }, id + 1)).status,
    200,
  );
  assert.equal(
    (await request(`items/${statusCopy.id}`, 'PATCH', { status: reading.key }, id + 1)).status,
    400,
  );
  assert.equal((await request(`${statusPath}/${reading.key}`, 'DELETE')).status, 400);
  assert.equal(
    (await request(`${statusPath}/${reading.key}`, 'DELETE', { replacementKey: sharedReading.key }))
      .status,
    404,
  );
  const concurrentReplacement = await Promise.all([
    request(`${statusPath}/${reading.key}`, 'DELETE', { replacementKey: 'done' }),
    request(`items/${statusNote.id}`, 'PATCH', { status: reading.key }),
  ]);
  assert.equal(concurrentReplacement[0].status, 200);
  assert.ok([200, 400].includes(concurrentReplacement[1].status));
  const migratedStatusNote = (await (await request('items?status=done')).json()).items.find(
    row => row.id === statusNote.id,
  );
  assert.ok(migratedStatusNote);
  const migratedRule = (await (await request('collections')).json()).find(
    row => row.id === readingCollection.id,
  );
  assert.equal(migratedRule.rules.status, 'done');
  assert.ok((await (await request(statusPath)).json()).find(row => row.key === 'done').isDefault);
  assert.equal(
    (await request(`${statusPath}/saved`, 'DELETE', { replacementKey: 'done' })).status,
    200,
  );
  const reopened = new Store();
  try {
    await reopened.ensurePersonalSpace(me.id);
  } finally {
    await reopened.$disconnect();
  }
  assert.deepEqual(
    (await (await request(statusPath)).json()).map(row => row.key),
    ['done'],
  );
  assert.equal((await request(`${statusPath}/done`, 'DELETE')).status, 400);
  const botDefault = await saveIncoming(db, { ...message, message_id: 104 }, from);
  assert.equal(botDefault.status, 'done');
  const uploadedWithDefault = await (await request('items/media', 'POST', uploadForm())).json();
  assert.equal(uploadedWithDefault.status, 'done');
  assert.equal(
    (await request('items', 'POST', { type: 'text', title: 'Explicit status', status: 'done' }))
      .status,
    201,
  );
  console.info(
    'Integration passed: CRUD, canonical dedup/concurrency, multiple and smart collections, bulk actions, metadata preservation, topic search, shared spaces, custom status permissions/defaults/reorder/atomic replacement, roles/invites/revocation, Telegram ingestion, private previews, upload/resend and migration restart (external APIs mocked).',
  );
} catch (error) {
  await setTimeout(50);
  console.error(logs);
  throw error;
} finally {
  server.kill('SIGTERM');
  const users = await db.user.findMany({
    where: { telegramId: { in: [String(id), String(id + 1)] } },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  await db.item.deleteMany({ where: { userId: { in: userIds } } });
  await db.collection.deleteMany({ where: { userId: { in: userIds } } });
  await db.space.deleteMany({ where: { ownerId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
  await new Promise(resolve => telegram.close(resolve));
}
