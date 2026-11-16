import { useLayoutEffect, type CSSProperties } from 'react';

import { SPACE_THEMES, type SpaceTheme } from '@tuckly/contracts';

export function spaceThemeStyle(theme: SpaceTheme): CSSProperties {
  const colors = SPACE_THEMES[theme];
  return {
    '--space-accent': colors.accent,
    '--space-soft': colors.soft,
    '--space-background': colors.background,
    '--space-border': colors.border,
  } as CSSProperties;
}

export function useSpaceTheme(theme: SpaceTheme) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = spaceThemeStyle(theme);
    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(key, value);
    }
    return () => {
      for (const key of Object.keys(variables)) {
        root.style.removeProperty(key);
      }
    };
  }, [theme]);
}
