-- CreateEnum
CREATE TYPE "LRDecisionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LRDecisionType" AS ENUM ('OBRA_DE_PRUEBA');

-- AlterTable
ALTER TABLE "MonthSnapshot" ADD COLUMN     "activeLrdCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lrdCancelledThisMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lrdCompletedThisMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lrdMonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LongRunningDecision" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "LRDecisionType" NOT NULL,
    "name" TEXT NOT NULL,
    "monthsRemaining" INTEGER NOT NULL,
    "totalMonths" INTEGER NOT NULL,
    "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "status" "LRDecisionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "progressLog" JSONB NOT NULL DEFAULT '[]',
    "effectOnCompletion" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "LongRunningDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LongRunningDecision_gameId_idx" ON "LongRunningDecision"("gameId");

-- CreateIndex
CREATE INDEX "LongRunningDecision_gameId_status_idx" ON "LongRunningDecision"("gameId", "status");

-- AddForeignKey
ALTER TABLE "LongRunningDecision" ADD CONSTRAINT "LongRunningDecision_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
