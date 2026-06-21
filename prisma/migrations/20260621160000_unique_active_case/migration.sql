-- ============================================================================
-- Fix: previene JudicialCase duplicados activos mismo defendant + caseType
-- Un funcionario no puede tener dos casos activos (currentPhase != CLOSED)
-- del mismo caseType simultaneamente.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "JudicialCase_active_defendant_type_key"
ON "JudicialCase" ("defendantOfficialId", "caseType")
WHERE "currentPhase" != 'CLOSED';
