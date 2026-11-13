-- Additive upgrade. Unknown historical registration dates stay NULL.
BEGIN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User"("lastSeenAt");
CREATE TABLE IF NOT EXISTS "UserActivity" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "day" DATE NOT NULL,
  "apiRequests" INTEGER NOT NULL DEFAULT 0,
  "botMessages" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("userId", "day")
);
CREATE INDEX IF NOT EXISTS "UserActivity_day_idx" ON "UserActivity"("day");
COMMIT;
