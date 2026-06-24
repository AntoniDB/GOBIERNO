// ─── Balance de recursos entre ministerios ────────────────────────────────────
// Sistema de dependencias cruzadas: los ministerios pueden declarar recursos
// que producen (output) y recursos que consumen (input).
//
// Cada mes el motor:
//  1. Calcula produccion total por tipo de recurso (suma de outputs)
//  2. Calcula consumo total por tipo de recurso (suma de inputs)
//  3. Actualiza el stock: stock[t] += prod[t] - cons[t], con floor 0
//  4. Aplica decaimiento de excedente (1-2% mensual solo al excedente)
//  5. Ajusta eficiencia de ministerios con deficit: eff *= min(1, stock/consumo)
//  6. Bonus por excedente: curva decreciente 1 - exp(-excedente/X)
//
// Reglas:
//  - Floor 0: el stock nunca es negativo. Deficit → penalizacion de eficiencia.
//  - Sin cap maximo: puede acumular libremente.
//  - Bonus por excedente decreciente: pasar de suficiente a abundante da bonus,
//    pero acumular indefinidamente no da ventaja desproporcionada.
//  - Decaimiento solo al excedente sobre la demanda corriente.

import type { GameState, MinistryState, ResourceStockState } from "./types";
import { BALANCE } from "../balance";

export interface ResourceType {
  key: string;
  label: string;
  /** Calibracion: X en 1 - exp(-excedente / X). Mas alto = bonus mas lento. */
  bonusX: number;
}

export const RESOURCE_TYPES: ResourceType[] = [
  { key: "medical_professionals", label: "Profesionales medicos", bonusX: 20 },
  { key: "engineers", label: "Ingenieros", bonusX: 25 },
  { key: "teachers", label: "Docentes", bonusX: 30 },
  { key: "soldiers", label: "Soldados", bonusX: 50 },
  { key: "infrastructure_capacity", label: "Capacidad de infraestructura", bonusX: 100 },
  { key: "industrial_output", label: "Produccion industrial", bonusX: 80 },
];

function getBonusX(resourceType: string): number {
  const rt = RESOURCE_TYPES.find((r) => r.key === resourceType);
  return rt?.bonusX ?? 50;
}

/**
 * Calcula la eficiencia ajustada de un ministerio segun el balance
 * de recursos que consume.
 *
 * @param ministry - Ministerio a evaluar
 * @param stocks - Stocks actuales de recursos
 * @returns Factor de eficiencia [0, 1.5] — 1.0 = eficiencia nominal
 */
export function calculateResourceEfficiency(
  ministry: MinistryState,
  stocks: ResourceStockState[]
): number {
  const consumed = ministry.consumedResources ?? {};
  const consumedEntries = Object.entries(consumed);

  if (consumedEntries.length === 0) return 1.0;

  let efficiencyFactor = 1.0;

  for (const [resourceType, demanded] of consumedEntries) {
    const stock = stocks.find((s) => s.resourceType === resourceType);
    const available = stock?.quantity ?? 0;

    if (demanded <= 0) continue;

    // Si hay deficit: penalizacion proporcional
    if (available < demanded) {
      const deficitFactor = available / demanded;
      efficiencyFactor *= deficitFactor;
    }
    // Si hay excedente: bonus decreciente
    else {
      const surplus = available - demanded;
      const bonus = 1 - Math.exp(-surplus / getBonusX(resourceType));
      efficiencyFactor *= (1 + bonus * BALANCE.RESOURCE_SURPLUS_BONUS_CAP);
    }
  }

  return Math.max(BALANCE.RESOURCE_EFFICIENCY_FLOOR, Math.min(1.5, efficiencyFactor));
}

/**
 * Calcula produccion y consumo nacional de cada tipo de recurso
 * a partir de las declaraciones de los ministerios.
 */
