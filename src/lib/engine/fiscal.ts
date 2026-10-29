// ─── Política fiscal: impuestos, evasión y deuda pública (Economía, Fase 1) ───
// Funciones puras. La recaudación final la arma `calculateTaxRevenue` (economy.ts) con estas piezas;
// aquí no se importa economy.ts para no crear un ciclo (el PIB llega como parámetro).
//
// Recaudación (ver BALANCE, sección "Política fiscal"):
//   mezcla = Σ peso_i × rendimiento(tasa_i / tasaInicial_i)       IVA, renta, sociedades
//   rendimiento(x) = x × (1 − TAX_LAFFER × (x − 1))               subir la tasa erosiona la base
//   base = PIB × (1 − evasión);  factor = (base / base del primer mes)^elasticidad
// Deuda: el faltante de caja se cubre con deuda que paga intereses; el superávit por encima de una
// reserva de caja la amortiza.

import { BALANCE, SUB_DECISION_EFFECTS } from "../balance";
import { calculateGlobalCorruption } from "./corruption";
import type { GameState, MinistryState, OfficialState, OrganismState } from "./types";

export const TAX_KEYS = ["iva", "impuestoRenta", "impuestoSociedades"] as const;
export type TaxKey = (typeof TAX_KEYS)[number];

type MinistryLike = Pick<MinistryState, "key" | "subDecisions">;

const economyMinistry = (ministries: readonly MinistryLike[]) =>
  ministries.find((m) => m.key === "ECONOMY" || m.key === "economia");

/** Tasa inicial (la sembrada) de un impuesto: con ella la mezcla vale 1. */
export function neutralTaxRate(key: TaxKey): number {
  return SUB_DECISION_EFFECTS.ECONOMY[key].neutral as number;
}

