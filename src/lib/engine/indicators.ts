// ─── Funciones puras de indicadores sociales ──────────────────────────────────
// Cálculo de pobreza, desempleo, salud, seguridad alimentaria, crimen,
// educación, Gini, inflación simple y movilidad social.

import type { GameState, ActiveLawState } from "./types";
import { BALANCE } from "../balance";
import { calculateInflation, calculateIncome, calculateExpenses, calculateGDP } from "./economy";

/**
 * Busca la eficiencia de un ministerio por su clave en el estado.
 * Soporta tanto claves en inglés (seed: "AGRICULTURE", "HEALTH"...)
 * como en español (tests: "agricultura", "salud"...).
 * Si no existe, retorna 50 (valor neutro).
 */
const MINISTRY_KEY_ALIASES: Record<string, string[]> = {
  desarrollo_social: ["SOCIAL_DEVELOPMENT", "desarrollo_social"],
  economia: ["ECONOMY", "economia"],
  salud: ["HEALTH", "salud"],
  agricultura: ["AGRICULTURE", "agricultura"],
  seguridad: ["SECURITY", "seguridad"],
  educacion: ["EDUCATION", "educacion"],
  defensa: ["DEFENSE", "defensa"],
  justicia: ["JUSTICE", "justicia"],
};

function getMinistryEfficiency(state: GameState, lookupKey: string): number {
  const aliases = MINISTRY_KEY_ALIASES[lookupKey] ?? [lookupKey];
  const ministry = state.ministries.find((m) => aliases.includes(m.key));
  return ministry?.efficiency ?? 50;
}

/**
 * Suma los modificadores de una key en effectsJson de todas las leyes activas.
 * Ej: effectsJson.povertyRate: -5 en ley A + effectsJson.povertyRate: -3 en ley B = -8
 */
function sumLawEffects(state: GameState, key: string): number {
  let total = 0;
  for (const law of state.activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    const val = effects[key];
    if (typeof val === "number") total += val;
  }
  return total;
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

  return Math.max(0, Math.min(100, raw + sumLawEffects(state, "povertyRate")));
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

  return Math.max(2, Math.min(50, raw + sumLawEffects(state, "unemploymentRate")));
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

  return Math.max(0, Math.min(50, raw + sumLawEffects(state, "sickRate")));
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

  return Math.max(0, Math.min(100, raw + sumLawEffects(state, "foodSecurity")));
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

  return Math.max(0, Math.min(100, raw + sumLawEffects(state, "crimeRate")));
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

  return Math.max(0, Math.min(100, raw + sumLawEffects(state, "educationLevel")));
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

  gini += sumLawEffects(state, "gini");

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

/**
 * Calcula la movilidad social: redistribuye porcentajes poblacionales
 * entre las 4 clases sociales según educación y crecimiento económico.
 *
 * - Educación alta (>50): mueve población de clases bajas a medias.
 * - Crecimiento del PIB: acelera la movilidad ascendente.
 * - Los porcentajes se renomarlizan para sumar 100%.
 *
 * @param state - Estado completo del juego
 * @returns Mapa de claseKey → nuevo populationPercent
 */
export function calculateSocialMobility(
  state: GameState
): Record<string, number> {
  const educationLevel = calculateEducation(state);
  const currentGDP = calculateGDP(state);

  // Estimar crecimiento mensual del PIB comparando con snapshot anterior
  // (aproximación: usar educationLevel como proxy de productividad)
  const gdpFactor =
    (currentGDP / Math.max(1, currentGDP * 0.99) - 1) *
    BALANCE.SOCIAL_MOBILITY_GDP_FACTOR * 100;

  // Factor de educación: positivo si educación > 50 (base neutra)
  const educationFactor =
    (educationLevel - 50) * BALANCE.SOCIAL_MOBILITY_EDUCATION_FACTOR;

  // Movilidad neta (positiva = ascenso social)
  const mobilityRate = (educationFactor + gdpFactor) / 100;

  // Calcular nuevos porcentajes aplicando movilidad
  const newPercents: Record<string, number> = {};
  const classOrder = ["EXTREME_POVERTY", "POVERTY", "MIDDLE", "ELITE"];

  for (const sc of state.socialClasses) {
    newPercents[sc.key] = sc.populationPercent;
  }

  if (mobilityRate > 0) {
    // Ascenso: mover de EXTREME_POVERTY → POVERTY, POVERTY → MIDDLE, MIDDLE → ELITE
    const transfer = Math.min(mobilityRate * 5, newPercents["EXTREME_POVERTY"] ?? 0);
    if (newPercents["EXTREME_POVERTY"] !== undefined && newPercents["POVERTY"] !== undefined) {
      newPercents["EXTREME_POVERTY"] -= transfer;
      newPercents["POVERTY"] += transfer;
    }

    const transfer2 = Math.min(mobilityRate * 3, newPercents["POVERTY"] ?? 0);
    if (newPercents["POVERTY"] !== undefined && newPercents["MIDDLE"] !== undefined) {
      newPercents["POVERTY"] -= transfer2;
      newPercents["MIDDLE"] += transfer2;
    }

    const transfer3 = Math.min(mobilityRate * 1.5, newPercents["MIDDLE"] ?? 0);
    if (newPercents["MIDDLE"] !== undefined && newPercents["ELITE"] !== undefined) {
      newPercents["MIDDLE"] -= transfer3;
      newPercents["ELITE"] += transfer3;
    }
  } else if (mobilityRate < 0) {
    // Descenso: mover en dirección opuesta
    const rate = Math.abs(mobilityRate);
    const transfer3 = Math.min(rate * 1.5, newPercents["ELITE"] ?? 0);
    if (newPercents["ELITE"] !== undefined && newPercents["MIDDLE"] !== undefined) {
      newPercents["ELITE"] -= transfer3;
      newPercents["MIDDLE"] += transfer3;
    }

    const transfer2 = Math.min(rate * 3, newPercents["MIDDLE"] ?? 0);
    if (newPercents["MIDDLE"] !== undefined && newPercents["POVERTY"] !== undefined) {
      newPercents["MIDDLE"] -= transfer2;
      newPercents["POVERTY"] += transfer2;
    }

    const transfer = Math.min(rate * 5, newPercents["POVERTY"] ?? 0);
    if (newPercents["POVERTY"] !== undefined && newPercents["EXTREME_POVERTY"] !== undefined) {
      newPercents["POVERTY"] -= transfer;
      newPercents["EXTREME_POVERTY"] += transfer;
    }
  }

  // Clamp mínimo 3% y máximo 70% para cada clase
  for (const key of classOrder) {
    if (newPercents[key] !== undefined) {
      newPercents[key] = Math.max(3, Math.min(70, newPercents[key]));
    }
  }

  // Renormalizar para que sumen 100%
  const total = Object.values(newPercents).reduce((s, v) => s + v, 0);
  if (total > 0 && total !== 100) {
    const factor = 100 / total;
    for (const key of classOrder) {
      if (newPercents[key] !== undefined) {
        newPercents[key] = Math.round(newPercents[key] * factor * 10) / 10;
      }
    }
  }

  return newPercents;
}
