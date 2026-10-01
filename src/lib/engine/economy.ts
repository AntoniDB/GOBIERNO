// ─── Funciones puras de economía ─────────────────────────────────────────────
// Cálculo de ingresos fiscales, gastos, tesorería, inflación y PIB.

import type { GameState, LawCatalogEntry } from "./types";
import { BALANCE } from "../balance";
import { scaleLawCost } from "./cost-scale";
import { subDecisionDeltas } from "./sub-decision-effects";

/**
 * Ingresos fiscales = poblaciónActiva * ingresoPerCápita * tasaImpositiva.
 * - poblaciónActiva = 60% de population
 * - ingresoPerCápita = BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA
 * - tasaImpositiva = BALANCE.TAX_RATE_BASE + suma de modificadores de leyes activas
 */
export function calculateIncome(state: GameState): number {
  const activePopulation = state.population * BALANCE.ACTIVE_POPULATION_SHARE;
  const incomePerCapita = BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA;

  // Tasa impositiva base + modificadores de leyes activas
  let taxRate = BALANCE.TAX_RATE_BASE;
  for (const law of state.activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    const modifier = effects["taxRateModifier"];
    if (typeof modifier === "number") {
      taxRate += modifier;
    }
    const taxRev = effects["taxRevenue"];
    if (typeof taxRev === "number") {
      taxRate += taxRev / 100; // taxRevenue viene en %, convertir a decimal
    }
  }

  return activePopulation * incomePerCapita * taxRate;
}

/**
 * Ingreso mensual de un país sin leyes que cambien la tasa impositiva.
 * Sirve para dimensionar los presupuestos iniciales de una partida nueva.
 */
export function baseMonthlyIncome(population: number): number {
  return population * BALANCE.ACTIVE_POPULATION_SHARE * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * BALANCE.TAX_RATE_BASE;
}

/**
 * Gastos que no dependen del presupuesto de los ministerios (se cobran aunque
 * estos reciban 0): salarios de funcionarios activos, presupuestos de organismos,
 * costo mensual de leyes activas y costo (o ahorro) de las sub-decisiones.
 */
function fixedExpenseBreakdown(state: GameState) {
  // Salarios de officials (cada official activo cobra salario base)
  const activeOfficialCount = state.officials.filter((o) => o.status === "ACTIVE").length;
  const officialSalaries = activeOfficialCount * BALANCE.BASE_SALARY_PER_MINISTER;

  // Presupuestos de organismos
  let organismExpenses = 0;
  for (const org of state.organisms) {
    organismExpenses += org.monthlyBudget;
  }

  // Costo de leyes activas que tengan un costo definido en effectsJson
  let lawCosts = 0;
  const lawDetails: Array<{ key: string; cost: number }> = [];
  for (const law of state.activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    const baseCost = effects["monthlyCost"] ?? effects["cost"];
    if (typeof baseCost === "number") {
      // El catálogo guarda el costo para la población de referencia de leyes
      const cost = scaleLawCost(baseCost, state.population);
      lawCosts += cost;
      lawDetails.push({ key: law.lawKey, cost });
    }
  }

  // Costo (o ahorro) de las sub-decisiones respecto de su valor sembrado
  const subDecisionCost = subDecisionDeltas(state.ministries, state.population).cost;

  return {
    activeOfficialCount,
    officialSalaries,
    organismExpenses,
    lawCosts,
    lawDetails,
    subDecisionCost,
    total: officialSalaries + organismExpenses + lawCosts + subDecisionCost,
  };
}

/**
 * Gasto mensual comprometido fuera de los ministerios: los gastos fijos de
 * calculateExpenses más lo que el motor cobra aparte cada mes (obras y programas
 * en curso e importaciones activas). Es lo que reduce el presupuesto ministerial
 * con el que el país llega al equilibrio.
 */
export function calculateCommittedSpending(state: GameState): number {
  const fixed = fixedExpenseBreakdown(state).total;
  const lrd = (state.longRunningDecisions ?? [])
    .filter((d) => d.status === "IN_PROGRESS")
    .reduce((sum, d) => sum + d.monthlyCost, 0);
  const programs = (state.programs ?? [])
    .filter((p) => p.status === "ACTIVE")
    .reduce((sum, p) => sum + p.monthlyCost, 0);
  const imports = (state.tradeFlows ?? [])
    .filter((f) => f.isActive && f.direction === "IMPORT")
    .reduce((sum, f) => sum + f.monthlyCost, 0);
  return fixed + lrd + programs + imports;
}

/**
 * Gasto comprometido como % del ingreso mensual. El presupuesto de los ministerios
 * solo puede sumar `100 − este valor` para que el mes cierre en equilibrio.
 */
export function calculateCommittedSpendingPercent(state: GameState): number {
  const income = calculateIncome(state);
  return income > 0 ? (calculateCommittedSpending(state) / income) * 100 : 0;
}

/**
 * Gastos = presupuestos ministeriales (% del ingreso) + salarios officials
 *          + presupuestos de organismos + costo de leyes activas
 *          + costo de sub-decisiones.
 */