/** Tasa vigente de un impuesto (sub-decisión de Economía), acotada a su rango; sin valor, la inicial. */
export function taxRate(ministries: readonly MinistryLike[], key: TaxKey): number {
  const effect = SUB_DECISION_EFFECTS.ECONOMY[key];
  const [lo, hi] = effect.range ?? [0, 100];
  const value = economyMinistry(ministries)?.subDecisions?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return effect.neutral as number;
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Rendimiento relativo de un impuesto cuya tasa es `ratio` veces la inicial.
 * Con TAX_LAFFER > 0 cada punto adicional rinde menos (la base se erosiona); 1 → 1, 0 → 0.
 */
export function taxYield(ratio: number): number {
  return Math.max(0, ratio * (1 - BALANCE.TAX_LAFFER * (ratio - 1)));
}

/** Factor de recaudación de la estructura de impuestos respecto de la inicial (1 con las tasas sembradas). */
export function taxMixFactor(ministries: readonly MinistryLike[]): number {
  let factor = 0;
  for (const key of TAX_KEYS) {
    factor += BALANCE.TAX_MIX_SHARES[key] * taxYield(taxRate(ministries, key) / neutralTaxRate(key));
  }
  return factor;
}

/**
 * Reducción de evasión que aporta la Agencia Tributaria (organismo TAX_AGENCY), si existe y no está
 * disuelta: máx × efectividad/100 × (0,5 + autonomía/200). Más autonomía, menos interferencia política.
 */
export function taxAgencyReduction(organisms: readonly OrganismState[]): number {
  const agency = organisms.find((o) => o.type === "TAX_AGENCY" && o.effectiveness > 0);
  if (!agency) return 0;
  const effectiveness = Math.min(100, Math.max(0, agency.effectiveness)) / 100;
  const autonomy = Math.min(100, Math.max(0, agency.autonomyLevel));
  return BALANCE.TAX_AGENCY_MAX_EVASION_REDUCTION * effectiveness * (0.5 + autonomy / 200);
}

/** Fracción de la recaudación que se evade: crece con la corrupción, baja con una Agencia Tributaria. */
export function evasionRate(officials: readonly OfficialState[], organisms: readonly OrganismState[]): number {
  const corruption = calculateGlobalCorruption(officials as OfficialState[]);
  const raw = BALANCE.TAX_EVASION_BASE
    + BALANCE.TAX_EVASION_CORRUPTION_FACTOR * (corruption / 100)
    - taxAgencyReduction(organisms);
  return Math.min(BALANCE.TAX_EVASION_MAX, Math.max(BALANCE.TAX_EVASION_MIN, raw));
}

/** Base imponible efectiva: PIB anual neto de evasión. */
export function collectibleBase(gdp: number, evasion: number): number {
  return Math.max(0, gdp) * (1 - evasion);
}

/**
 * Cuánto se recauda respecto del primer mes por el estado de la economía: (base / referencia)^elasticidad.
 * Sin referencia (primer turno de la partida) vale 1, así que el equilibrio inicial no cambia.
 */
export function economyFactor(base: number, reference: number | null | undefined): number {
  if (!reference || reference <= 0 || !Number.isFinite(reference)) return 1;
  if (base <= 0) return 0;
  return Math.pow(base / reference, BALANCE.TAX_BASE_ELASTICITY);
}

// ─── Deuda pública ───────────────────────────────────────────────────────────

/** Deuda / PIB anual. Sin PIB conocido se toma 0 (no se cobra prima por falta de dato). */
export function debtToGdp(debt: number, gdp: number): number {
  if (!(gdp > 0) || !(debt > 0)) return 0;
  return debt / gdp;
}

/**
 * Tasa anual que paga la deuda: base + traspaso de la tasa de interés de referencia + prima de riesgo
 * si la deuda supera el umbral seguro sobre el PIB. Nunca baja de DEBT_MIN_ANNUAL_RATE.
 */
export function debtAnnualRate(state: Pick<GameState, "ministries" | "gdp"> & { publicDebt?: number }): number {
  const eco = economyMinistry(state.ministries);
  const policy = eco?.subDecisions?.tasaInteres;
  const neutralPolicy = SUB_DECISION_EFFECTS.ECONOMY.tasaInteres.neutral as number;
  const policyRate = typeof policy === "number" && Number.isFinite(policy) ? policy : neutralPolicy;
  const ratio = debtToGdp(state.publicDebt ?? 0, state.gdp);
  const rate = BALANCE.DEBT_BASE_ANNUAL_RATE
    + BALANCE.DEBT_POLICY_RATE_PASSTHROUGH * ((policyRate - neutralPolicy) / 100)
    + BALANCE.DEBT_RISK_PREMIUM * Math.max(0, ratio - BALANCE.DEBT_SAFE_GDP_RATIO);
  return Math.max(BALANCE.DEBT_MIN_ANNUAL_RATE, rate);
}

/** Intereses mensuales de la deuda (gasto fijo del mes). */
export function monthlyDebtInterest(state: Pick<GameState, "ministries" | "gdp"> & { publicDebt?: number }): number {
  const debt = state.publicDebt ?? 0;
  if (!(debt > 0)) return 0;
  return (debt * debtAnnualRate(state)) / 12;
}

/**
 * Cierra la caja del mes:
 *  - tesoro negativo → se emite deuda por el faltante y el tesoro queda en 0;
 *  - con `amortize`, el tesoro que exceda DEBT_CASH_RESERVE_MONTHS meses de gasto amortiza deuda.
 * Muta `state.treasury` y `state.publicDebt`. Devuelve lo emitido y lo amortizado.
 */
export function settlePublicDebt(
  state: { treasury: number; publicDebt?: number },
  monthlyExpenses: number,
  amortize = true,
): { issued: number; amortized: number } {
  let debt = state.publicDebt ?? 0;
  let issued = 0;
  let amortized = 0;
  if (!Number.isFinite(state.treasury)) return { issued, amortized };

  if (state.treasury < 0) {
    issued = -state.treasury;
    debt += issued;
    state.treasury = 0;
  } else if (amortize && debt > 0) {
    const reserve = Math.max(0, monthlyExpenses) * BALANCE.DEBT_CASH_RESERVE_MONTHS;
    const excess = state.treasury - reserve;
    if (excess > 0) {
      amortized = Math.min(excess, debt);
      debt -= amortized;
      state.treasury -= amortized;
    }
  }
  state.publicDebt = debt;
  return { issued, amortized };
}
