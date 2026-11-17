import { mkdir, writeFile } from 'node:fs/promises';

import { BRAND_ARTWORK as art } from '@tuckly/contracts';

const directory = new URL('../assets/branding/', import.meta.url);
const publicDirectory = new URL('../apps/mini-app/public/', import.meta.url);
await mkdir(directory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });
const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;
const flower = (color, center) =>
  `<path d="${art.flower}" fill="${color}"/><circle cx="32" cy="32" r="4" fill="${center}"/>`;
const letters = art.letters.map(d => `<path d="${d}"/>`).join('');
await writeFile(
  new URL('tuckly-logo.svg', directory),
  svg(
    art.logoViewBox,
    `<g fill="none" stroke="${art.ink}" stroke-width="${art.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${letters}</g><g transform="${art.logoMarkTransform}">${flower(art.accent, art.paper)}</g>`,
  ),
);
await writeFile(
  new URL('tuckly-mark.svg', directory),
  svg(art.markViewBox, flower(art.accent, art.paper)),
);
const avatar = svg(
  '0 0 1024 1024',
  `<rect width="1024" height="1024" fill="${art.accent}"/><circle cx="820" cy="200" r="320" fill="none" stroke="${art.paper}" stroke-opacity="${art.avatarOrbitOpacity}" stroke-width="${art.avatarOrbitStrokeWidth}"/><g transform="rotate(-8 512 512)"><rect x="248" y="222" width="544" height="600" rx="60" fill="#30392f" opacity=".14"/><rect x="240" y="200" width="544" height="600" rx="60" fill="${art.paper}"/><path d="M282 200V800" stroke="${art.accent}" stroke-opacity=".2" stroke-width="3"/><g transform="translate(324 318) scale(6)">${flower(art.accent, art.paper)}</g></g>`,
);
await writeFile(new URL('tuckly-bot-avatar.svg', directory), avatar);
await writeFile(
  new URL('favicon.svg', publicDirectory),
  svg(
    '0 0 64 64',
    `<rect width="64" height="64" rx="16" fill="${art.paper}"/>${flower(art.accent, art.paper)}`,
  ),
);
console.info('Exported logo, brand mark, Telegram avatar and favicon.');