export function calculateExpenses(state: GameState): number {
  const income = calculateIncome(state);

  // Presupuestos ministeriales: cada ministerio recibe budgetPercent % del ingreso
  let ministryExpenses = 0;
  for (const ministry of state.ministries) {
    ministryExpenses += (ministry.budgetPercent / 100) * income;
  }

  const fixed = fixedExpenseBreakdown(state);
  const { activeOfficialCount, officialSalaries, organismExpenses, lawCosts, lawDetails, subDecisionCost } = fixed;

  const total = ministryExpenses + fixed.total;

  // ── DEBUG: Desglose de gastos del turno ──
  const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(2)}B` : `${(n/1e6).toFixed(2)}M`;
  console.log("═══ GASTOS DEL TURNO ═══");
  console.log(`  Ingreso:                  ${fmt(income)} AKN`);
  console.log(`  Ministerios (${state.ministries.length}):         ${fmt(ministryExpenses)} AKN`);
  for (const m of state.ministries) {
    console.log(`    ${m.key}: ${m.budgetPercent}% → ${fmt((m.budgetPercent/100)*income)} AKN`);
  }
  console.log(`  Salarios (${activeOfficialCount} officials):     ${fmt(officialSalaries)} AKN`);
  console.log(`  Organismos (${state.organisms.length}):            ${fmt(organismExpenses)} AKN`);
  for (const org of state.organisms) {
    console.log(`    ${org.type} "${org.name}": ${fmt(org.monthlyBudget)} AKN/mes`);
  }
  console.log(`  Leyes activas (${lawDetails.length} con costo):  ${fmt(lawCosts)} AKN`);
  for (const l of lawDetails) {
    console.log(`    ${l.key}: ${fmt(l.cost)} AKN/mes`);
  }
  console.log(`  Sub-decisiones:           ${fmt(subDecisionCost)} AKN`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  GASTO TOTAL:             ${fmt(total)} AKN`);
  console.log(`  DÉFICIT/SUPERÁVIT:       ${fmt(income - total)} AKN`);

  return total;
}

/**
 * Perfil de costo de una ley, escalado a la población (referencia de leyes):
 * - monthly: costo mensual recurrente (`effectsJson.monthlyCost`), que cobra calculateExpenses.
 * - enactment: costo ÚNICO al promulgar (`cost`); negativo = ingreso (privatizaciones, etc.).
 *
 * Las leyes con costo mensual no tienen costo único: su `cost` repite el monto mensual
 * (cost == monthlyCost en todo el catálogo), y cobrarlo también contaría el gasto doble.
 */
export function lawCostProfile(
  law: Pick<LawCatalogEntry, "cost" | "effectsJson">,
  population: number,
): { monthly: number; enactment: number } {
  const rawMonthly = law.effectsJson["monthlyCost"] ?? law.effectsJson["cost"];
  const monthly = typeof rawMonthly === "number" && rawMonthly > 0 ? scaleLawCost(rawMonthly, population) : 0;
  const enactment = monthly > 0 ? 0 : scaleLawCost(law.cost, population);
  return { monthly, enactment };
}

/**
 * Costos únicos de promulgar las leyes indicadas. `totalCost` positivo se descuenta
 * del tesoro; negativo se acredita. Ignora claves que no están en el catálogo y
 * leyes sin costo único.
 */
export function resolveLawEnactments(
  lawKeys: string[],
  catalog: Map<string, LawCatalogEntry>,
  population: number,
): { totalCost: number; details: Array<{ lawKey: string; name: string; cost: number }> } {
  const details: Array<{ lawKey: string; name: string; cost: number }> = [];
  for (const lawKey of lawKeys) {
    const law = catalog.get(lawKey);
    if (!law) continue;
    const { enactment } = lawCostProfile(law, population);
    if (enactment !== 0) details.push({ lawKey, name: law.name, cost: enactment });
  }
  return { totalCost: details.reduce((sum, d) => sum + d.cost, 0), details };
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
 * PIB = population * ingresoPerCapitaMensual * 12 * (eficienciaEconomia/100).
 * La eficiencia de Economia representa la calidad pura de gestion del ministerio
 * (0-100%), sin ponderar por presupuesto. El PIB depende de la economia general,
 * no solo de cuanto invierte el ministerio.
 */
export function calculateGDP(state: GameState): number {
  const baseGDP =
    state.population * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * 12;

  // Buscar eficiencia del ministerio de Economia (gestion pura, 0-100%)
  const economyMinistry = state.ministries.find(
    (m) => m.key === "economia" || m.key === "ECONOMY"
  );
  const efficiency = economyMinistry?.efficiency ?? 50;

  let gdp = baseGDP * (efficiency / 100);

  // Aplicar modificadores de leyes activas
  for (const law of state.activeLaws) {
    const effects = law.effectsJson as Record<string, unknown>;
    const gdpMod = effects["gdp"];
    if (typeof gdpMod === "number") {
      gdp += gdp * (gdpMod / 100);
    }
  }

  // Sub-decisiones (STEM, tasa de interés, apertura...): modificador en % del PIB
  gdp += gdp * (subDecisionDeltas(state.ministries, state.population).indicators.gdpPct / 100);

  return Math.max(0, gdp);
}
