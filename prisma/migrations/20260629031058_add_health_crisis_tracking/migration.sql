-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'DISEASE_OUTBREAK';
ALTER TYPE "EventType" ADD VALUE 'HOSPITAL_COLLAPSE';
ALTER TYPE "EventType" ADD VALUE 'MEDICATION_SHORTAGE';
ALTER TYPE "EventType" ADD VALUE 'MALPRACTICE_SCANDAL';
ALTER TYPE "EventType" ADD VALUE 'MEDICAL_BREAKTHROUGH';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "consecutiveSaturationMonths" JSONB,
ADD COLUMN     "healthEfficiencyStreak" INTEGER NOT NULL DEFAULT 0;
