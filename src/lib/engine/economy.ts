// ─── Funciones puras de economía ─────────────────────────────────────────────
// Cálculo de ingresos fiscales, gastos, tesorería, inflación y PIB.

import type { GameState } from "./types";
import { BALANCE } from "../balance";

/**
 * Ingresos fiscales = poblaciónActiva * ingresoPerCápita * tasaImpositiva.
 * - poblaciónActiva = 60% de population
 * - ingresoPerCápita = BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA
 * - tasaImpositiva = BALANCE.TAX_RATE_BASE + suma de modificadores de leyes activas
 */
export function calculateIncome(state: GameState): number {
  const activePopulation = state.population * 0.6;
  const incomePerCapita = BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA;

  // Tasa impositiva base + modificadores de leyes activas
  let taxRate = BALANCE.TAX_RATE_BASE;
  for (const law of state.activeLaws) {
    const modifier = law.effectsJson["taxRateModifier"];
    if (typeof modifier === "number") {
      taxRate += modifier;
    }
  }

  return activePopulation * incomePerCapita * taxRate;
}

/**
 * Gastos = presupuestos ministeriales (% del ingreso) + salarios officials
 *          + presupuestos de organismos + costo de leyes activas.
 */
export function calculateExpenses(state: GameState): number {
  const income = calculateIncome(state);

  // Presupuestos ministeriales: cada ministerio recibe budgetPercent % del ingreso
  let ministryExpenses = 0;
  for (const ministry of state.ministries) {
    ministryExpenses += (ministry.budgetPercent / 100) * income;
  }

  // Salarios de officials (cada official activo cobra salario base)
  const officialSalaries =
    state.officials.filter((o) => o.status === "ACTIVE").length *
    BALANCE.BASE_SALARY_PER_MINISTER;

  // Presupuestos de organismos
  let organismExpenses = 0;
  for (const org of state.organisms) {
    organismExpenses += org.monthlyBudget;
  }

  // Costo de leyes activas que tengan un costo definido en effectsJson
  let lawCosts = 0;
  for (const law of state.activeLaws) {
    const cost = law.effectsJson["monthlyCost"];
    if (typeof cost === "number") {
      lawCosts += cost;
    }
  }

  return ministryExpenses + officialSalaries + organismExpenses + lawCosts;
}

/**
 * Tesorería del mes = tesorería anterior + ingresos - gastos.
 */
export function calculateTreasury(
  prevTreasury: number,
  income: number,
  expenses: number
): number {
  return prevTreasury + income - expenses;
}

/**
 * Inflación = inflación base + (déficit como % del ingreso) * factor de déficit.
 * Si no hay ingreso pero sí déficit, se asume 100% de déficit.
 */
export function calculateInflation(
  state: GameState,
  expenses: number,
  income: number
): number {
  const deficit = Math.max(0, expenses - income);
  const deficitPercent =
    income > 0 ? (deficit / income) * 100 : deficit > 0 ? 100 : 0;

  return (
    BALANCE.BASE_INFLATION +
    deficitPercent * BALANCE.INFLATION_DEFICIT_FACTOR
  );
}

/**
 * PIB = population * ingresoPerCápitaMensual * 12, ajustado por eficiencia
 * del ministerio de Economía. La eficiencia actúa como multiplicador:
 * eficiencia 100 → PIB al 100% del potencial; eficiencia 50 → 50%.
 */
export function calculateGDP(state: GameState): number {
  const baseGDP =
    state.population * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * 12;

  // Buscar eficiencia del ministerio de Economía
  const economyMinistry = state.ministries.find(
    (m) => m.key === "economia" || m.key === "ECONOMY"
  );
  const efficiency = economyMinistry?.efficiency ?? 50;

  // La eficiencia (0-100) escala linealmente el PIB base
  return baseGDP * (efficiency / 100);
}
