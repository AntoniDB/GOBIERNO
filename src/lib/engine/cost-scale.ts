// ─── Escalado de costos fijos por población ───────────────────────────────────
// Los ingresos fiscales crecen linealmente con la población (ver economy.ts),
// pero los costos definidos como montos fijos en USD no. Sin escalar, un mismo
// programa pesa 8 veces menos en un país de 80M que en uno de 10M.
//
// Fórmula: costo = costoBase × población / COST_REFERENCE_POPULATION
// Justificación: mantiene constante el peso del costo respecto del ingreso
// mensual (ingreso = 45 × población). A la población de referencia el factor
// es 1, por lo que los valores base de balance.ts son los costos reales ahí.

import { BALANCE } from "../balance";

/** Factor multiplicador de costos para una población dada (1 = población de referencia). */
export function costScaleFactor(population: number): number {
  return population / BALANCE.COST_REFERENCE_POPULATION;
}

/** Escala un costo base en USD a la población dada, redondeado a dólares enteros. */
export function scaleCost(baseCost: number, population: number): number {
  return Math.round(baseCost * costScaleFactor(population));
}
