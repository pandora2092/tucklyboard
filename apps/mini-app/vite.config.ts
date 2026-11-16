import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'vite';

import { COPY } from '@tuckly/contracts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), 'DEV_TUNNEL_HOST');
  const tunnelHost = env.DEV_TUNNEL_HOST?.trim();
  return {
    plugins: [
      {
        name: 'product-title',
        transformIndexHtml: html => html.replace('__APP_TITLE__', COPY.pageTitle),
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
