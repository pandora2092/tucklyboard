import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SPACE_THEMES, SpaceThemeSchema, UpdateSpaceSchema } from './space-themes';

void test('space themes only accept the supported palette and cannot update other space fields', () => {
  for (const theme of Object.keys(SPACE_THEMES)) {
    assert.equal(UpdateSpaceSchema.parse({ theme }).theme, theme);
  }
  for (const theme of ['', '#ffffff', 'unknown', null]) {
    assert.equal(SpaceThemeSchema.safeParse(theme).success, false);
  }
  assert.equal(UpdateSpaceSchema.safeParse({}).success, false);
  assert.equal(UpdateSpaceSchema.safeParse({ theme: 'ocean', ownerId: 'other' }).success, false);
});

void test('theme accent colors keep white button labels readable', () => {
  for (const [name, { accent }] of Object.entries(SPACE_THEMES)) {
    const rgb = accent.match(/[a-f0-9]{2}/gi)!.map(channel => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    assert.ok(1.05 / (luminance + 0.05) >= 4.5, `${name} needs stronger text contrast`);
  }
});
