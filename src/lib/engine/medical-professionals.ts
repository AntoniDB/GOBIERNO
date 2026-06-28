// ─── Profesionales medicos: dependencia Educación → Salud (Salud-3A Capa E) ──
// Activacion por primera vez del sistema de Cross-Ministry Dependencies.
//
// Educacion produce el recurso `medical_professionals` mensualmente:
//   output = (edu.budget/100) × (edu.efficiency/100) × population × FACTOR_CONVERSION
//   Calibrado: pais promedio (16%/60%/red 3.800 beds) → demanda 760 mdcs → +20% sup.
//
// Salud consume medical_professionals proporcionalmente a la capacidad hospitalaria
// total nacional (mas camas → mas medicos consumidos):
//   demanda = Σ regional beds × MEDICS_PER_BED
//
// Reglas (Salud-1): stock con floor 0, bonus por excedente decreciente (curva
// 1 − exp(−excedente/X)), decaimiento ~1.5% mensual sobre el excedente.
//
// Cuando hay déficit de médicos: la coverage operativa de los hospitales se
// reduce proporcionalmente al déficit. NO se reduce la efficiency de gestion
// del ministerio HEALTH — eso es distinto y sigue calculandose normalmente.
// La cobertura efectiva de camas se escala por el operationalFactor.

import type { GameState } from "./types";
import { BALANCE } from "../balance";

/**
 * Calcula la produccion mensual de medical_professionals desde Educacion.
 *
 * Formula provisional (a refinar cuando se profundice Educacion):
 *   output_mensual = (edu.budget/100) × (edu.efficiency/100) × population × FACTOR
 *
 * Calibrado (FACTOR = 0.00095) para que pais promedio 10M con 16%/60%
 * produzca 912 mdcs/mes, vs demanda 760 (red 3.800 beds) → +20% sup.
 */
export function calculateMedicalProduction(state: GameState): number {
  const edu = state.ministries.find(
    (m) => m.key === "EDUCATION" || m.key === "educacion",
  );
  if (!edu) return 0;

  const factor = BALANCE.MEDICAL_PROFESSIONALS_FACTOR;
  return (
    (edu.budgetPercent / 100) *
    (edu.efficiency / 100) *
    state.population *
    factor
  );
}

/**
 * Calcula la demanda mensual de medical_professionals desde el Ministerio
 * de Salud, proporcional a la capacidad hospitalaria total nacional.
 *   demanda = Σ region.beds(level) × MEDICS_PER_BED
 *
 * Mas camas → mas medicos requeridos. 1 medico por cada 5 camas.
 */
export function calculateMedicalDemand(state: GameState): number {
  const regions = state.regions ?? [];
  let totalBeds = 0;
  const levels: Array<"primary" | "secondary" | "tertiary"> = [
    "primary", "secondary", "tertiary",
  ];
  for (const region of regions) {
    for (const level of levels) {
      totalBeds += region.healthCoverage?.[level]?.beds ?? 0;
    }
  }
  return totalBeds * BALANCE.MEDICS_PER_BED;
}

/**
 * Calcula el factor operativo de los hospitales en [MEDICS_OPERATIONAL_FLOOR, 1.2].
 *
 *  - Si stock >= demanda: cobertura operativa al 100% (factor 1.0) + bonus
 *    decreciente por superavit (curva 1 − exp(−superavit/20), cap MAX_BONUS).
 *    El bonus solo sube la cobertura operativa por encima de 1.0 en situaciones
 *    de abundancia (limite ~1.2×). No afecta la efficiency de gestion.
 *  - Si stock < demanda: cobertura operativa = stock/demanda. Penaliza la
 *    cobertura regional efectiva sin tocar la efficiency del ministerio.
 *  - Floor: nunca llega a 0 — los hospitales siguen funcionando parcialmente.
 *
 * El factory default (sin registro de stock) es factor 1.0 (plena capacidad).
 */
export function calculateHospitalOperationalFactor(state: GameState): number {
  const demand = calculateMedicalDemand(state);
  if (demand <= 0) return 1.0; // sin red hospitalaria → no consume medicos

  const stock = state.resourceStocks.find(
    (s) => s.resourceType === "medical_professionals",
  )?.quantity ?? 0;

  // Deficit: proporcion stock/demanda, con floor MEDICS_OPERATIONAL_FLOOR.
  if (stock < demand) {
    const ratio = stock / demand;
    return Math.max(BALANCE.MEDICS_OPERATIONAL_FLOOR, ratio);
  }

  // Superavit: bonus decreciente (1 − exp(−surplus/20))
  const surplus = stock - demand;
  const bonus = (1 - Math.exp(-surplus / 20)) * BALANCE.MEDICS_SURPLUS_BONUS_CAP;
  return 1.0 + Math.min(0.2, bonus);
}