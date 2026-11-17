import { readFile } from 'node:fs/promises';

import { parse } from 'dotenv';

import { BRAND, COPY } from '@tuckly/contracts';

const args = process.argv.slice(2);
const envFile = args.find(arg => arg.startsWith('--env='))?.slice(6) || '.env';
const apply = args.includes('--apply');
const env = parse(await readFile(envFile));
const token = env.BOT_TOKEN;
const expectedUsername = (
  args.find(arg => arg.startsWith('--bot='))?.slice(6) || env.BOT_USERNAME
)?.replace(/^@/, '');
const appUrl = env.MINI_APP_URL || (env.SITE_DOMAIN ? `https://${env.SITE_DOMAIN}` : undefined);
if (!token || !expectedUsername || !appUrl || new URL(appUrl).protocol !== 'https:') {
  throw new Error(
    'Set BOT_TOKEN, BOT_USERNAME and an HTTPS MINI_APP_URL in the selected env file.',
  );
}
// Keep tokens and raw Telegram errors out of logs.
async function call(method, body) {
  const multipart = body instanceof FormData;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: multipart ? undefined : { 'Content-Type': 'application/json' },
      body: multipart ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error('API rejected the request');
    }
    return result.result;
  } catch {
    throw new Error(`Telegram ${method} failed. Check access and bot configuration.`);
  }
}
const bot = await call('getMe', {});
if (bot.username?.toLowerCase() !== expectedUsername.toLowerCase()) {
  throw new Error('BOT_USERNAME does not match the token. No profile changes were made.');
}
const name = /\bdev\b/i.test(bot.first_name)
  ? `${BRAND.name} DEV · ${BRAND.descriptor}`
  : COPY.bot.name;
console.info(
  `Bot: @${bot.username}\nName: ${name}\nAbout: ${COPY.bot.shortDescription}\nDescription:\n${COPY.bot.description}\nMenu: ${COPY.bot.menuButton}\nApp: ${appUrl}`,
);
if (!apply) {
  console.info('Preview only. Add --apply to update this bot profile.');
} else {
  const avatar = await readFile(
    new URL('../assets/branding/tuckly-bot-avatar.png', import.meta.url),
  );
  for (const language_code of ['', 'ru']) {
    await call('setMyName', { name, language_code });
    await call('setMyShortDescription', {
      short_description: COPY.bot.shortDescription,
      language_code,
    });
    await call('setMyDescription', { description: COPY.bot.description, language_code });
    await call('setMyCommands', {
      commands: [{ command: 'start', description: COPY.bot.startCommand }],
      scope: { type: 'all_private_chats' },
      language_code,
    });
  }
  await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: COPY.bot.menuButton, web_app: { url: appUrl } },
  });
  const form = new FormData();
  form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }));
  form.set('avatar', new Blob([avatar], { type: 'image/png' }), 'tuckly-bot-avatar.png');
  await call('setMyProfilePhoto', form);
  console.info(`Updated profile, avatar, commands and menu for @${bot.username}.`);
}
