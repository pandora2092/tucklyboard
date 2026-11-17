import { z } from 'zod';

export const SpaceThemeSchema = z.enum(['sage', 'ocean', 'lavender', 'sand', 'rose']);
export type SpaceTheme = z.infer<typeof SpaceThemeSchema>;

export const SPACE_THEMES = {
  sage: { accent: '#536c42', soft: '#e7eddf', background: '#f7f8f3', border: '#becdab' },
  ocean: { accent: '#326c7a', soft: '#e0eef0', background: '#f3f8f9', border: '#adcdd3' },
  lavender: { accent: '#6c5485', soft: '#ece5f3', background: '#f8f5fb', border: '#cdbbdf' },
  sand: { accent: '#80612f', soft: '#f1e8d8', background: '#fbf8f2', border: '#d9c39d' },
  rose: { accent: '#8a5265', soft: '#f3e3e9', background: '#fcf5f7', border: '#dfb8c7' },
} as const satisfies Record<
  SpaceTheme,
  { accent: string; soft: string; background: string; border: string }
>;

export const UpdateSpaceSchema = z
  .object({
    theme: SpaceThemeSchema.optional(),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine(
    value => value.theme !== undefined || value.name !== undefined,
    'Укажите изменения пространства',
  );
export type UpdateSpace = z.infer<typeof UpdateSpaceSchema>;
