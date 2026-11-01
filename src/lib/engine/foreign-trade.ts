// ─── Comercio exterior agregado y tipo de cambio (Economía, Fase 4) ──────────
// Funciones puras. Además de los medicamentos importados (trade.ts) la economía exporta y compra bienes en el
// exterior. Con todo en su valor inicial (arancel 10 %, apertura 50, tipo de cambio 100, eficiencia de referencia)
// la competitividad vale 1, el ingreso arancelario neto 0 y la balanza ≈ 0: el equilibrio inicial no cambia.
//
//   competitividad = productividad × apertura × tipoCambio^ε × represalia / sanciones
//   exportaciones  = PIB/12 × EXPORT_GDP_SHARE × competitividad
//   otras importaciones = PIB/12 × IMPORT_GDP_SHARE × apertura × tipoCambio^−ε × ((1+arancel)/(1+arancelInicial))^−εa
//   ingreso arancelario neto = otras importaciones × (arancel − arancelInicial)/100  (el inicial ya está en la recaudación base)
//   tipo de cambio: se acerca con inercia a un objetivo que sube con el déficit comercial, la inflación y una mala calificación;
//   la intervención cambiaria frena el movimiento a cambio de tesoro.

import { BALANCE, SUB_DECISION_EFFECTS } from "../balance";
import type { GameState, MinistryState } from "./types";

