-- CreateEnum
CREATE TYPE "TradeGoodCategory" AS ENUM ('MEDICAMENTS_GENERIC', 'MEDICAMENTS_BRAND');

-- CreateEnum
CREATE TYPE "TradeFlowDirection" AS ENUM ('IMPORT', 'EXPORT');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "sanctionsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "MonthSnapshot" ADD COLUMN     "totalExports" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalImports" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tradeBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TradeGood" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "TradeGoodCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseCostPerUnit" DOUBLE PRECISION NOT NULL,
    "unitDescription" TEXT NOT NULL,
    "demandPerCapita" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TradeGood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeFlow" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "tradeGoodId" TEXT NOT NULL,
    "direction" "TradeFlowDirection" NOT NULL,
    "monthlyVolume" DOUBLE PRECISION NOT NULL,
    "targetVolume" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "sanctionsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "monthlyCost" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TradeFlow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeGood_gameId_idx" ON "TradeGood"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeGood_gameId_key_key" ON "TradeGood"("gameId", "key");

-- CreateIndex
CREATE INDEX "TradeFlow_gameId_idx" ON "TradeFlow"("gameId");

-- CreateIndex
CREATE INDEX "TradeFlow_gameId_direction_idx" ON "TradeFlow"("gameId", "direction");

-- AddForeignKey
ALTER TABLE "TradeGood" ADD CONSTRAINT "TradeGood_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeFlow" ADD CONSTRAINT "TradeFlow_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeFlow" ADD CONSTRAINT "TradeFlow_tradeGoodId_fkey" FOREIGN KEY ("tradeGoodId") REFERENCES "TradeGood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
