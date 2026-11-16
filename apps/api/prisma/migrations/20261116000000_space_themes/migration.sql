ALTER TABLE "Space" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'sage';

ALTER TABLE "Space" ADD CONSTRAINT "Space_theme_check"
  CHECK ("theme" IN ('sage', 'ocean', 'lavender', 'sand', 'rose'));
