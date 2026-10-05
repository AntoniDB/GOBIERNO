// ─── Capacidad hospitalaria: demanda de camas y saturación por región ─────────
// Única definición de la demanda de camas, compartida por el colapso hospitalario
// (health-crises.ts) y la mortalidad por saturación (indicators.ts).
//
//   demanda de camas = población de la región × sickRate/100 × HOSPITALIZATION_SHARE
//   saturación       = demanda / camas de la región
//
// Justificación: la demanda crece con la población y con la tasa de enfermos; las
// camas (en unidades del juego, escaladas a la población del preset) son la
// capacidad. HOSPITALIZATION_SHARE está calibrada contra esas unidades, no contra la
// realidad (ver balance.ts).

import { BALANCE } from "../balance";
import type { RegionState } from "./types";

/** Camas totales de una región (primaria + secundaria + terciaria). */
export function regionBeds(region: RegionState): number {
  const hc = region.healthCoverage;
  return (hc?.primary?.beds ?? 0) + (hc?.secondary?.beds ?? 0) + (hc?.tertiary?.beds ?? 0);
}

/** Camas que necesita a la vez una región con la población y tasa de enfermos dados. */
export function regionBedDemand(
  population: number,
  sickRate: number,
  region: Pick<RegionState, "populationPercent">,
): number {
  const regionalPopulation = population * (region.populationPercent / 100);
  return regionalPopulation * (sickRate / 100) * BALANCE.HOSPITALIZATION_SHARE;
}

/** Saturación = demanda / camas. Una región sin camas no tiene capacidad: Infinity si hay demanda. */
export function regionSaturation(
  population: number,
  sickRate: number,
  region: RegionState,
): number {
  const demand = regionBedDemand(population, sickRate, region);
  const beds = regionBeds(region);
  return beds > 0 ? demand / beds : demand > 0 ? Infinity : 0;
}
