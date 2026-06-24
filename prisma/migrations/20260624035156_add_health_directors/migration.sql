-- AlterEnum
ALTER TYPE "OfficialRole" ADD VALUE 'MINISTRY_DIRECTOR';

-- AlterTable
ALTER TABLE "Official" ADD COLUMN     "specialty" TEXT;
