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
 * Prevalencia de equilibrio de una enfermedad para una eficiencia de Salud dada
 * (la prevalencia hacia la que tiende cuando ningún programa actúa sobre ella).
 *
 *   equilibrio = base × (1 − (eficiencia/100) × sensibilidad) + contagio
 *   contagio   = contagionRate × (1 − eficiencia/100) × CONTAGION_MULTIPLIER   (solo transmisibles)
 *
 * Justificación: SPEC.md hace depender los enfermos de la eficiencia de Salud. Esta es
 * la única fórmula de objetivo (siembra, recuperación mensual y programas la usan),
 * de modo que la política sanitaria mueve el sickRate (≈57 % con eficiencia 20,
 * ≈50 % con 50 y ≈35 % con 100). Antes la recuperación apuntaba a base + contagio, ignorando
 * la eficiencia: el equilibrio quedaba en ≈61 % con cualquier política.
 */
export function diseaseTargetPrevalence(
  disease: Pick<DiseaseState, "contagionRate" | "prevalenceBase" | "preventionSensitivity"> & {
    category: string;
  },
  healthEfficiency: number,
): number {
  const coverageBonus = healthEfficiency / BALANCE.DISEASE_COVERAGE_MAX;
  // La prevencion reduce la prevalencia base segun la sensibilidad de la enf.
  const preventionEffect = coverageBonus * disease.preventionSensitivity;
  // Transmisibles: la contagionRate puede hacer que suba si no hay control
  const contagionBonus = disease.category === "TRANSMISSIBLE"
    ? disease.contagionRate * (1 - coverageBonus) * BALANCE.CONTAGION_MULTIPLIER
    : 0;
  const raw = disease.prevalenceBase * (1 - preventionEffect) + contagionBonus;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Prevalencia con la que nace una enfermedad en una partida: su equilibrio con la
 * eficiencia inicial de Salud (`DISEASE_SEED_HEALTH_EFFICIENCY`), redondeada a 2 decimales.
 * Sembrar en 0 hacía que el sickRate subiera ~3 pts/mes durante años hasta el equilibrio.
 */
export function initialDiseasePrevalence(
  disease: Pick<DiseaseState, "contagionRate" | "prevalenceBase" | "preventionSensitivity"> & {
    category: string;
  },
): number {
  const value = diseaseTargetPrevalence(disease, BALANCE.DISEASE_SEED_HEALTH_EFFICIENCY);
  return Math.round(value * 100) / 100;
}

/**
 * Calcula la prevalencia de equilibrio de cada enfermedad en funcion de la
 * eficiencia sanitaria del pais (ver `diseaseTargetPrevalence`).
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

  return diseases.map((disease) => ({
    id: `prev-${disease.id}`,
    diseaseId: disease.id,
    currentPrevalence: Math.round(diseaseTargetPrevalence(disease, healthEfficiency) * 100) / 100,
  }));
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