type MinistryLike = Pick<MinistryState, "key" | "subDecisions"> & { efficiency?: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const economyMinistry = (ministries: readonly MinistryLike[]) =>
  ministries.find((m) => m.key === "ECONOMY" || m.key === "economia");

/** Valor vigente de una sub-decisión de Economía, acotado a su rango; sin valor, el neutral (sembrado). */
function economyDecision(ministries: readonly MinistryLike[], key: "aranceles" | "intervencionCambiaria" | "politicaIndustrial"): number {
  const effect = SUB_DECISION_EFFECTS.ECONOMY[key];
  const [lo, hi] = effect.range ?? [0, 100];
  const value = economyMinistry(ministries)?.subDecisions?.[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, lo, hi) : (effect.neutral as number);
}

/** Arancel vigente (%) y el inicial (el sembrado). */
export const tariffRate = (ministries: readonly MinistryLike[]) => economyDecision(ministries, "aranceles");
export const neutralTariff = () => SUB_DECISION_EFFECTS.ECONOMY.aranceles.neutral as number;

/** Intervención cambiaria (0 = flotación libre … 100 = tipo de cambio fijo). */
export const interventionLevel = (ministries: readonly MinistryLike[]) => economyDecision(ministries, "intervencionCambiaria");

/** Apertura comercial: politicaIndustrial (0 = proteccionismo, 100 = apertura total, 50 = inicial). */
const opennessIndex = (ministries: readonly MinistryLike[]) => (economyDecision(ministries, "politicaIndustrial") - 50) / 50;

/** Tipo de cambio vigente (índice, 100 = inicial); inválido o ausente = 100. */
export function exchangeRateOf(state: Pick<GameState, "exchangeRate">): number {
  const v = state.exchangeRate;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? clamp(v, BALANCE.FX_MIN, BALANCE.FX_MAX) : BALANCE.FX_BASE;
}

/** Productividad exportadora: eficiencia media de Economía y Agricultura sobre la de referencia (sin ministerio, vale 1). */
function productivity(ministries: readonly MinistryLike[]): number {
  const eff = (keys: string[]) => ministries.find((m) => keys.includes(m.key))?.efficiency;
  const e = eff(["ECONOMY", "economia"]) ?? BALANCE.EXPORT_REFERENCE_EFFICIENCY;
  const a = eff(["AGRICULTURE", "agricultura"]) ?? BALANCE.EXPORT_REFERENCE_EFFICIENCY;
  return Math.max(0, (e + a) / 2) / BALANCE.EXPORT_REFERENCE_EFFICIENCY;
}

/**
 * Competitividad exportadora (1 = inicial). Sube con la eficiencia de Economía y Agricultura, la apertura y un tipo de cambio
 * depreciado; baja con la represalia por aranceles altos y con las sanciones del default (sanctionsMultiplier > 1).
 */
export function exportCompetitiveness(
  state: Pick<GameState, "ministries" | "exchangeRate" | "sanctionsMultiplier">,
): number {
  const ministries = state.ministries ?? [];
  const opening = 1 + BALANCE.EXPORT_OPENNESS_EFFECT * opennessIndex(ministries);
  const fx = Math.pow(exchangeRateOf(state) / BALANCE.FX_BASE, BALANCE.EXPORT_FX_ELASTICITY);
  const retaliation = 1 - BALANCE.EXPORT_RETALIATION * Math.max(0, tariffRate(ministries) - neutralTariff()) / 100;
  const sanctions = Math.max(1, state.sanctionsMultiplier ?? 1);
  return Math.max(0, productivity(ministries) * opening * fx * retaliation / sanctions);
}

/** Exportaciones del mes (PIB mensual × participación × competitividad). */
export function monthlyExports(
  state: Pick<GameState, "ministries" | "exchangeRate" | "sanctionsMultiplier">,
  monthlyGdp: number,
): number {
  return Math.max(0, monthlyGdp) * BALANCE.EXPORT_GDP_SHARE * exportCompetitiveness(state);
}

/** Importaciones del mes distintas de los medicamentos: crecen con la apertura y bajan con el arancel y la depreciación. */
export function monthlyOtherImports(
  state: Pick<GameState, "ministries" | "exchangeRate">,
  monthlyGdp: number,
): number {
  const ministries = state.ministries ?? [];
  const opening = 1 + BALANCE.IMPORT_OPENNESS_EFFECT * opennessIndex(ministries);
  const fx = Math.pow(exchangeRateOf(state) / BALANCE.FX_BASE, -BALANCE.IMPORT_FX_ELASTICITY);
  const tariff = Math.pow((1 + tariffRate(ministries) / 100) / (1 + neutralTariff() / 100), -BALANCE.IMPORT_TARIFF_ELASTICITY);
  return Math.max(0, monthlyGdp) * BALANCE.IMPORT_GDP_SHARE * opening * fx * tariff;
}

/** Ingreso arancelario neto respecto del inicial: positivo con aranceles sobre el inicial, negativo si se bajan. */
export function tariffRevenueDelta(ministries: readonly MinistryLike[], otherImports: number): number {
  return Math.max(0, otherImports) * (tariffRate(ministries) - neutralTariff()) / 100;
}

export interface FxInputs {
  /** Importaciones − exportaciones del mes (positivo = déficit comercial) */
  tradeDeficit: number;
  monthlyGdp: number;
  /** Inflación anual (%) */
  inflation: number;
  /** Puntaje de calificación (null = sin calcular: sin presión) */
  creditScore: number | null | undefined;
}

/** Tipo de cambio al que tiende la economía con estos fundamentos (acotado a [FX_MIN, FX_MAX]). */
export function exchangeRateTarget(i: FxInputs): number {
  const deficitShare = i.monthlyGdp > 0 ? i.tradeDeficit / i.monthlyGdp : 0;
  const rating = typeof i.creditScore === "number" && Number.isFinite(i.creditScore)
    ? Math.max(0, BALANCE.FX_RATING_OK - i.creditScore) : 0;
  const pressure = BALANCE.FX_TRADE_WEIGHT * deficitShare
    + BALANCE.FX_INFLATION_WEIGHT * (Number.isFinite(i.inflation) ? i.inflation - BALANCE.INFLATION_TARGET : 0)
    + BALANCE.FX_RATING_WEIGHT * rating;
  return clamp(BALANCE.FX_BASE * (1 + pressure), BALANCE.FX_MIN, BALANCE.FX_MAX);
}

/**
 * Próximo tipo de cambio: recorre FX_ADJUST de la distancia al objetivo; la intervención (0-100) evita hasta FX_DEFENSE_MAX de ese
 * movimiento. Devuelve el nuevo valor y los puntos de movimiento evitados (que cuestan tesoro).
 */
export function nextExchangeRate(current: number, target: number, intervention: number): { rate: number; avoidedMove: number } {
  const freeMove = BALANCE.FX_ADJUST * (target - current);
  const defended = clamp(intervention, 0, 100) / 100 * BALANCE.FX_DEFENSE_MAX;
  const move = freeMove * (1 - defended);
  return { rate: clamp(current + move, BALANCE.FX_MIN, BALANCE.FX_MAX), avoidedMove: Math.abs(freeMove - move) };
}

/** Costo mensual de defender el tipo de cambio: FX_DEFENSE_COST × movimiento evitado (puntos/100) × PIB mensual. */
export function interventionCost(avoidedMove: number, monthlyGdp: number): number {
  return BALANCE.FX_DEFENSE_COST * (avoidedMove / 100) * Math.max(0, monthlyGdp);
}

/** Inflación importada: puntos de presión de equilibrio por la depreciación sobre el valor inicial (sin deflación por apreciación). */
export function fxInflationPressure(state: Pick<GameState, "exchangeRate">): number {
  return BALANCE.INFLATION_FX_PASSTHROUGH * Math.max(0, exchangeRateOf(state) - BALANCE.FX_BASE);
}
