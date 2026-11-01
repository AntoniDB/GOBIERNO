// ─── Choques de eventos sobre los indicadores (Issue 25) ─────────────────────
// Los indicadores sociales se recalculan cada mes desde su fórmula (ministerios, leyes, sub-decisiones),
// así que un evento (ola de criminalidad, desastre, crisis económica…) no podía dejar huella: su delta
// se perdía al recalcular. El choque es un componente aparte que se suma a la fórmula y se disipa solo:
//   indicador = fórmula + choque
//   choque(t+1) = choque(t) × EVENT_SHOCK_RETENTION   (y los eventos del mes suman el suyo)
// Funciones puras sobre `state.indicatorShocks` (persistido en Game.indicatorShocks).

import { BALANCE } from "../balance";
import type { GameState } from "./types";

/**
 * Indicadores con choque. `gdpPct` es un % del PIB (negativo = pérdida); `healthEfficiency` y `securityEfficiency`
 * son puntos de eficiencia que pierde el ministerio (positivo = pérdida).
 */
export type ShockKey =
  | "unemploymentRate" | "sickRate" | "crimeRate" | "foodSecurity"
  | "gdpPct" | "healthEfficiency" | "securityEfficiency";

/** Choque vigente de un indicador (0 si no hay o no es un número válido). */
export function indicatorShock(state: Pick<GameState, "indicatorShocks">, key: ShockKey): number {
  const v = state.indicatorShocks?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

const clampShock = (v: number) => Math.max(-BALANCE.EVENT_SHOCK_MAX, Math.min(BALANCE.EVENT_SHOCK_MAX, v));

/** Disipa los choques un mes: × EVENT_SHOCK_RETENTION; los menores a 0,05 puntos se descartan. */
export function decayIndicatorShocks(state: Pick<GameState, "indicatorShocks">): void {
  const next: Partial<Record<ShockKey, number>> = {};
  for (const [key, value] of Object.entries(state.indicatorShocks ?? {}) as Array<[ShockKey, number]>) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const decayed = value * BALANCE.EVENT_SHOCK_RETENTION;
    if (Math.abs(decayed) >= 0.05) next[key] = Math.round(decayed * 1000) / 1000;
  }
  state.indicatorShocks = next;
}

/** Suma los deltas de los eventos del mes a los choques (con tope ±EVENT_SHOCK_MAX por indicador). */
export function addEventShocks(
  state: Pick<GameState, "indicatorShocks">,
  deltas: {
    unemploymentDelta: number; sickRateDelta: number; crimeRateDelta: number; foodDelta: number;
    gdpPctDelta?: number; healthEfficiencyDelta?: number; securityEfficiencyDelta?: number;
  },
): void {
  const add: Record<ShockKey, number> = {
    unemploymentRate: deltas.unemploymentDelta,
    sickRate: deltas.sickRateDelta,
    crimeRate: deltas.crimeRateDelta,
    foodSecurity: deltas.foodDelta,
    gdpPct: deltas.gdpPctDelta ?? 0,
    healthEfficiency: deltas.healthEfficiencyDelta ?? 0,
    securityEfficiency: deltas.securityEfficiencyDelta ?? 0,
  };
  const next = { ...(state.indicatorShocks ?? {}) };
  for (const key of Object.keys(add) as ShockKey[]) {
    if (!Number.isFinite(add[key]) || add[key] === 0) continue;
    next[key] = clampShock(indicatorShock(state, key) + add[key]);
  }
  state.indicatorShocks = next;
}
