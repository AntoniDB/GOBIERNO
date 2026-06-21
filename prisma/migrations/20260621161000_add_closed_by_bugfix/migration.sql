-- Agrega campo closedByBugfix para trazabilidad de cierres artificiales
ALTER TABLE "JudicialCase" ADD COLUMN IF NOT EXISTS "closedByBugfix" BOOLEAN NOT NULL DEFAULT false;

-- Marca retroactivamente los casos cerrados por la limpieza de duplicados
-- (aquellos cuyo description contiene el marcador de bugfix)
UPDATE "JudicialCase"
SET "closedByBugfix" = true
WHERE "description" LIKE '%LIMPIEZA DE BUG%';
