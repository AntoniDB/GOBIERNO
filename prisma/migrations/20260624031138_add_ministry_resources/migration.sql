-- AlterTable
ALTER TABLE "Ministry" ADD COLUMN     "consumedResources" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "producedResources" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ResourceStock" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceStock_gameId_idx" ON "ResourceStock"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceStock_gameId_resourceType_key" ON "ResourceStock"("gameId", "resourceType");

-- AddForeignKey
ALTER TABLE "ResourceStock" ADD CONSTRAINT "ResourceStock_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
