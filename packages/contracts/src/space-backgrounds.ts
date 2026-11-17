import { z } from 'zod';

export const SPACE_BACKGROUND_PATTERNS = {
  none: 'Без рисунка',
  dots: 'Точки',
  randomDots: 'Нерегулярные точки',
  crosses: 'Крестики',
  strokes: 'Штрихи',
  grid: 'Пунктирная клетка',
  diagonal: 'Диагонали',
  corners: 'Уголки',
} as const;

export const SpaceBackgroundPatternSchema = z.enum([
  'none',
  'dots',
  'randomDots',
  'crosses',
  'strokes',
  'grid',
  'diagonal',
  'corners',
]);
export const SpaceBackgroundSchema = z
  .object({
    pattern: SpaceBackgroundPatternSchema,
    contrast: z.number().int().min(10).max(80),
    scale: z.enum(['small', 'medium', 'large']),
  })
  .strict();
export type SpaceBackground = z.infer<typeof SpaceBackgroundSchema>;
export const DEFAULT_SPACE_BACKGROUND: SpaceBackground = {
  pattern: 'dots',
  contrast: 42,
  scale: 'small',
};
