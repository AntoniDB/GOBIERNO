// ─── Funciones puras de indicadores sociales ──────────────────────────────────
// Cálculo de pobreza, desempleo, salud, seguridad alimentaria, crimen,
// educación, Gini e inflación simple.

import type { GameState, ActiveLawState } from "./types";
import { BALANCE } from "../balance";
import { calculateInflation, calculateIncome, calculateExpenses } from "./economy";

/**
 * Busca la eficiencia de un ministerio por su clave en el estado.
 * Si no existe, retorna 50 (valor neutro).
 */
function getMinistryEfficiency(state: GameState, key: string): number {
  const ministry = state.ministries.find((m) => m.key === key);
  return ministry?.efficiency ?? 50;
}

/**
 * Pobreza = BALANCE.POVERTY_SOCIAL_DEV_FACTOR * eficienciaDesarrolloSocial
 *         + BALANCE.POVERTY_UNEMPLOYMENT_FACTOR * desempleo
 *         + BALANCE.POVERTY_INFLATION_FACTOR * inflación
 *         + 25 (base).
 * El resultado se trunca a [0, 100].
 */
export function calculatePoverty(state: GameState): number {
  const socialDevEfficiency = getMinistryEfficiency(state, "desarrollo_social");
  const unemployment = calculateUnemployment(state);
  const inflation = calculateInflationSimple(state);

  const raw =
    BALANCE.POVERTY_SOCIAL_DEV_FACTOR * socialDevEfficiency +
    BALANCE.POVERTY_UNEMPLOYMENT_FACTOR * unemployment +
    BALANCE.POVERTY_INFLATION_FACTOR * inflation +
    25;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Desempleo = BALANCE.UNEMPLOYMENT_ECONOMY_FACTOR * eficienciaEconomía
 *           + BALANCE.UNEMPLOYMENT_BASE.
 * El resultado se trunca a [2, 50].
 */
export function calculateUnemployment(state: GameState): number {
  const economyEfficiency = getMinistryEfficiency(state, "economia");

  const raw =
    BALANCE.UNEMPLOYMENT_ECONOMY_FACTOR * economyEfficiency +
    BALANCE.UNEMPLOYMENT_BASE;

  return Math.max(2, Math.min(50, raw));
}

/**
 * Salud (tasa de enfermos) = BALANCE.SICK_HEALTH_FACTOR * eficienciaSalud
 *                          + BALANCE.SICK_BASE.
 * El resultado se trunca a [0, 50].
 */
export function calculateHealth(state: GameState): number {
  const healthEfficiency = getMinistryEfficiency(state, "salud");

  const raw =
    BALANCE.SICK_HEALTH_FACTOR * healthEfficiency + BALANCE.SICK_BASE;

  return Math.max(0, Math.min(50, raw));
}

/**
 * Seguridad alimentaria = BALANCE.FOOD_AGRICULTURE_FACTOR * eficienciaAgricultura
 *                        + BALANCE.FOOD_BASE.
 * El resultado se trunca a [0, 100].
 */
export function calculateFoodSecurity(state: GameState): number {
  const agricultureEfficiency = getMinistryEfficiency(state, "agricultura");

  const raw =
    BALANCE.FOOD_AGRICULTURE_FACTOR * agricultureEfficiency +
    BALANCE.FOOD_BASE;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Crimen = BALANCE.CRIME_SECURITY_FACTOR * eficienciaSeguridad
 *        + BALANCE.CRIME_POVERTY_FACTOR * pobreza
 *        + BALANCE.CRIME_UNEMPLOYMENT_FACTOR * desempleo
 *        + BALANCE.CRIME_BASE.
 * El resultado se trunca a [0, 100].
 */
export function calculateCrime(state: GameState): number {
  const securityEfficiency = getMinistryEfficiency(state, "seguridad");
  const poverty = calculatePoverty(state);
  const unemployment = calculateUnemployment(state);

  const raw =
    BALANCE.CRIME_SECURITY_FACTOR * securityEfficiency +
    BALANCE.CRIME_POVERTY_FACTOR * poverty +
    BALANCE.CRIME_UNEMPLOYMENT_FACTOR * unemployment +
    BALANCE.CRIME_BASE;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Educación = BALANCE.EDUCATION_EDU_FACTOR * eficienciaEducación
 *           + BALANCE.EDUCATION_BASE.
 * El resultado se trunca a [0, 100].
 */
export function calculateEducation(state: GameState): number {
  const educationEfficiency = getMinistryEfficiency(state, "educacion");

  const raw =
    BALANCE.EDUCATION_EDU_FACTOR * educationEfficiency + BALANCE.EDUCATION_BASE;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Gini = BALANCE.GINI_BASE ajustado por leyes activas.
 * - Impuesto progresivo (ley con key que contenga "progresivo"): -2 puntos.
 * - Liberalización económica (ley con key que contenga "liberalizacion"): +3 puntos.
 * El resultado se trunca a [20, 70].
 */
export function calculateGini(
  state: GameState,
  activeLaws: ActiveLawState[]
): number {
  let gini = BALANCE.GINI_BASE;

  for (const law of activeLaws) {
    const key = law.lawKey.toLowerCase();
    if (key.includes("progresivo")) {
      gini += BALANCE.GINI_PROGRESSIVE_TAX_FACTOR;
    }
    if (key.includes("liberalizacion")) {
      gini += BALANCE.GINI_LIBERALIZATION_FACTOR;
    }
  }

  return Math.max(20, Math.min(70, gini));
}

/**
 * Inflación simple: calcula ingresos y gastos del estado,
 * luego reutiliza calculateInflation de economy.
 */
export function calculateInflationSimple(state: GameState): number {
  const income = calculateIncome(state);
  const expenses = calculateExpenses(state);
  return calculateInflation(state, expenses, income);
}
