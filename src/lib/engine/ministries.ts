// ─── Funciones puras de ministerios ───────────────────────────────────────────
// Cálculo de eficiencia ministerial (calidad de gestión, 0-100).
// Incluye cálculo de corrupción interna ponderada para ministerios con
// múltiples officials (ministro + directores subordinados).

import type { MinistryState, OfficialState } from "./types";

/**
 * Eficiencia ministerial = (1 - corrupcion/100) * (skillDelMinistro/100) * 100.
 * Representa la calidad pura de gestion del ministerio, independiente del presupuesto.
 * - corrupcion: se toma del ministro si existe; si no, de ministry.internalCorruption.
 * - skill: del ministro asignado; si no hay ministro se asume 50.
 * - directorSkill: si hay directores subordinados, se promedia con skill del ministro.
 *   peso: 70% ministro, 30% promedio de directores (si existen).
 * - El resultado se trunca al rango [0, 100].
 *
 * Para calcular el impacto real en indicadores sociales se usa:
 *   impact = eficiencia * (1 - Math.exp(-budgetPercent / 12))
 */
export function calculateMinistryEfficiency(
  ministry: MinistryState,
  minister: OfficialState | undefined,
  directors?: OfficialState[]
): number {
  const corruption = minister ? minister.corruption : ministry.internalCorruption;
  const corruptionFactor = 1 - Math.max(0, Math.min(100, corruption)) / 100;

  // Skill: ministro (o 50 si no hay), combinado con directores si existen
  let skill = minister?.skill ?? 50;

  if (directors && directors.length > 0) {
    const avgDirectorSkill =
      directors.reduce((sum, d) => sum + d.skill, 0) / directors.length;
    // 70% ministro + 30% promedio de directores
    skill = skill * 0.7 + avgDirectorSkill * 0.3;
  }

  const skillFactor = Math.max(0, Math.min(100, skill)) / 100;

  const raw = corruptionFactor * skillFactor * 100;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Calcula la corrupcion interna del ministerio como promedio ponderado
 * de la corrupcion de sus officials activos.
 *
 * Pesos:
 *  - Ministro: 60%
 *  - Directores subordinados (MINISTRY_DIRECTOR con ese ministryId): 40% repartido equitativamente
 *
 * Si falta el ministro, su peso se redistribuye entre los directores.
 * Si faltan directores, su peso se redistribuye al ministro.
 * Si no hay nadie, se usa ministry.internalCorruption (valor persistido).
 *
 * @param ministry - El ministerio a evaluar
 * @param officials - Todos los officials del estado
 * @returns Corrupcion interna ponderada (0-100)
 */
export function calculateMinistryInternalCorruption(
  ministry: MinistryState,
  officials: OfficialState[]
): number {
  const minister = officials.find(
    (o) => o.id === ministry.ministerOfficialId && o.status === "ACTIVE"
  );

  const directors = officials.filter(
    (o) =>
      o.role === "MINISTRY_DIRECTOR" &&
      o.ministryId === ministry.id &&
      o.status === "ACTIVE"
  );

  // Sin minister ni directores: usar valor persistido
  if (!minister && directors.length === 0) {
    return ministry.internalCorruption;
  }

  // Solo ministro, sin directores
  if (minister && directors.length === 0) {
    return minister.corruption;
  }

  // Solo directores, sin ministro
  if (!minister && directors.length > 0) {
    return (
      directors.reduce((sum, d) => sum + d.corruption, 0) / directors.length
    );
  }

  // Ministro + directores: pesos nominales
  const totalDirectors = directors.length + (minister ? 0 : 0);
  const ministerWeight = 0.6;
  const directorWeight = 0.4 / Math.max(1, directors.length);

  let weightedCorruption = 0;
  let totalWeight = 0;

  if (minister) {
    weightedCorruption += minister.corruption * ministerWeight;
    totalWeight += ministerWeight;
  }

  for (const d of directors) {
    weightedCorruption += d.corruption * directorWeight;
    totalWeight += directorWeight;
  }

  // Redistribuir peso no usado (si algun director falta)
  if (totalWeight < 1.0 && totalWeight > 0) {
    const remainingWeight = 1.0 - totalWeight;
    weightedCorruption += (minister?.corruption ?? directors[0].corruption) * remainingWeight;
  }

  return Math.max(0, Math.min(100, Math.round(weightedCorruption * 10) / 10));
}

/**
 * Devuelve los directores subordinados de un ministerio.
 */
export function getMinistryDirectors(
  ministry: MinistryState,
  officials: OfficialState[]
): OfficialState[] {
  return officials.filter(
    (o) =>
      o.role === "MINISTRY_DIRECTOR" &&
      o.ministryId === ministry.id &&
      o.status === "ACTIVE"
  );
}
