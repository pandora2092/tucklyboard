import { defineConfig } from 'vite';

import { COPY } from '@tuckly/contracts';

export default defineConfig({
  plugins: [
    {
      name: 'product-title',
      transformIndexHtml: html => html.replace('__APP_TITLE__', COPY.pageTitle),
    },
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
