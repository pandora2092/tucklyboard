BEGIN;
-- CreateTable
CREATE TABLE "BookmarkStatus" (
    "spaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookmarkStatus_pkey" PRIMARY KEY ("spaceId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkStatus_spaceId_name_key" ON "BookmarkStatus"("spaceId", "name");

-- CreateIndex
CREATE INDEX "Item_spaceId_status_idx" ON "Item"("spaceId", "status");

-- AddForeignKey
ALTER TABLE "BookmarkStatus" ADD CONSTRAINT "BookmarkStatus_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- Keep every existing bookmark's saved/done value and seed the initial settings.
INSERT INTO "BookmarkStatus" ("spaceId", "key", "name", "color", "position", "isDefault", "isCompleted")
SELECT "id", 'saved', 'На потом', '#879b6e', 0, true, false FROM "Space";
INSERT INTO "BookmarkStatus" ("spaceId", "key", "name", "color", "position", "isDefault", "isCompleted")
SELECT "id", 'done', 'Просмотрено', '#587c75', 1, false, true FROM "Space";

ALTER TABLE "Item" ADD CONSTRAINT "Item_spaceId_status_fkey" FOREIGN KEY ("spaceId", "status") REFERENCES "BookmarkStatus"("spaceId", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
