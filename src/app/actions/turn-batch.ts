// @ts-nocheck — Capa de persistencia: SQL crudo con tipos planos del motor.
// ─── Escrituras agrupadas del turno ───────────────────────────────────────────
// Cada función guarda TODAS las filas de una tabla en UNA sola sentencia (`unnest` de arrays
// paralelos), en lugar de un `update`/`upsert` por fila. Dentro de la transacción del turno cada
// sentencia es una ida y vuelta a la base de datos; contra un Postgres remoto (≈200 ms) el
// centenar de sentencias por turno tardaba más de 20 s. El resultado es el mismo que el de los
// bucles originales (el test de equivalencia compara las tablas fila por fila).
//
// Convenciones:
//  - Los ids son TEXT en esta base (Prisma `String @id`), no uuid: se pasan como text[].
//  - Las columnas Json viajan como texto JSON y se castean a jsonb; `null` conserva el valor
//    actual (equivale al `undefined` de Prisma, que no toca la columna).
//  - Sin filas no se envía nada.

const json = (value) => (value === undefined ? null : JSON.stringify(value));

/**
 * Números como texto y cast a float8 en la sentencia: un array JS con NaN/Infinity viajaría como
 * `null` (y violaría NOT NULL) mientras que el `update` por fila de antes los guardaba tal cual
 * ('NaN' es un float8 válido). Así el comportamiento no cambia ni siquiera con datos malos.
 */
const num = (values) => values.map((v) => (v === undefined || v === null ? null : String(v)));

/** Última aparición gana: evita "ON CONFLICT … cannot affect row a second time" si hubiera claves repetidas. */
function dedupe(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(key(row), row);
  return [...map.values()];
}

