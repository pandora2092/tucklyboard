// Vite's HTML transform reads the shared source directly: unlike client imports,
// its long-lived Node process must not cache a previous contracts build.
import { BRAND, COPY } from '../../../../packages/contracts/src/brand';
import { BRAND_ARTWORK as art } from '../../../../packages/contracts/src/brand-artwork';

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// The animated brand is available before React, without external assets.
// Its decorative loop never delays opening the ready catalogue.
export function bootMarkup() {
  const base = art.letters.map(path => `<path d="${path}"/>`).join('');
  const lettering = art.letters
    .map((path, index) => `<path d="${path}" pathLength="1" style="--logo-stroke-index:${index}"/>`)
    .join('');
  return `<div id="app-boot" class="app-intro app-boot"><div class="app-intro-content"><div class="app-intro-logo" role="img" aria-label="${escapeHtml(BRAND.name)}"><svg class="brand-logo" viewBox="${art.logoViewBox}" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="${art.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.16">${base}</g><g class="brand-logo-lettering" stroke="currentColor" stroke-width="${art.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${lettering}</g><g class="brand-logo-flower" transform="${art.logoMarkTransform}"><path d="${art.flower}" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="var(--space-soft)"/></g></svg></div><p class="app-intro-loading" role="status">${escapeHtml(COPY.loadingApp)}</p><div class="app-intro-dots" aria-hidden="true"><span></span><span></span><span></span></div></div></div>`;
}
