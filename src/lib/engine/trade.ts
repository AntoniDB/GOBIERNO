// ─── Sistema de comercio exterior generico (Salud-3B-i) ───────────────────────
// Catalogo de bienes comerciables y flujos de importacion/exportacion.
// Generico: los perfiles de cada ministerio declaran que bienes importan/exportan.
//
// Cada mes el motor:
//  1. Calcula demanda por bien (poblacion * demandPerCapita)
//  2. Aplica sub-decision del jugador via targetVolume
//  3. Aplica restriccion por tesoreria (curva continua)
//  4. Aplica sanctionsMultiplier (reduce volumen, mantiene costo total)
//  5. Calcula costo total de importaciones y descuenta del tesoro
//  6. Calcula balanza comercial para MonthSnapshot
//
// sanctionsMultiplier: efecto dual intencional (ver tablas calibracion aprobadas)
//   effective_unit_cost = baseCost * sanctionsMultiplier
//   import_volume = target_volume * treasury_factor / sanctionsMultiplier
//   total_cost = import_volume * effective_unit_cost
//             = target_volume * treasury_factor * baseCost
//   → se cancela en costo total, pero reduce volumen recibido

import type {
  GameState,
  TradeGoodState,
  TradeFlowState,
  TradeGoodCategory,
} from "./types";
import { BALANCE } from "../balance";
import { TRADE_GOOD_CATALOG, type TradeGoodSeed } from "../seed-catalogs";

const DEFAULT_GOOD_ID_PREFIX: Record<TradeGoodCategory, string> = {
  MEDICAMENTS_GENERIC: "tgood-gen",
  MEDICAMENTS_BRAND: "tgood-brand",
};

/**
 * Crea bienes por defecto para una partida nueva (desde TRADE_GOOD_CATALOG).
 */
export function createDefaultTradeGoods(
  idx: number,
  gameId: string,
): TradeGoodState[] {
  return TRADE_GOOD_CATALOG.map((good) => ({
    id: `${DEFAULT_GOOD_ID_PREFIX[good.category]}-${idx}`,
    gameId,
    key: good.key,
    category: good.category,
    name: good.name,
    description: good.description,
    baseCostPerUnit: good.baseCostPerUnit,
    unitDescription: good.unitDescription,
    demandPerCapita: good.demandPerCapita,
  }));
}

/**
 * Parámetros del flujo de importación inicial de un bien: cubre
 * `defaultFlowShare` de la demanda de la población dada, a costo base.
 */
export function defaultTradeFlowParams(
  population: number,
  good: Pick<TradeGoodSeed, "demandPerCapita" | "defaultFlowShare" | "baseCostPerUnit">,
): { volume: number; unitCost: number; monthlyCost: number } {
  const demand = calculateDemand(population, good.demandPerCapita);
  const volume = Math.ceil(demand * good.defaultFlowShare);
  return {
    volume,
    unitCost: good.baseCostPerUnit,
    monthlyCost: volume * good.baseCostPerUnit,
  };
}

/**
 * Calcula la demanda total de un bien en unidades/mes.
 *   demanda = poblacion * demandPerCapita
 */
export function calculateDemand(
  population: number,
  demandPerCapita: number,
): number {
  return Math.ceil(population * demandPerCapita);
}

/**
 * Factor de importacion por tesoreria (curva continua).
 *   factor = clamp(treasury / CRITICAL_THRESHOLD, MIN_FACTOR, 1.0)
 */
export function treasuryImportFactor(treasury: number): number {
  const raw = treasury / BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD;
  return Math.max(
    BALANCE.TRADE_IMPORT_MIN_FACTOR,
    Math.min(1.0, raw),
  );
}

/**
 * Aplica sanctionsMultiplier: reduce volumen, no cambia costo total.
 *   effective_cost = baseCost * multiplier
 *   volume_after_sanctions = volume / multiplier
 *   total_cost = volume_after_sanctions * effective_cost = volume * baseCost
 */
export function applySanctions(
  volume: number,
  baseCost: number,
  sanctionsMultiplier: number,
): { volume: number; unitCost: number } {
  const effectiveUnitCost = baseCost * sanctionsMultiplier;
  const adjustedVolume = volume / sanctionsMultiplier;
  return {
    volume: adjustedVolume,
    unitCost: effectiveUnitCost,
  };
}

/**
 * Orquesta el calculo de todos los flujos comerciales del mes.
 * Modifica state directamente:
 *  - Actualiza state.tradeFlows con los nuevos valores
 *  - Descuenta el costo total de importaciones del tesoro
 * Devuelve stats para el snapshot: totalImports, totalExports, tradeBalance
 */
export function processTradeFlows(state: GameState): {
  totalImports: number;
  totalExports: number;
  tradeBalance: number;
} {
  const treasury = state.treasury;
  const sanctionsMultiplier = state.sanctionsMultiplier ?? BALANCE.TRADE_SANCTIONS_MULTIPLIER;

  let totalImports = 0;
  let totalExports = 0;

  // Determinar target volumes desde la sub-decision de TradeFlow
  // (valores persistidos en los flujos existentes)
  const medicamentosPop = state.population;

  for (const flow of state.tradeFlows ?? []) {
    if (!flow.isActive) continue;

    const good = state.tradeGoods.find((g) => g.id === flow.tradeGoodId);
    if (!good) continue;

    // Solo procesamos imports por ahora (exports son futuros)
    if (flow.direction !== "IMPORT") continue;

    const demand = calculateDemand(medicamentosPop, good.demandPerCapita);
    const targetVolume = flow.targetVolume > 0 ? flow.targetVolume : demand;

    const treasuryFactor = treasuryImportFactor(treasury);
    const volumeAfterTreasury = targetVolume * treasuryFactor;
    const { volume, unitCost } = applySanctions(
      volumeAfterTreasury,
      good.baseCostPerUnit,
      sanctionsMultiplier,
    );
    const monthlyCost = volume * unitCost;

    flow.monthlyVolume = volume;
    flow.unitCost = unitCost;
    flow.monthlyCost = monthlyCost;

    totalImports += monthlyCost;
  }

  // Descontar importaciones del tesoro
  state.treasury = Math.max(0, state.treasury - totalImports);

  const tradeBalance = totalExports - totalImports;

  return { totalImports, totalExports, tradeBalance };
}

/**
 * Calcula cobertura de importacion agregada (para UI y deteccion de escasez).
 *   coverage = total_volume_imported / total_demand_target
 *   Si coverage < TRADE_SHORTAGE_COVERAGE_THRESHOLD → escasez activa
 */
export function calculateImportCoverage(state: GameState): number {
  let totalVolume = 0;
  let totalTarget = 0;

  for (const flow of state.tradeFlows ?? []) {
    if (!flow.isActive || flow.direction !== "IMPORT") continue;
    totalVolume += flow.monthlyVolume;
    totalTarget += flow.targetVolume;
  }

  if (totalTarget <= 0) return 1.0;
  return Math.min(1.0, totalVolume / totalTarget);
}

/**
 * Determina si hay escasez de medicamentos activa segun el umbral definido.
 */
export function isMedicationShortage(state: GameState): boolean {
  const coverage = calculateImportCoverage(state);
  return coverage < BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD;
}