export function calculateResourceFlows(
  ministries: MinistryState[]
): { production: Record<string, number>; consumption: Record<string, number> } {
  const production: Record<string, number> = {};
  const consumption: Record<string, number> = {};

  for (const ministry of ministries) {
    // Produccion: output del ministerio escalado por su eficiencia
    for (const [resourceType, amount] of Object.entries(ministry.producedResources ?? {})) {
      const effectiveAmount = amount * (ministry.efficiency / 100);
      production[resourceType] = (production[resourceType] ?? 0) + effectiveAmount;
    }

    // Consumo: input requerido por el ministerio
    for (const [resourceType, amount] of Object.entries(ministry.consumedResources ?? {})) {
      consumption[resourceType] = (consumption[resourceType] ?? 0) + amount;
    }
  }

  return { production, consumption };
}

/**
 * Aplica decaimiento al excedente de cada tipo de recurso.
 * Solo se degrada la cantidad que excede la demanda corriente.
 *
 * @param stocks - Stocks actuales
 * @param consumption - Consumo nacional por tipo
 * @returns Nuevos stocks con decaimiento aplicado
 */
export function applyResourceDecay(
  stocks: ResourceStockState[],
  consumption: Record<string, number>
): ResourceStockState[] {
  return stocks.map((stock) => {
    const demanded = consumption[stock.resourceType] ?? 0;
    const surplus = Math.max(0, stock.quantity - demanded);

    if (surplus <= 0) return { ...stock };

    const decay = surplus * BALANCE.RESOURCE_DECAY_RATE;
    return {
      ...stock,
      quantity: Math.max(0, stock.quantity - decay),
    };
  });
}

/**
 * Actualiza los stocks de recursos con la produccion y consumo del mes.
 * Asegura floor 0 (stock nunca negativo).
 *
 * @param stocks - Stocks actuales
 * @param production - Produccion nacional por tipo
 * @param consumption - Consumo nacional por tipo
 * @returns Nuevos stocks actualizados
 */
export function updateResourceStocks(
  stocks: ResourceStockState[],
  production: Record<string, number>,
  consumption: Record<string, number>
): ResourceStockState[] {
  const allTypes = new Set([
    ...Object.keys(stocks.reduce((acc, s) => ({ ...acc, [s.resourceType]: true }), {} as Record<string, boolean>)),
    ...Object.keys(production),
    ...Object.keys(consumption),
  ]);

  const result: ResourceStockState[] = [];

  for (const resourceType of allTypes) {
    const existing = stocks.find((s) => s.resourceType === resourceType);
    const prod = production[resourceType] ?? 0;
    const cons = consumption[resourceType] ?? 0;
    const currentQty = existing?.quantity ?? 0;

    const newQty = Math.max(0, currentQty + prod - cons);

    result.push({
      id: existing?.id ?? `rs-${resourceType}`,
      resourceType,
      quantity: Math.round(newQty * 100) / 100,
    });
  }

  return result;
}

/**
 * Orquestador mensual: calcula flujos, actualiza stocks, aplica decaimiento,
 * y ajusta eficiencias de cada ministerio segun balance de recursos.
 *
 * @param state - Estado completo del juego (mutado in-place)
 */
export function processResourceBalance(state: GameState): void {
  // 1. Calcular produccion y consumo nacional
  const { production, consumption } = calculateResourceFlows(state.ministries);

  // 2. Actualizar stocks con produccion y consumo
  state.resourceStocks = updateResourceStocks(
    state.resourceStocks ?? [],
    production,
    consumption
  );

  // 3. Aplicar decaimiento de excedente
  state.resourceStocks = applyResourceDecay(state.resourceStocks, consumption);

  // 4. Ajustar eficiencia de cada ministerio segun recursos disponibles
  for (const ministry of state.ministries) {
    const resourceEff = calculateResourceEfficiency(ministry, state.resourceStocks);
    ministry.efficiency = Math.round(ministry.efficiency * resourceEff * 100) / 100;
  }
}
