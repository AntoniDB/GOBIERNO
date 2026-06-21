// ─── Funciones puras de ministerios ───────────────────────────────────────────
// Cálculo de eficiencia ministerial.

import type { MinistryState, OfficialState } from "./types";
import { BALANCE } from "../balance";

/**
 * Eficiencia ministerial = budgetPercent * (1 - corrupciónInterna/100)
 *   * (skillDelMinistro/100) * BALANCE.EFFICIENCY_BASE_FACTOR.
 * - skill del ministro: si no hay ministro asignado se asume 50.
 * - El resultado se trunca al rango [0, 100].
 */
export function calculateMinistryEfficiency(
  ministry: MinistryState,
  minister: OfficialState | undefined
): number {
  const budgetFactor = ministry.budgetPercent;
  const corruptionFactor = 1 - ministry.internalCorruption / 100;
  const skillFactor = (minister?.skill ?? 50) / 100;

  const raw = budgetFactor * corruptionFactor * skillFactor * BALANCE.EFFICIENCY_BASE_FACTOR;

  return Math.max(0, Math.min(100, raw));
}
