-- Run before deploying the API version that reads Space.background.
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "background" JSONB NOT NULL
  DEFAULT '{"pattern":"dots","contrast":42,"scale":"small"}'::jsonb;
