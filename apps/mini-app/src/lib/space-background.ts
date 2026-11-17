import type { CSSProperties } from 'react';

import { SPACE_THEMES, type SpaceBackground, type SpaceTheme } from '@tuckly/contracts';

const SCALE = { small: 1, medium: 1.6, large: 2.4 } as const;
const MOTIFS = {
  dots: { size: 7, drawing: '<circle cx="3.5" cy="3.5" r="0.65" stroke="none"/>' },
  randomDots: {
    size: 64,
    drawing:
      '<g stroke="none"><circle cx="5" cy="9" r=".7"/><circle cx="22" cy="4" r=".5"/><circle cx="46" cy="13" r=".9"/><circle cx="60" cy="3" r=".6"/><circle cx="13" cy="28" r=".5"/><circle cx="34" cy="25" r=".8"/><circle cx="56" cy="33" r=".6"/><circle cx="4" cy="48" r=".9"/><circle cx="25" cy="44" r=".6"/><circle cx="43" cy="52" r=".5"/><circle cx="60" cy="59" r=".8"/><circle cx="16" cy="61" r=".5"/></g>',
  },
  crosses: { size: 24, drawing: '<path d="M9 12h6M12 9v6" fill="none"/>' },
  strokes: {
    size: 64,
    drawing:
      '<path d="m6 9 2-3m15 4 3 1m19-4 1 3m12 8-3 2M12 25l3 2m18-8 1 4M5 46l3-2m15-9 3 1m20-4-2 3m14 11 3 1M15 56l-1 3m22-9 3-2m9 12 3 1" fill="none"/>',
  },
  grid: { size: 24, drawing: '<path d="M24 0H0v24" stroke-dasharray="1.5 3" fill="none"/>' },
  diagonal: { size: 16, drawing: '<path d="m-4 4 8-8M0 16 16 0m-4 20 8-8" fill="none"/>' },
  corners: { size: 48, drawing: '<path d="M8 13V8h5m20 0h5v5M8 33v5h5m20 0h5v-5" fill="none"/>' },
} as const;

export function spaceBackgroundStyle(
  theme: SpaceTheme,
  background: SpaceBackground,
): CSSProperties {
  if (background.pattern === 'none') {
    return { '--space-pattern-image': 'none', '--space-pattern-size': 'auto' } as CSSProperties;
  }
  const motif = MOTIFS[background.pattern];
  const color = SPACE_THEMES[theme].border;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${motif.size}" height="${motif.size}" viewBox="0 0 ${motif.size} ${motif.size}"><g fill="${color}" stroke="${color}" stroke-width=".7" stroke-linecap="round" opacity="${background.contrast / 100}">${motif.drawing}</g></svg>`;
  const size = motif.size * SCALE[background.scale];
  return {
    '--space-pattern-image': `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    '--space-pattern-size': `${size}px ${size}px`,
  } as CSSProperties;
}
