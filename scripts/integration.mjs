import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ quiet: true });
const token = "integration-test";
const id = Date.now();
function authorization(userId) {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "Integration" }),
  });
  const check = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  p.set("hash", createHmac("sha256", key).update(check).digest("hex"));
  return `tma ${p}`;
}
const server = spawn(process.execPath, ["dist/main.js"], {
  cwd: "apps/api",
  env: {
    ...process.env,
    BOT_TOKEN: token,
    BOT_POLLING: "false",
    DEV_AUTH: "false",
    PORT: "3002",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
const db = new PrismaClient();
async function request(path, method = "GET", body, userId = id) {
  return fetch(`http://127.0.0.1:3002/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { Authorization: authorization(userId) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try {
      const r = await request("health");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await setTimeout(100);
  }
  assert.ok(ready, `API did not start: ${logs}`);
  assert.equal((await request("items", "GET", undefined, null)).status, 401);
  const collection = await (
    await request("collections", "POST", { name: "Integration collection" })
  ).json();
  assert.ok(collection.id);
  const response = await request("items", "POST", {
    type: "link",
    title: "Integration link",
    url: "https://example.com/integration",
    tags: ["test"],
    collectionId: collection.id,
  });
  assert.equal(response.status, 201);
  const item = await response.json();
  const duplicate = await (
    await request("items", "POST", {
      type: "link",
      title: "Duplicate",
      url: "https://example.com/integration",
    })
  ).json();
  assert.equal(duplicate.id, item.id);
  const own = await (await request("items?tag=test")).json();
  assert.equal(own.items.length, 1);
  const other = await (await request("items", "GET", undefined, id + 1)).json();
  assert.equal(other.items.length, 0);
  assert.equal(
    (await request(`items/${item.id}`, "PATCH", { title: "Stolen" }, id + 1))
      .status,
    404,
  );
  assert.equal(
    (await request(`items/${item.id}`, "DELETE", undefined, id + 1)).status,
    404,
  );
  assert.equal(
    (
      await request(
        "items",
        "POST",
        { type: "text", title: "Other", collectionId: collection.id },
        id + 1,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`items/${item.id}`, "PATCH", {
        title: "Edited",
        tags: ["edited"],
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("uploads", "POST", { mime: "text/html", size: 10 })).status,
    400,
  );
  assert.equal(
    (
      await request("uploads", "POST", {
        mime: "image/png",
        size: 21 * 1024 * 1024,
      })
    ).status,
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2foAAAAASUVORK5CYII=",
    "base64",
  );
  const uploadResponse = await request("uploads", "POST", {
    mime: "image/png",
    size: png.length,
  });
  const upload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201, JSON.stringify(upload));
  const put = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  assert.equal(put.status, 200, await put.text());
  const photoResponse = await request("items", "POST", {
    type: "photo",
    title: "Integration photo",
    mediaKey: upload.key,
    mime: "image/png",
  });
  assert.equal(photoResponse.status, 201);
  const photo = await photoResponse.json();
  const download = await fetch(photo.mediaUrl);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  assert.equal(
    (
      await request(
        "items",
        "POST",
        { type: "photo", title: "Foreign photo", mediaKey: upload.key },
        id + 1,
      )
    ).status,
    400,
  );
  assert.equal((await request(`items/${photo.id}`, "DELETE")).status, 200);
  assert.equal((await fetch(photo.mediaUrl)).status, 404);
  assert.equal((await request(`items/${item.id}`, "DELETE")).status, 200);
  console.log(
    "Integration passed: authorization, CRUD, filtering, deduplication, isolation, S3 upload/download/deletion and upload validation",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill("SIGTERM");
  const users = await db.user.findMany({
    where: { telegramId: { in: [String(id), String(id + 1)] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  await db.item.deleteMany({ where: { userId: { in: userIds } } });
  await db.collection.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
}