export async function updateMinistries(tx, ministries) {
  if (ministries.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Ministry" AS t SET
      "efficiency" = v."efficiency",
      "internalCorruption" = v."internalCorruption",
      "subDecisions" = COALESCE(v."subDecisions"::jsonb, t."subDecisions"),
      "budgetPercent" = v."budgetPercent",
      "ministerOfficialId" = v."ministerOfficialId",
      "producedResources" = COALESCE(v."producedResources"::jsonb, t."producedResources"),
      "consumedResources" = COALESCE(v."consumedResources"::jsonb, t."consumedResources"),
      "healthBudgetSplit" = COALESCE(v."healthBudgetSplit"::jsonb, t."healthBudgetSplit")
    FROM unnest(
      ${ministries.map((m) => m.id)}::text[],
      ${num(ministries.map((m) => m.efficiency))}::text[]::float8[],
      ${num(ministries.map((m) => m.internalCorruption))}::text[]::float8[],
      ${ministries.map((m) => json(m.subDecisions))}::text[],
      ${num(ministries.map((m) => m.budgetPercent))}::text[]::float8[],
      ${ministries.map((m) => m.ministerOfficialId ?? null)}::text[],
      ${ministries.map((m) => json(m.producedResources))}::text[],
      ${ministries.map((m) => json(m.consumedResources))}::text[],
      ${ministries.map((m) => json(m.healthBudgetSplit))}::text[]
    ) AS v("id", "efficiency", "internalCorruption", "subDecisions", "budgetPercent",
           "ministerOfficialId", "producedResources", "consumedResources", "healthBudgetSplit")
    WHERE t."id" = v."id"
  `;
}

/** Equivale a `official.upsert` por fila: crea los nuevos candidatos y actualiza los existentes. */
export async function upsertOfficials(tx, gameId, officials) {
  if (officials.length === 0) return;
  const rows = dedupe(officials, (o) => o.id);
  await tx.$executeRaw`
    INSERT INTO "Official" (
      "id", "gameId", "name", "role", "specialty", "status", "corruption", "skill",
      "loyalty", "ambition", "wealth", "reputation", "ideology", "ministryId", "partyId"
    )
    SELECT v."id", ${gameId}, v."name", v."role"::"OfficialRole", v."specialty", v."status"::"OfficialStatus",
           v."corruption", v."skill", v."loyalty", v."ambition", v."wealth", v."reputation",
           v."ideology"::jsonb, v."ministryId", v."partyId"
    FROM unnest(
      ${rows.map((o) => o.id)}::text[],
      ${rows.map((o) => o.name)}::text[],
      ${rows.map((o) => o.role)}::text[],
      ${rows.map((o) => o.specialty ?? null)}::text[],
      ${rows.map((o) => o.status)}::text[],
      ${num(rows.map((o) => o.corruption))}::text[]::float8[],
      ${num(rows.map((o) => o.skill ?? 50))}::text[]::float8[],
      ${num(rows.map((o) => o.loyalty))}::text[]::float8[],
      ${num(rows.map((o) => o.ambition))}::text[]::float8[],
      ${num(rows.map((o) => o.wealth))}::text[]::float8[],
      ${num(rows.map((o) => o.reputation))}::text[]::float8[],
      ${rows.map((o) => json(o.ideology))}::text[],
      ${rows.map((o) => o.ministryId ?? null)}::text[],
      ${rows.map((o) => o.partyId ?? null)}::text[]
    ) AS v("id", "name", "role", "specialty", "status", "corruption", "skill",
           "loyalty", "ambition", "wealth", "reputation", "ideology", "ministryId", "partyId")
    ON CONFLICT ("id") DO UPDATE SET
      "corruption" = EXCLUDED."corruption",
      "status" = EXCLUDED."status",
      "wealth" = EXCLUDED."wealth",
      "reputation" = EXCLUDED."reputation",
      "ministryId" = EXCLUDED."ministryId",
      "partyId" = EXCLUDED."partyId",
      "role" = EXCLUDED."role",
      "specialty" = EXCLUDED."specialty",
      "loyalty" = EXCLUDED."loyalty",
      "ambition" = EXCLUDED."ambition",
      "skill" = EXCLUDED."skill",
      "ideology" = EXCLUDED."ideology"
  `;
}

export async function updateSocialClasses(tx, classes) {
  if (classes.length === 0) return;
  await tx.$executeRaw`
    UPDATE "SocialClass" AS t SET
      "approval" = v."approval",
      "populationPercent" = v."populationPercent",
      "educationLevel" = v."educationLevel",
      "healthAccess" = v."healthAccess",
      "averageIncome" = v."averageIncome",
      "demands" = COALESCE(v."demands"::jsonb, t."demands")
    FROM unnest(
      ${classes.map((c) => c.id)}::text[],
      ${num(classes.map((c) => c.approval))}::text[]::float8[],
      ${num(classes.map((c) => c.populationPercent))}::text[]::float8[],
      ${num(classes.map((c) => c.educationLevel))}::text[]::float8[],
      ${num(classes.map((c) => c.healthAccess))}::text[]::float8[],
      ${num(classes.map((c) => c.averageIncome))}::text[]::float8[],
      ${classes.map((c) => json(c.demands))}::text[]
    ) AS v("id", "approval", "populationPercent", "educationLevel", "healthAccess", "averageIncome", "demands")
    WHERE t."id" = v."id"
  `;
}

export async function updateRegions(tx, regions) {
  if (regions.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Region" AS t SET
      "povertyRate" = v."povertyRate",
      "infrastructureLevel" = v."infrastructureLevel",
      "healthCoverage" = COALESCE(v."healthCoverage"::jsonb, t."healthCoverage")
    FROM unnest(
      ${regions.map((r) => r.id)}::text[],
      ${num(regions.map((r) => r.povertyRate))}::text[]::float8[],
      ${num(regions.map((r) => r.infrastructureLevel))}::text[]::float8[],
      ${regions.map((r) => json(r.healthCoverage))}::text[]
    ) AS v("id", "povertyRate", "infrastructureLevel", "healthCoverage")
    WHERE t."id" = v."id"
  `;
}

/** hasVaccine / mortalityRate (la investigación de Salud-3A los cambia). */
export async function updateDiseases(tx, diseases) {
  if (diseases.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Disease" AS t SET
      "hasVaccine" = v."hasVaccine",
      "mortalityRate" = v."mortalityRate"
    FROM unnest(
      ${diseases.map((d) => d.id)}::text[],
      ${diseases.map((d) => d.hasVaccine)}::boolean[],
      ${num(diseases.map((d) => d.mortalityRate))}::text[]::float8[]
    ) AS v("id", "hasVaccine", "mortalityRate")
    WHERE t."id" = v."id"
  `;
}

/** INSERT … ON CONFLICT por (gameId, diseaseId): atómico, nunca P2002/25P02. */
export async function upsertDiseasePrevalences(tx, gameId, prevalences) {
  if (prevalences.length === 0) return;
  const rows = dedupe(prevalences, (p) => p.diseaseId);
  await tx.$executeRaw`
    INSERT INTO "DiseasePrevalence" ("id", "gameId", "diseaseId", "currentPrevalence", "updatedAt")
    SELECT v."id", ${gameId}, v."diseaseId", v."currentPrevalence", NOW()
    FROM unnest(
      ${rows.map(() => crypto.randomUUID())}::text[],
      ${rows.map((p) => p.diseaseId)}::text[],
      ${num(rows.map((p) => p.currentPrevalence))}::text[]::float8[]
    ) AS v("id", "diseaseId", "currentPrevalence")
    ON CONFLICT ("gameId", "diseaseId")
    DO UPDATE SET "currentPrevalence" = EXCLUDED."currentPrevalence", "updatedAt" = NOW()
  `;
}

/** INSERT … ON CONFLICT por (gameId, resourceType). */
export async function upsertResourceStocks(tx, gameId, stocks) {
  if (stocks.length === 0) return;
  const rows = dedupe(stocks, (s) => s.resourceType);
  await tx.$executeRaw`
    INSERT INTO "ResourceStock" ("id", "gameId", "resourceType", "quantity", "updatedAt")
    SELECT v."id", ${gameId}, v."resourceType", v."quantity", NOW()
    FROM unnest(
      ${rows.map(() => crypto.randomUUID())}::text[],
      ${rows.map((s) => s.resourceType)}::text[],
      ${num(rows.map((s) => s.quantity))}::text[]::float8[]
    ) AS v("id", "resourceType", "quantity")
    ON CONFLICT ("gameId", "resourceType")
    DO UPDATE SET "quantity" = EXCLUDED."quantity", "updatedAt" = NOW()
  `;
}
