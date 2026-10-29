// ─── Política monetaria: inflación con memoria, Banco Central y emisión (Economía, Fase 2) ───
// Funciones puras. La inflación es ANUAL (%) y se arrastra de un mes a otro (ver BALANCE.md,
// sección "Política monetaria"):
//   credibilidad = MONETARY_CRED_MIN sin Banco Central; con él sube con su autonomía y efectividad
//   presiones    = déficit + emisión − tasa de interés + sub-decisiones                (puntos anuales)
//   equilibrio   = meta + presiones × (1 + INFLATION_CRED_AMPLIFIER × (1 − credibilidad))
//   inflación    = anterior + INFLATION_ADJUST × credibilidad × (equilibrio − anterior)
// Un Banco Central autónomo fija la tasa con una regla de Taylor y no financia al gobierno.

import { BALANCE, SUB_DECISION_EFFECTS } from "../balance";
import { subDecisionIndicator } from "./sub-decision-effects";
import type { GameState, MinistryState, OrganismState, TurnNotification } from "./types";

type MinistryLike = Pick<MinistryState, "key" | "subDecisions">;

const economyMinistry = (ministries: readonly MinistryLike[]) =>
  ministries.find((m) => m.key === "ECONOMY" || m.key === "economia");

const NEUTRAL_RATE = SUB_DECISION_EFFECTS.ECONOMY.tasaInteres.neutral as number;
const [RATE_MIN, RATE_MAX] = SUB_DECISION_EFFECTS.ECONOMY.tasaInteres.range ?? [1, 20];
const [EMISSION_MIN, EMISSION_MAX] = SUB_DECISION_EFFECTS.ECONOMY.emisionMonetaria.range ?? [0, 30];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Banco Central vigente (no disuelto: efectividad > 0), si existe. */
export function centralBank(organisms: readonly OrganismState[]): OrganismState | undefined {
  return organisms.find((o) => o.type === "CENTRAL_BANK" && o.effectiveness > 0);
}

/** El Banco Central es autónomo: fija la tasa y se niega a emitir para el gobierno. */
export function isCentralBankAutonomous(organisms: readonly OrganismState[]): boolean {
  const bank = centralBank(organisms);
  return !!bank && bank.autonomyLevel >= BALANCE.CB_AUTONOMY_THRESHOLD;
}

/**
 * Credibilidad monetaria (0-1): cuánto creen los agentes que la inflación volverá a la meta.
 * Sin Banco Central es MONETARY_CRED_MIN; con él sube hasta MONETARY_CRED_MAX según
 * autonomía/100 × (0,5 + efectividad/200), la misma ponderación que la Agencia Tributaria.
 */
export function monetaryCredibility(organisms: readonly OrganismState[]): number {
  const bank = centralBank(organisms);
  if (!bank) return BALANCE.MONETARY_CRED_MIN;
  const autonomy = clamp(bank.autonomyLevel, 0, 100) / 100;
  const effectiveness = clamp(bank.effectiveness, 0, 100);
  return BALANCE.MONETARY_CRED_MIN
    + (BALANCE.MONETARY_CRED_MAX - BALANCE.MONETARY_CRED_MIN) * autonomy * (0.5 + effectiveness / 200);
}

/** Tasa de interés de referencia vigente (sub-decisión de Economía), acotada a su rango. */
export function policyRate(ministries: readonly MinistryLike[]): number {
  const value = economyMinistry(ministries)?.subDecisions?.tasaInteres;
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, RATE_MIN, RATE_MAX) : NEUTRAL_RATE;
}

/** Emisión monetaria vigente, en % de la recaudación del mes (0 si no hay valor). */
export function emissionPercent(ministries: readonly MinistryLike[]): number {
  const value = economyMinistry(ministries)?.subDecisions?.emisionMonetaria;
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, EMISSION_MIN, EMISSION_MAX) : 0;
}

/** Dinero emitido este mes: % de la recaudación tributaria. Entra al tesoro como ingreso no tributario. */
export function monetaryEmission(ministries: readonly MinistryLike[], taxRevenue: number): number {
  return (emissionPercent(ministries) / 100) * Math.max(0, taxRevenue);
}

/**
 * Tasa que pide la regla de Taylor: r* + inflación + peso × (inflación − meta), acotada al rango.
 * Con la inflación en la meta (3 %) da 4,5, la tasa sembrada.
 */
export function taylorRate(inflation: number): number {
  const target = BALANCE.CB_NEUTRAL_REAL_RATE + inflation
    + BALANCE.TAYLOR_INFLATION_WEIGHT * (inflation - BALANCE.INFLATION_TARGET);
  return clamp(target, RATE_MIN, RATE_MAX);
}

/**
 * Próxima tasa de un Banco Central autónomo: se mueve hacia la de Taylor como mucho
 * CB_MAX_RATE_STEP por mes (gradualismo) y en pasos de 0,5 como el slider.
 */
