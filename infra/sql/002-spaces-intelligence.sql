-- DropIndex
DROP INDEX "Collection_userId_name_key";

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "rules" JSONB,
ADD COLUMN     "spaceId" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "author" TEXT,
ADD COLUMN     "autoTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "dismissedAutoTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "embeddingFingerprint" TEXT,
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "metadataStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "metadataUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "sourceDescription" TEXT,
ADD COLUMN     "sourceTitle" TEXT,
ADD COLUMN     "spaceId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'saved',
ADD COLUMN     "titleMode" TEXT NOT NULL DEFAULT 'custom';

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "personalUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceMember" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateTable
CREATE TABLE "SpaceInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "SpaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCollection" (
    "itemId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "ItemCollection_pkey" PRIMARY KEY ("itemId","collectionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Space_personalUserId_key" ON "Space"("personalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceInvite_tokenHash_key" ON "SpaceInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_spaceId_name_key" ON "Collection"("spaceId", "name");

-- CreateIndex
CREATE INDEX "Item_spaceId_createdAt_idx" ON "Item"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Item_metadataStatus_idx" ON "Item"("metadataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Item_spaceId_canonicalUrl_key" ON "Item"("spaceId", "canonicalUrl");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_personalUserId_fkey" FOREIGN KEY ("personalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvite" ADD CONSTRAINT "SpaceInvite_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCollection" ADD CONSTRAINT "ItemCollection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCollection" ADD CONSTRAINT "ItemCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
