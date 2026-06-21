-- Agrega POLITICAL_LEADER al enum de roles
ALTER TYPE "OfficialRole" ADD VALUE IF NOT EXISTS 'POLITICAL_LEADER';

-- Cambia los lideres de partido existentes de MINISTER a POLITICAL_LEADER
-- (aquellos que tienen partyId asignado, es decir, son lideres de partido)
UPDATE "Official"
SET "role" = 'POLITICAL_LEADER'
WHERE "role" = 'MINISTER'
  AND "partyId" IS NOT NULL;
