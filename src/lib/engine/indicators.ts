// ─── Funciones puras de indicadores sociales ──────────────────────────────────
// Cálculo de pobreza, desempleo, salud, seguridad alimentaria, crimen,
// educación, Gini, inflación simple y movilidad social.
// 
// El impacto real de cada ministerio en indicadores se calcula como:
//   impact = eficiencia × budgetImpactFactor
//   budgetImpactFactor = 1 − exp(−budgetPercent / 12)
// La eficiencia (0-100) representa calidad pura de gestion.
// El budgetImpactFactor (0-1) escala el impacto segun presupuesto asignado.

import type { GameState, ActiveLawState, RegionState } from "./types";
import { BALANCE } from "../balance";
import { calculateInflation, calculateIncome, calculateExpenses, calculateGDP } from "./economy";
import { calculateDiseasePrevalence, calculateSickRateFromDiseases, calculateDiseaseMortality } from "./diseases";
import { calculateHospitalOperationalFactor } from "./medical-professionals";
import { isMedicationShortage } from "./trade";
import type { DiseaseState } from "./diseases";

/**
 * Busca el impacto efectivo de un ministerio (eficiencia × factor de presupuesto).
 * Soporta tanto claves en ingles (seed: "AGRICULTURE", "HEALTH"...)
 * como en espanol (tests: "agricultura", "salud"...).
 * Si no existe, retorna 25 (valor neutro correspondiente a eff=50 × factor típico).
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

function budgetImpactFactor(budgetPercent: number): number {
  return 1 - Math.exp(-budgetPercent / 12);
}

export function getMinistryImpact(state: GameState, lookupKey: string): number {
  const aliases = MINISTRY_KEY_ALIASES[lookupKey] ?? [lookupKey];
  const ministry = state.ministries.find((m) => aliases.includes(m.key));
  if (!ministry) return 25;
  return ministry.efficiency * budgetImpactFactor(ministry.budgetPercent);
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
 * Pobreza = BALANCE.POVERTY_SOCIAL_DEV_FACTOR * impactoDesarrolloSocial
 *         + BALANCE.POVERTY_UNEMPLOYMENT_FACTOR * desempleo
 *         + BALANCE.POVERTY_INFLATION_FACTOR * inflacion
 *         + BALANCE.POVERTY_BASE.
 * El resultado se trunca a [0, 100].
 */
export function calculatePoverty(state: GameState): number {
  const socialDevImpact = getMinistryImpact(state, "desarrollo_social");
  const unemployment = calculateUnemployment(state);
  const inflation = calculateInflationSimple(state);

  const raw =
    BALANCE.POVERTY_SOCIAL_DEV_FACTOR * socialDevImpact +
    BALANCE.POVERTY_UNEMPLOYMENT_FACTOR * unemployment +
    BALANCE.POVERTY_INFLATION_FACTOR * inflation +
    BALANCE.POVERTY_BASE;

  return Math.max(0, Math.min(100, raw + sumLawEffects(state, "povertyRate")));
}

/**
 * Desempleo = BALANCE.UNEMPLOYMENT_ECONOMY_FACTOR * eficienciaEconomía
 *           + BALANCE.UNEMPLOYMENT_BASE.
 * El resultado se trunca a [2, 50].
 */
