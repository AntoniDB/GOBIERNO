-- AlterTable
ALTER TABLE "Ministry" ADD COLUMN     "healthBudgetSplit" JSONB NOT NULL DEFAULT '{ "primary": 50, "secondary": 30, "tertiary": 20 }';

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "accessModifier" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "healthCoverage" JSONB NOT NULL DEFAULT '{"primary":{"facilities":5,"beds":200,"operationalCost":500000},"secondary":{"facilities":2,"beds":100,"operationalCost":300000},"tertiary":{"facilities":1,"beds":50,"operationalCost":700000}}',
ADD COLUMN     "povertyModifier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'URBAN';