export function nextCentralBankRate(currentRate: number, inflation: number): number {
  const step = clamp(taylorRate(inflation) - currentRate, -BALANCE.CB_MAX_RATE_STEP, BALANCE.CB_MAX_RATE_STEP);
  return clamp(Math.round((currentRate + step) * 2) / 2, RATE_MIN, RATE_MAX);
}

/**
 * Aplica la política de un Banco Central autónomo al estado (después de las decisiones del jugador):
 * fija la tasa según Taylor y anula la emisión. Avisa si el jugador intentó cambiar alguna de las dos.
 * Muta las sub-decisiones de Economía. Sin Banco Central autónomo no hace nada.
 */
export function applyCentralBankPolicy(
  state: Pick<GameState, "ministries" | "organisms" | "inflation">,
  requested?: Record<string, number | boolean>,
): TurnNotification[] {
  const eco = economyMinistry(state.ministries);
  if (!eco || !isCentralBankAutonomous(state.organisms)) return [];
  const notifications: TurnNotification[] = [];
  const bank = centralBank(state.organisms)!;

  const before = policyRate(state.ministries);
  const rate = nextCentralBankRate(before, state.inflation);
  eco.subDecisions = { ...eco.subDecisions, tasaInteres: rate };
  if (requested && "tasaInteres" in requested && requested.tasaInteres !== rate) {
    notifications.push({
      type: "warning",
      title: "El Banco Central fija la tasa",
      description: `${bank.name} es autónomo y decide la tasa de interés: la dejó en ${rate.toFixed(1)}% (inflación ${state.inflation.toFixed(1)}%, meta ${BALANCE.INFLATION_TARGET}%).`,
    });
  } else if (rate !== before) {
    notifications.push({
      type: "info",
      title: "Decisión del Banco Central",
      description: `${bank.name} ${rate > before ? "subió" : "bajó"} la tasa de interés de ${before.toFixed(1)}% a ${rate.toFixed(1)}% (inflación ${state.inflation.toFixed(1)}%, meta ${BALANCE.INFLATION_TARGET}%).`,
    });
  }

  const requestedEmission = requested?.emisionMonetaria;
  if (emissionPercent(state.ministries) > 0 || (typeof requestedEmission === "number" && requestedEmission > 0)) {
    notifications.push({
      type: "warning",
      title: "Emisión rechazada",
      description: `${bank.name} es autónomo y se niega a financiar al gobierno emitiendo dinero.`,
    });
  }
  eco.subDecisions = { ...eco.subDecisions, emisionMonetaria: 0 };
  return notifications;
}

export interface InflationInputs {
  /** Recaudación tributaria del mes */
  taxRevenue: number;
  /** Gasto del mes */
  expenses: number;
  /** Dinero emitido este mes */
  emission: number;
}

export interface InflationBreakdown {
  credibility: number;
  /** Presiones en puntos anuales de equilibrio (antes de amplificar por falta de credibilidad) */
  deficit: number;
  emission: number;
  rate: number;
  subDecisions: number;
  /** Inflación a la que tiende la economía con estas políticas */
  equilibrium: number;
  /** Inflación del mes */
  inflation: number;
}

/**
 * Inflación anual del mes a partir de la del mes anterior (`state.inflation`).
 * - déficit% = (gasto − recaudación) / recaudación, sin contar la emisión (la emisión tiene su término).
 * - Con la meta como ancla y credibilidad c, el equilibrio es meta + presiones × (1 + A × (1 − c)) y
 *   cada mes se recorre INFLATION_ADJUST × c de la distancia: sin Banco Central bajar de 18 % a 3 %
 *   lleva años; con uno autónomo, meses.
 * Nunca negativa (no se modela deflación) ni mayor que 100.
 */
export function calculateInflation(state: GameState, inputs: InflationInputs): InflationBreakdown {
  const previous = Number.isFinite(state.inflation) ? state.inflation : BALANCE.INFLATION_TARGET;
  const credibility = monetaryCredibility(state.organisms ?? []);
  const revenue = Math.max(0, inputs.taxRevenue);
  const deficitPct = revenue > 0
    ? (Math.max(0, inputs.expenses - revenue) / revenue) * 100
    : inputs.expenses > 0 ? 100 : 0;
  const emissionPct = revenue > 0 ? (Math.max(0, inputs.emission) / revenue) * 100 : 0;

  const deficit = BALANCE.INFLATION_DEFICIT_FACTOR * deficitPct;
  const emission = BALANCE.INFLATION_EMISSION_FACTOR * emissionPct;
  const rate = -BALANCE.INFLATION_RATE_FACTOR * (policyRate(state.ministries ?? []) - NEUTRAL_RATE);
  const subDecisions = subDecisionIndicator(state, "inflation");

  const amplifier = 1 + BALANCE.INFLATION_CRED_AMPLIFIER * (1 - credibility);
  const equilibrium = Math.max(0, BALANCE.INFLATION_TARGET + (deficit + emission + rate + subDecisions) * amplifier);
  const inflation = clamp(previous + BALANCE.INFLATION_ADJUST * credibility * (equilibrium - previous), 0, 100);

  return { credibility, deficit, emission, rate, subDecisions, equilibrium, inflation };
}
