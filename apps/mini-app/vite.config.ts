import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';

import { COPY } from '@tuckly/contracts';

import { bootMarkup } from './src/lib/boot-markup';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), 'DEV_TUNNEL_HOST');
  const tunnelHost = env.DEV_TUNNEL_HOST?.trim();
  return {
    plugins: [
      {
        name: 'product-shell',
        transformIndexHtml: {
          order: 'pre',
          handler: html =>
            html
              .replace('__APP_TITLE__', COPY.pageTitle)
              .replace('__BOOT_MARKUP__', bootMarkup())
              .replace(
                '/* __BOOT_STYLES__ */',
                readFileSync(new URL('./src/styles/tokens.css', import.meta.url), 'utf8') +
                  readFileSync(new URL('./src/components/app-intro.css', import.meta.url), 'utf8'),
              ),
        },
      },
    ],
    server: {
      watch: {
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
      },
      allowedHosts: tunnelHost ? [tunnelHost] : [],
      proxy: { '/api': 'http://localhost:3000' },
    },
  };
});
