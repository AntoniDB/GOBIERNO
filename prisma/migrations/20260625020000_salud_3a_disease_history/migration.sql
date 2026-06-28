-- AlterTable:更高 anadir columna de prevalencias por enfermedad al snapshot
ALTER TABLE "MonthSnapshot" ADD COLUMN IF NOT EXISTS "diseasePrevalences" JSONB;