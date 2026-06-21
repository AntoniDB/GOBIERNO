// ─── Cálculo de aprobación por clase social ─────────────────────────────────
// Funciones puras: reciben objetos planos, devuelven objetos planos.
// Deterministas dado el mismo estado y eventos.

import type {
  GameState,
  SocialClassState,
  EventState,
} from "./types";
import { BALANCE } from "../balance";
import { calculatePoverty, calculateInflationSimple } from "./indicators";

/**
 * Determina si un tipo de evento es considerado negativo para la aprobación.
 */
function isNegativeEventType(eventType: string): boolean {
  const negativeTypes = [
    "EPIDEMIC",
    "SCANDAL",
    "PROTEST",
    "CRIME_SURGE",
    "COUP_ATTEMPT",
    "DISASTER",
    "ECONOMIC_CRISIS",
  ];
  return negativeTypes.includes(eventType);
}

/**
 * Calcula la aprobación de una clase social específica.
 *
 * @param socialClass - La clase social a evaluar
 * @param state - Estado completo del juego
 * @param eventsThisMonth - Eventos ocurridos este mes
 * @returns Aprobación en rango [0, 100]
 */
export function calculateApprovalByClass(
  socialClass: SocialClassState,
  state: GameState,
  eventsThisMonth: EventState[]
): number {
  let approval = BALANCE.APPROVAL_BASE;

  // ── Modificadores por leyes activas ─────────────────────────────────────
  // Cada ley puede definir effectsJson.approval[claseKey] como modificador
  for (const law of state.activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    if (effects.approval && typeof effects.approval === "object") {
      const approvalEffects = effects.approval as Record<string, number>;
      if (typeof approvalEffects[socialClass.key] === "number") {
        approval += approvalEffects[socialClass.key];
      }
    }
  }

  // ── Modificadores por eventos del mes ───────────────────────────────────
  // Los eventos negativos reducen aprobación según severidad;
  // el impacto se pondera por BALANCE.APPROVAL_EVENT_WEIGHT
  for (const event of eventsThisMonth) {
    const isNegative = isNegativeEventType(event.type);
    const impact =
      event.severity * BALANCE.APPROVAL_EVENT_WEIGHT * 10;
    if (isNegative) {
      approval -= impact;
    } else {
      approval += impact * 0.5; // eventos positivos tienen la mitad de impacto
    }
  }

  // ── Modificadores por indicadores sociales ──────────────────────────────
  const povertyRate = calculatePoverty(state);
  const inflation = calculateInflationSimple(state);

  // Alta pobreza penaliza especialmente a clases bajas
  if (
    povertyRate > 30 &&
    (socialClass.key === "POVERTY" || socialClass.key === "EXTREME_POVERTY")
  ) {
    // Penalización proporcional al exceso de pobreza sobre 30%
    approval -= (povertyRate - 30) * BALANCE.APPROVAL_INDICATOR_WEIGHT;
  }

  // Inflación alta afecta a todas las clases
  if (inflation > BALANCE.INFLATION_CRISIS_THRESHOLD) {
    approval -= (inflation - BALANCE.INFLATION_CRISIS_THRESHOLD) * BALANCE.APPROVAL_INDICATOR_WEIGHT;
  }

  // ── Corrupción reduce aprobación en todas las clases ────────────────────
  // Estimamos corrupción global como promedio de corrupción de funcionarios
  const avgCorruption =
    state.officials.length > 0
      ? state.officials.reduce((s, o) => s + o.corruption, 0) /
        state.officials.length
      : 0;
  approval -= avgCorruption * BALANCE.APPROVAL_CORRUPTION_WEIGHT;

  // ── Clamp final a [0, 100] ──────────────────────────────────────────────
  return Math.max(0, Math.min(100, Math.round(approval * 10) / 10));
}

/**
 * Calcula las demandas dinámicas de una clase social según el estado actual.
 *
 * Cada clase tiene demandas que evolucionan con las condiciones del país.
 * Máximo 4 demandas por clase, priorizando las más urgentes.
 *
 * @param socialClass - La clase social a evaluar
 * @param state - Estado completo del juego
 * @returns Lista de demandas como strings en español
 */
export function calculateClassDemands(
  socialClass: SocialClassState,
  state: GameState
): string[] {
  const demands: string[] = [];
  const crimeRate = calculatePoverty(state); // usamos indicadores relevantes
  const inflation = calculateInflationSimple(state);
  const avgCorruption =
    state.officials.length > 0
      ? state.officials.reduce((s, o) => s + o.corruption, 0) /
        state.officials.length
      : 0;

  switch (socialClass.key) {
    case "EXTREME_POVERTY":
      demands.push("alimentación", "empleo");
      if (socialClass.healthAccess < 30) demands.push("salud");
      if (socialClass.educationLevel < 25) demands.push("educación");
      if (crimeRate > 40) demands.push("seguridad");
      break;

    case "POVERTY":
      demands.push("empleo");
      if (crimeRate > 30) demands.push("seguridad");
      if (inflation > 10) demands.push("estabilidad económica");
      if (socialClass.healthAccess < 50) demands.push("salud");
      if (socialClass.educationLevel < 40) demands.push("educación");
      break;

    case "MIDDLE":
      demands.push("estabilidad");
      if (inflation > 8) demands.push("control de inflación");
      if (avgCorruption > 40) demands.push("transparencia");
      demands.push("educación");
      if (crimeRate > 20) demands.push("seguridad");
      break;

    case "ELITE":
      demands.push("libertad económica", "baja tributación");
      if (avgCorruption > 30) demands.push("seguridad jurídica");
      demands.push("estabilidad política");
      break;

    default:
      demands.push("estabilidad");
      break;
  }

  return demands.slice(0, 4);
}

/**
 * Calcula la aprobación general del gobierno como promedio ponderado
 * de la aprobación de cada clase social por su porcentaje poblacional.
 *
 * @param state - Estado completo del juego
 * @param eventsThisMonth - Eventos ocurridos este mes
 * @returns Aprobación general en rango [0, 100]
 */
export function calculateGeneralApproval(
  state: GameState,
  eventsThisMonth: EventState[]
): number {
  let weightedSum = 0;
  let totalPercent = 0;

  for (const sc of state.socialClasses) {
    const approval = calculateApprovalByClass(sc, state, eventsThisMonth);
    weightedSum += approval * sc.populationPercent;
    totalPercent += sc.populationPercent;
  }

  if (totalPercent === 0) return BALANCE.APPROVAL_BASE;

  return Math.round((weightedSum / totalPercent) * 10) / 10;
}
