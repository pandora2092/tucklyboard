import { useLayoutEffect, type CSSProperties } from 'react';

import {
  DEFAULT_SPACE_BACKGROUND,
  SPACE_THEMES,
  type SpaceBackground,
  type SpaceTheme,
} from '@tuckly/contracts';

import { spaceBackgroundStyle } from './space-background';

export function spaceThemeStyle(theme: SpaceTheme): CSSProperties {
  const colors = SPACE_THEMES[theme];
  return {
    '--space-accent': colors.accent,
    '--space-soft': colors.soft,
    '--space-background': colors.background,
    '--space-border': colors.border,
  } as CSSProperties;
}

export function useSpaceTheme(
  theme: SpaceTheme,
  background: SpaceBackground = DEFAULT_SPACE_BACKGROUND,
) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = { ...spaceThemeStyle(theme), ...spaceBackgroundStyle(theme, background) };
    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(key, String(value));
    }
    return () => {
      for (const key of Object.keys(variables)) {
        root.style.removeProperty(key);
      }
    };
  }, [theme, background]);
}
