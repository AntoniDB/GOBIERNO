// ─── Funciones puras de ministerios ───────────────────────────────────────────
// Cálculo de eficiencia ministerial (calidad de gestión, 0-100).

import type { MinistryState, OfficialState } from "./types";

/**
 * Eficiencia ministerial = (1 - corrupcion/100) * (skillDelMinistro/100) * 100.
 * Representa la calidad pura de gestion del ministerio, independiente del presupuesto.
 * - corrupcion: se toma del ministro si existe; si no, de ministry.internalCorruption.
 * - skill: del ministro asignado; si no hay ministro se asume 50.
 * - El resultado se trunca al rango [0, 100].
 *
 * Para calcular el impacto real en indicadores sociales se usa:
 *   impact = eficiencia * (1 - Math.exp(-budgetPercent / 12))
 */
export function calculateMinistryEfficiency(
  ministry: MinistryState,
  minister: OfficialState | undefined
): number {
  const corruption = minister ? minister.corruption : ministry.internalCorruption;
  const corruptionFactor = 1 - Math.max(0, Math.min(100, corruption)) / 100;
  const skillFactor = (minister?.skill ?? 50) / 100;

  const raw = corruptionFactor * skillFactor * 100;

  return Math.max(0, Math.min(100, raw));
}
