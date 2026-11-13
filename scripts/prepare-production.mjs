import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parse } from 'dotenv';

import { BRAND } from '@tuckly/contracts';

const root = new URL('../', import.meta.url);
const source = parse(await readFile(new URL('.env', root)));
const defaults = parse(await readFile(new URL('.env.production.example', root)));
if (!source.BOT_TOKEN) {
  throw new Error('Add BOT_TOKEN to the local .env first');
}
const values = {
  ...defaults,
  POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
  SITE_DOMAIN: BRAND.domain,
  BOT_TOKEN: source.BOT_TOKEN,
  BOT_USERNAME: source.BOT_USERNAME || defaults.BOT_USERNAME,
  ADMIN_TELEGRAM_IDS: source.ADMIN_TELEGRAM_IDS || defaults.ADMIN_TELEGRAM_IDS,
};
// Exclusive creation protects the database password on repeated runs.
try {
  await writeFile(
    new URL('.env.production', root),
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n') + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  console.info(
    `Created ${fileURLToPath(new URL('.env.production', root))}. Secrets were not printed.`,
  );
} catch (error) {
  if (error.code !== 'EEXIST') {
    throw error;
  }
  console.info('.env.production already exists; preserved the existing secrets.');
}
