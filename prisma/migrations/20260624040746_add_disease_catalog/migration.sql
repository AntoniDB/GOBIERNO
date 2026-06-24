-- AlterTable
ALTER TABLE "Disease" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'TRANSMISSIBLE',
ADD COLUMN     "classAffinity" JSONB NOT NULL DEFAULT '{ "EXTREME_POVERTY": 1.5, "POVERTY": 1.2, "MIDDLE": 0.8, "ELITE": 0.5 }',
ADD COLUMN     "monthlyCostPerPatient" DOUBLE PRECISION NOT NULL DEFAULT 500,
ADD COLUMN     "prevalenceBase" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "preventionSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- CreateTable
CREATE TABLE "DiseasePrevalence" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "currentPrevalence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseasePrevalence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiseasePrevalence_gameId_idx" ON "DiseasePrevalence"("gameId");

-- CreateIndex
CREATE INDEX "DiseasePrevalence_diseaseId_idx" ON "DiseasePrevalence"("diseaseId");

-- CreateIndex
CREATE UNIQUE INDEX "DiseasePrevalence_gameId_diseaseId_key" ON "DiseasePrevalence"("gameId", "diseaseId");

-- CreateIndex
CREATE INDEX "Disease_category_idx" ON "Disease"("category");

-- AddForeignKey
ALTER TABLE "DiseasePrevalence" ADD CONSTRAINT "DiseasePrevalence_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseasePrevalence" ADD CONSTRAINT "DiseasePrevalence_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
