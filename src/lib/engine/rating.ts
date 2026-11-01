// ─── Calificación crediticia / riesgo país (Economía, Fase 3) ────────────────
// Funciones puras. El puntaje (0-100) resume qué tan fiable es el país para los mercados:
//   objetivo = 100 − Σ penalizaciones − memoria de default + bono del Banco Central
//   penalización_i = peso_i × clamp((indicador − ok) / (máx − ok), 0, 1)
// El puntaje se mueve con inercia hacia el objetivo (las agencias bajan rápido y suben despacio) y la
// letra (AAA … D) fija el diferencial que paga la deuda y la probabilidad de los eventos de mercado.
// No importa fiscal.ts (fiscal.ts usa `ratingSpread`): el PIB y la deuda llegan como parámetros.

import { BALANCE } from "../balance";

export type Rating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "D";
export const RATINGS: readonly Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "D"];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Penalización proporcional entre `ok` (0) y `max` (peso completo). */
function ramp(value: number, ok: number, max: number, weight: number): number {
  if (Number.isNaN(value)) return 0; // Infinity (sin recaudación) cuenta como el máximo
  return weight * clamp((value - ok) / (max - ok), 0, 1);
}

/** Letra de un puntaje. Sin puntaje (null/undefined/NaN) no hay calificación. */
export function ratingFromScore(score: number | null | undefined): Rating | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const idx = BALANCE.RATING_THRESHOLDS.findIndex((min) => score >= min);
  return idx === -1 ? "D" : RATINGS[idx];
}

/** Diferencial anual sobre la tasa base de la deuda; sin calificación, 0 (partidas sin puntaje todavía). */
export function ratingSpread(score: number | null | undefined): number {
  const rating = ratingFromScore(score);
  return rating ? BALANCE.RATING_SPREADS[rating] : 0;
}

/** ¿La calificación es de grado especulativo (BB o peor)? */
export function isSpeculativeGrade(score: number | null | undefined): boolean {
  const rating = ratingFromScore(score);
  return rating !== null && RATINGS.indexOf(rating) >= RATINGS.indexOf("BB");
}

export interface RatingInputs {
  /** Deuda pública / PIB anual */
  debtToGdp: number;
  /** Déficit del mes en % de la recaudación (0 si hay superávit) */
  deficitPct: number;
  /** Inflación anual (%) */
  inflation: number;
  /** Intereses del mes / recaudación del mes */
  interestBurden: number;
  /** Aprobación general vigente (0-100) */
  approval: number;
  /** Corrupción global (0-100) */
  corruption: number;
  /** Pobreza (%) */
  povertyRate: number;
  /** Meses desde el último default (null si nunca hubo) */
  monthsSinceDefault: number | null;
  /** Credibilidad monetaria (0-1) normalizada: 0 sin Banco Central, 1 con el máximo */
  centralBankCredibility: number;
}

export interface RatingBreakdown {
  debt: number;
  deficit: number;
  inflation: number;
  burden: number;
  approval: number;
  corruption: number;
  poverty: number;
  base: number;
  defaultMemory: number;
  centralBankBonus: number;
  /** Puntaje al que tiende el país con estos fundamentos */
  target: number;
}

/** Penalizaciones y puntaje objetivo (0-100) a partir de los fundamentos del mes. */
export function creditScoreTarget(i: RatingInputs): RatingBreakdown {
  const debt = ramp(i.debtToGdp, BALANCE.RATING_DEBT_OK, BALANCE.RATING_DEBT_MAX, BALANCE.RATING_W_DEBT);
  const deficit = ramp(i.deficitPct, 0, BALANCE.RATING_DEFICIT_MAX, BALANCE.RATING_W_DEFICIT);
  const inflation = ramp(i.inflation, BALANCE.RATING_INFLATION_OK, BALANCE.RATING_INFLATION_MAX, BALANCE.RATING_W_INFLATION);
  const burden = ramp(i.interestBurden, 0, BALANCE.RATING_BURDEN_MAX, BALANCE.RATING_W_BURDEN);
  // Aprobación: penaliza por debajo de RATING_APPROVAL_OK (máxima en 0)
  const approval = ramp(BALANCE.RATING_APPROVAL_OK - i.approval, 0, BALANCE.RATING_APPROVAL_OK, BALANCE.RATING_W_APPROVAL);
  const corruption = ramp(i.corruption, BALANCE.RATING_CORRUPTION_OK, BALANCE.RATING_CORRUPTION_MAX, BALANCE.RATING_W_CORRUPTION);
  const poverty = ramp(i.povertyRate, BALANCE.RATING_POVERTY_OK, BALANCE.RATING_POVERTY_MAX, BALANCE.RATING_W_POVERTY);
  const defaultMemory = i.monthsSinceDefault === null || !Number.isFinite(i.monthsSinceDefault)
    ? 0
    : BALANCE.RATING_W_DEFAULT * clamp(1 - i.monthsSinceDefault / BALANCE.RATING_DEFAULT_MEMORY_MONTHS, 0, 1);
  const centralBankBonus = BALANCE.RATING_CENTRAL_BANK_BONUS * clamp(i.centralBankCredibility, 0, 1);

  const base = BALANCE.RATING_BASE_PENALTY;

  const target = clamp(
    100 - base - debt - deficit - inflation - burden - approval - corruption - poverty - defaultMemory + centralBankBonus,
    0,
    100,
  );
  return { debt, deficit, inflation, burden, approval, corruption, poverty, base, defaultMemory, centralBankBonus, target };
}

/**
 * Puntaje del mes: se acerca al objetivo con inercia (baja RATING_INERTIA_DOWN, sube RATING_INERTIA_UP).
 * Sin puntaje previo (primer turno de una partida) arranca en el objetivo, sin transitorio.
 */
export function nextCreditScore(previous: number | null | undefined, target: number): number {
  if (typeof previous !== "number" || !Number.isFinite(previous)) return clamp(target, 0, 100);
  const k = target < previous ? BALANCE.RATING_INERTIA_DOWN : BALANCE.RATING_INERTIA_UP;
  return clamp(previous + k * (target - previous), 0, 100);
}

/** Intereses del mes / recaudación del mes. Sin recaudación: Infinity si hay intereses, 0 si no. */
export function interestBurden(monthlyInterest: number, monthlyRevenue: number): number {
  if (!(monthlyInterest > 0)) return 0;
  return monthlyRevenue > 0 ? monthlyInterest / monthlyRevenue : Infinity;
}
