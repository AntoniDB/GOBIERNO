-- AlterTable: columnas de programas en MonthSnapshot
ALTER TABLE "MonthSnapshot" ADD COLUMN IF NOT EXISTS "activeProgramsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "programMonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterEnum: anadir nuevos valores a LRDecisionType
ALTER TYPE "LRDecisionType" ADD VALUE IF NOT EXISTS 'HOSPITAL_CONSTRUCTION';
ALTER TYPE "LRDecisionType" ADD VALUE IF NOT EXISTS 'MEDICAL_RESEARCH';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProgramType" AS ENUM ('VACCINATION_CAMPAIGN', 'PREVENTION_EDUCATION', 'MENTAL_HEALTH_PROGRAM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "MinistryProgram" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "ProgramType" NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "MinistryProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryProgram_gameId_idx" ON "MinistryProgram"("gameId");

-- CreateIndex
CREATE INDEX "MinistryProgram_gameId_status_idx" ON "MinistryProgram"("gameId", "status");

-- CreateIndex
CREATE INDEX "MinistryProgram_type_idx" ON "MinistryProgram"("type");

-- AddForeignKey
ALTER TABLE "MinistryProgram" ADD CONSTRAINT "MinistryProgram_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;