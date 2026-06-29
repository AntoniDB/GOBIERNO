// ─── Catalogo de enfermedades ────────────────────────────────────────────────
// Calculo de prevalencia, sickRate compuesto (Π), y mortalidad por enfermedad.
//
// sickRate = 1 − Π(1 − prevalence_i)  — probabilidad de union (display)
// diseaseMortality = Σ(prevalence_i × mortalityRate_i)  — aditiva (motor)
//
// Cada enfermedad responde al sistema sanitario via preventionSensitivity.
// Las cronicas afectan mas a MIDDLE/ELITE, transmisibles a POVERTY/EXTREME_POVERTY.

import type { GameState } from "./types";
import { BALANCE } from "../balance";

export interface DiseaseState {
  id: string;
  name: string;
  category: "TRANSMISSIBLE" | "CHRONIC" | "MENTAL_HEALTH";
  contagionRate: number;
  mortalityRate: number;
  prevalence: number;
  prevalenceBase: number;
  hasVaccine: boolean;
  preventionSensitivity: number;
  monthlyCostPerPatient: number;
  classAffinity: Record<string, number>;
}

export interface DiseasePrevalenceState {
  id: string;
  diseaseId: string;
  currentPrevalence: number;
}

/**
 * Calcula la prevalencia actual de cada enfermedad en funcion de la
 * cobertura sanitaria del pais. Cada enfermedad responde segun su
 * preventionSensitivity.
 *
 * Si no hay datos de enfermedades en el estado, retorna un array vacio
 * y el sistema usa calculateHealth/calculateHealthRegional como fallback.
 *
 * @param state - Estado completo del juego
 * @returns Array de prevalencias actualizadas por enfermedad
 */
export function calculateDiseasePrevalence(
  state: GameState,
  diseases: DiseaseState[]
): DiseasePrevalenceState[] {
  if (diseases.length === 0) return [];

  const healthMinistry = state.ministries.find(
    (m) => m.key === "HEALTH" || m.key === "salud"
  );
  const healthEfficiency = healthMinistry?.efficiency ?? 50;
  const coverageBonus = healthEfficiency / BALANCE.DISEASE_COVERAGE_MAX;

  return diseases.map((disease) => {
    // La prevencion reduce la prevalencia base segun la sensibilidad de la enf.
    const preventionEffect = coverageBonus * disease.preventionSensitivity;

    // Transmisibles: la contagionRate puede hacer que suba si no hay control
    const contagionBonus = disease.category === "TRANSMISSIBLE"
      ? disease.contagionRate * (1 - coverageBonus) * 5
      : 0;

    const rawPrevalence = disease.prevalenceBase * (1 - preventionEffect) + contagionBonus;

    return {
      id: `prev-${disease.id}`,
      diseaseId: disease.id,
      currentPrevalence: Math.max(0, Math.min(100, Math.round(rawPrevalence * 100) / 100)),
    };
  });
}

/**
 * Calcula el sickRate nacional como la probabilidad de que una persona
 * tenga al menos una enfermedad (Π-fórmula).
 *
 * sickRate = 1 − Π(1 − prevalence_i)
 *
 * Si no hay enfermedades, usa el fallback regional o global.
 */
export function calculateSickRateFromDiseases(prevalences: DiseasePrevalenceState[]): number | null {
  if (prevalences.length === 0) return null;

  let probHealthy = 1.0;
  for (const p of prevalences) {
    probHealthy *= 1 - p.currentPrevalence / 100;
  }

  return Math.max(0, Math.min(100, (1 - probHealthy) * 100));
}

/**
 * Calcula la tasa de mortalidad atribuible a enfermedades.
 * Aditiva: cada enfermedad contribuye independientemente a la mortalidad.
 *
 * diseaseMortality = Σ(currentPrevalence × mortalityRate × shortageMultiplier)
 *
 * shortageMultipliers: cuando hay escasez de medicamentos (cobertura <50%),
 * cada categoria de enfermedad multiplica su mortalidad por el factor definido
 * en balance.ts (TRADE_SHORTAGE_MORTALITY_MULTIPLIER_*).
 *
 * Esta tasa se multiplica por LE_DISEASE_FACTOR para obtener el impacto en LE.
 */
export function calculateDiseaseMortality(
  prevalences: DiseasePrevalenceState[],
  diseases: DiseaseState[],
  shortageMultipliers?: Partial<Record<"TRANSMISSIBLE" | "CHRONIC" | "MENTAL_HEALTH", number>>,
): number {
  if (prevalences.length === 0 || diseases.length === 0) return 0;

  const diseaseMap = new Map(diseases.map((d) => [d.id, d]));

  let totalMortality = 0;
  for (const p of prevalences) {
    const disease = diseaseMap.get(p.diseaseId);
    if (!disease) continue;
    const multiplier = shortageMultipliers?.[disease.category] ?? 1;
    totalMortality += (p.currentPrevalence / 100) * disease.mortalityRate * multiplier;
  }

  return totalMortality;
}