export function calculateUnemployment(state: GameState): number {
  const economyEfficiency = getMinistryImpact(state, "economia");

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
  const healthEfficiency = getMinistryImpact(state, "salud");

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
  const agricultureEfficiency = getMinistryImpact(state, "agricultura");

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
  const securityEfficiency = getMinistryImpact(state, "seguridad");
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
  const educationEfficiency = getMinistryImpact(state, "educacion");

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

// ─── Esperanza de Vida ────────────────────────────────────────────────────────
//
// Formula basada en indicadores sociales existentes:
//   lifeExpectancy = LE_BASE
//     − LE_SICK_FACTOR × sickRate
//     − LE_CRIME_FACTOR × crimeRate
//     − LE_POVERTY_FACTOR × povertyRate
//     + LE_FOOD_FACTOR × foodSecurity
//     + LE_GDP_FACTOR × (gdpPerCapita / 1000)
//
// Calibrada con 4 escenarios (ver tabla de calibracion en el commit).
// Clamp final [48, 85].
//
// TODO Salud-3: extender con mortalidad ponderada por enfermedad.
// Cuando el catalogo de enfermedades este implementado, reemplazar
// sickRate por Σ(disease.prevalence × disease.mortalityRate) y
// usar pesos especificos por tipo de enfermedad.

/**
 * Calcula la esperanza de vida nacional a partir de los indicadores
 * sociales del estado actual.
 *
 * @param state - Estado completo del juego con indicadores ya calculados
 * @returns Esperanza de vida en anios, en rango [LE_CLAMP_MIN, LE_CLAMP_MAX]
 */
export function calculateLifeExpectancy(
  state: GameState,
  gdpPerCapita?: number
): number {
  const sickRate = state.sickRate;
  const crimeRate = state.crimeRate;
  const povertyRate = state.povertyRate;
  const foodSecurity = state.foodSecurity;

  // gdpPerCapita = PIB anual / población
  const gdpAnnual = state.gdp; // PIB anual (ya calculado en paso 8)
  const perCapita = gdpPerCapita ?? (state.population > 0 ? gdpAnnual / state.population : 3000);

  // Mortalidad por saturacion hospitalaria (regional)
  const saturationMortality = calculateNationalSaturationMortality(state);

  // Mortalidad por enfermedades (si hay catalogo activo)
  const diseaseMortality = state.diseaseMortality as number | undefined;

  const raw =
    BALANCE.LE_BASE
    - BALANCE.LE_SICK_FACTOR * sickRate
    - BALANCE.LE_CRIME_FACTOR * crimeRate
    - BALANCE.LE_POVERTY_FACTOR * povertyRate
    + BALANCE.LE_FOOD_FACTOR * foodSecurity
    + BALANCE.LE_GDP_FACTOR * (perCapita / 1000)
    - BALANCE.LE_SATURATION_FACTOR * saturationMortality
    - (diseaseMortality ? BALANCE.LE_DISEASE_FACTOR * diseaseMortality * 100 : 0);

  return Math.max(
    BALANCE.LE_CLAMP_MIN,
    Math.min(BALANCE.LE_CLAMP_MAX, Math.round(raw * 10) / 10)
  );
}

// ─── Salud regional ──────────────────────────────────────────────────────────
// Calculos de cobertura, saturacion y sickRate basados en regiones.

/**
 * Calcula el sickRate nacional como promedio ponderado por region.
 * Cada region aporta su propio sickRate afectado por la cobertura sanitaria.
 *
 * Si no hay regiones definidas, usa el calculo global con calculateHealth.
 */
export function calculateHealthRegional(state: GameState): number {
  // Si hay enfermedades en el estado, usar Π-fórmula.
  // Las diseasePrevalences ya estan pobladas (inicializadas en el seed o
  // modificadas por los programas en el paso 4c). Solo recalculamos desde
  // prevalenceBase si estan vacias (primera vez en una partida sin seed).
  if (state.diseases && state.diseases.length > 0) {
    let prevalences = state.diseasePrevalences;
    if (!prevalences || prevalences.length === 0) {
      prevalences = calculateDiseasePrevalence(
        state,
        state.diseases as unknown as DiseaseState[]
      );
    }
    const sickFromDiseases = calculateSickRateFromDiseases(prevalences);
    if (sickFromDiseases !== null) {
      state.diseasePrevalences = prevalences;
      const shortage = isMedicationShortage(state);
      const shortageMultipliers = shortage
        ? {
            CHRONIC: BALANCE.TRADE_SHORTAGE_MORTALITY_MULTIPLIER_CHRONIC,
            TRANSMISSIBLE: BALANCE.TRADE_SHORTAGE_MORTALITY_MULTIPLIER_TRANSMISSIBLE,
            MENTAL_HEALTH: BALANCE.TRADE_SHORTAGE_MORTALITY_MULTIPLIER_MENTAL,
          }
        : undefined;
      state.diseaseMortality = calculateDiseaseMortality(
        prevalences,
        state.diseases as unknown as DiseaseState[],
        shortageMultipliers,
      );
      return sickFromDiseases;
    }
  }

  // Fallback: calculo regional (sin enfermedades)
  const regions = state.regions ?? [];
  if (regions.length === 0) return calculateHealth(state);

  const healthMinistry = state.ministries.find((m) => m.key === "HEALTH" || m.key === "salud");
  const healthEfficiency = healthMinistry?.efficiency ?? 50;

  // Factor operativo de hospitales (Capa E): si hay déficit de médicos,
  // la cobertura efectiva cae. → calcularResourceEfficiency del ministerio HEALTH.
  // La efficiency de gestion del ministerio queda intacta; solo la cobertura
  // hospitalaria operativa se ve afectada por el stock de medical_professionals.
  const operationalFactor = calculateHospitalOperationalFactor(state);

  let weightedSickRate = 0;
  let totalWeight = 0;

  for (const region of regions) {
    const weight = region.populationPercent / 100;
    totalWeight += weight;

    const budgetSplit = healthMinistry?.healthBudgetSplit ?? { primary: 50, secondary: 30, tertiary: 20 };

    const primaryCoverage = calculateRegionalCoverage(region, "primary", budgetSplit.primary ?? 50, healthEfficiency, operationalFactor);
    const secondaryCoverage = calculateRegionalCoverage(region, "secondary", budgetSplit.secondary ?? 30, healthEfficiency, operationalFactor);
    const tertiaryCoverage = calculateRegionalCoverage(region, "tertiary", budgetSplit.tertiary ?? 20, healthEfficiency, operationalFactor);

    const compositeCoverage =
      primaryCoverage * BALANCE.HEALTH_PRIMARY_WEIGHT +
      secondaryCoverage * BALANCE.HEALTH_SECONDARY_WEIGHT +
      tertiaryCoverage * BALANCE.HEALTH_TERTIARY_WEIGHT;

    const regionSickRate = calculateRegionSickRate(region, compositeCoverage);
    weightedSickRate += regionSickRate * weight;
  }

  return Math.max(0, Math.min(100, weightedSickRate));
}

/**
 * Calcula la cobertura efectiva de un nivel de atencion en una region.
 * coverage = min(1.0, (beds * bedCoveragePerPerson) * (1 - accessModifier) * efficiencyBonus) * operationalFactor
 * La eficiencia del ministerio escala la cobertura (mejor gestion = mejor uso de recursos).
 * El operationalFactor (Capa E) reduce la cobertura si hay déficit de médicos;
 * es distinto de la efficiency de gestión del ministerio.
 */
function calculateRegionalCoverage(
  region: RegionState,
  level: "primary" | "secondary" | "tertiary",
  budgetShare: number,
  efficiency: number,
  operationalFactor: number = 1.0,
): number {
  const hc = region.healthCoverage?.[level];
  if (!hc) return 0;

  const beds = hc.beds ?? 0;
  const accessPenalty = 1 - (region.accessModifier ?? 0.5);
  const efficiencyBonus = 0.5 + (efficiency / 100) * 0.5; // [0.5, 1.0]
  const budgetFactor = budgetShare / 100;

  const raw = beds * BALANCE.HEALTH_BED_COVERAGE_PER_PERSON * accessPenalty * efficiencyBonus * budgetFactor * operationalFactor;
  return Math.min(1.0, raw);
}

/**
 * Calcula el sickRate de una region especifica.
 * sickRate base = povertyRate * povertyModifier + SICK_BASE.
 * Reducido por la cobertura compuesta.
 */
function calculateRegionSickRate(region: RegionState, coverage: number): number {
  const rawSickRate =
    (region.povertyRate ?? 25) * (region.povertyModifier ?? 1.0) * 0.35 + BALANCE.SICK_BASE;
  const reduction = coverage * 20; // cobertura perfecta reduce ~20 puntos de sickRate
  return Math.max(2, rawSickRate - reduction);
}

/**
 * Calcula la mortalidad extra por saturacion hospitalaria a nivel nacional.
 * Para cada region: si sickPopulation > totalBeds, el multiplicador sube.
 * Devuelve un valor promedio ponderado por poblacion.
 */
export function calculateNationalSaturationMortality(state: GameState): number {
  const regions = state.regions ?? [];
  if (regions.length === 0) return 0;

  const sickRate = state.sickRate;
  let totalMortality = 0;

  for (const region of regions) {
    const weight = region.populationPercent / 100;

    const regionalPopulation = state.population * weight;
    const sickPopulation = Math.round(regionalPopulation * (sickRate / 100));
    // Solo ~8% de los enfermos necesitan hospitalizacion (camas)
    const sickNeedingBeds = Math.round(sickPopulation * 0.08);

    let totalBeds = 0;
    const levels: Array<"primary" | "secondary" | "tertiary"> = ["primary", "secondary", "tertiary"];
    for (const level of levels) {
      totalBeds += region.healthCoverage?.[level]?.beds ?? 0;
    }

    if (totalBeds > 0 && sickNeedingBeds > totalBeds) {
      const saturationRatio = (sickNeedingBeds - totalBeds) / totalBeds;
      // mortalityMultiplier = 1 + min(2.0, saturation/3), cap final x3.0
      const limited = Math.min(2.0, saturationRatio / 3);
      const multiplier = 1 + limited;
      totalMortality += (multiplier - 1) * weight;
    }
    // Si camas >= enfermos: no hay mortalidad extra
  }

  return totalMortality;
}

