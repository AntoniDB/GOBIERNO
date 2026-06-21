// ─── Funciones puras de corrupción ────────────────────────────────────────────
// Cálculo de corrupción individual y global.

import type { OfficialState, GameState } from "./types";
import { BALANCE } from "../balance";

/**
 * Calcula el nuevo nivel de corrupción de un official después de un turno.
 *
 * Incrementos:
 *   + Base: BALANCE.CORRUPTION_BASE_INCREASE
 *   + Extra si el ministerio asociado tiene budgetPercent > 20:
 *     (budgetPercent - 20) * BALANCE.CORRUPTION_BUDGET_FACTOR
 *
 * Reducciones:
 *   - Contraloría activa: BALANCE.COMPTROLLER_CORRUPTION_REDUCTION * (effectiveness/100)
 *   - Fiscalía Anticorrupción activa: BALANCE.ANTICORRUPTION_CORRUPTION_REDUCTION * (effectiveness/100)
 *   - Efecto disuasivo por casos judiciales: BALANCE.CORRUPTION_DETERRENCE_BY_CASES * nroCasos
 *
 * Resultado final se trunca a [0, 100].
 */
export function updateOfficialCorruption(
  official: OfficialState,
  state: GameState
): number {
  // ── Incrementos ──────────────────────────────────────────────────────────

  let increase = BALANCE.CORRUPTION_BASE_INCREASE;

  // Extra si el ministerio asociado tiene alto presupuesto
  if (official.ministryId) {
    const ministry = state.ministries.find((m) => m.id === official.ministryId);
    if (ministry && ministry.budgetPercent > 20) {
      increase +=
        (ministry.budgetPercent - 20) * BALANCE.CORRUPTION_BUDGET_FACTOR;
    }
  }

  // ── Reducciones ──────────────────────────────────────────────────────────

  let reduction = 0;

  // Contraloría: busca organismo de tipo COMPTROLLER
  const comptroller = state.organisms.find(
    (org) => org.type === "COMPTROLLER"
  );
  if (comptroller) {
    reduction +=
      BALANCE.COMPTROLLER_CORRUPTION_REDUCTION * (comptroller.effectiveness / 100);
  }

  // Fiscalía Anticorrupción: busca organismo de tipo ANTICORRUPTION
  const anticorruption = state.organisms.find(
    (org) => org.type === "ANTICORRUPTION_PROSECUTION"
  );
  if (anticorruption) {
    reduction +=
      BALANCE.ANTICORRUPTION_CORRUPTION_REDUCTION *
      (anticorruption.effectiveness / 100);
  }

  // Efectos de autonomía en contraloría
  if (comptroller) {
    if (comptroller.autonomyLevel > 70) {
      reduction += 1; // Extra por alta autonomía
    }
    if (comptroller.autonomyLevel < 30) {
      reduction -= 0.5; // Baja autonomía = menos efectiva
    }
  }

  // Efecto disuasivo por casos judiciales en curso
  const activeCases = state.judicialCases.filter(
    (c) => c.verdict === null
  ).length;
  reduction += BALANCE.CORRUPTION_DETERRENCE_BY_CASES * activeCases;

  // ── Resultado ────────────────────────────────────────────────────────────

  const newCorruption = official.corruption + increase - reduction;
  return Math.max(0, Math.min(100, newCorruption));
}

/**
 * Corrupción global = promedio ponderado de corrupción de todos los officials.
 * Los ministros (role === "MINISTER") pesan 3x respecto al resto.
 */
export function calculateGlobalCorruption(
  officials: OfficialState[]
): number {
  if (officials.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const official of officials) {
    const weight = official.role === "MINISTER" ? 3 : 1;
    weightedSum += official.corruption * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
