-- Additive upgrade for installations created before Telegram-backed media storage.
-- Existing mediaKey values and S3 objects are intentionally preserved.
BEGIN;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "telegramFileId" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "telegramFileUniqueId" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "telegramMediaKind" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "telegramThumbnailFileId" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "telegramFileSize" BIGINT;
COMMIT;
