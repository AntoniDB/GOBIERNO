// ─── Funciones puras de economía ─────────────────────────────────────────────
// Cálculo de ingresos fiscales, gastos, tesorería, inflación y PIB.

import type { GameState, LawCatalogEntry } from "./types";
import { BALANCE } from "../balance";
import { scaleLawCost } from "./cost-scale";
import { subDecisionDeltas, subDecisionContext } from "./sub-decision-effects";
import { collectibleBase, economyFactor, evasionRate, monthlyDebtInterest, taxMixFactor } from "./fiscal";

/** Suma de modificadores de la tasa impositiva de las leyes activas (en fracción). */
function lawTaxRateModifier(state: Pick<GameState, "activeLaws">): number {
  let modifier = 0;
  for (const law of state.activeLaws ?? []) {
    const effects = law.effectsJson as Record<string, unknown>;
    const rateMod = effects["taxRateModifier"];
    if (typeof rateMod === "number") modifier += rateMod;
    const taxRev = effects["taxRevenue"];
    if (typeof taxRev === "number") modifier += taxRev / 100; // taxRevenue viene en %, convertir a decimal
  }
  return modifier;
}

export interface TaxRevenueBreakdown {
  /** Tasa efectiva: TAX_RATE_BASE × mezcla de impuestos + modificadores de leyes. */
  taxRate: number;
  /** Factor de la estructura de impuestos (IVA, renta, sociedades); 1 con las tasas iniciales. */
  taxMix: number;
  /** Fracción evadida de la base imponible (corrupción vs. Agencia Tributaria). */
  evasion: number;
  /** Recaudación relativa al primer mes por el tamaño de la base (PIB neto de evasión). */
  economyFactor: number;
  /** Recaudación con la economía del primer mes. */
  potential: number;
  /** Recaudación del mes. */
  revenue: number;
}

/**
 * Recaudación mensual (Economía, Fase 1):
 *   potencial = poblaciónActiva × ingresoPerCápita × (TAX_RATE_BASE × mezcla + leyes)
 *   recaudación = potencial × (base / base del primer mes)^elasticidad,  base = PIB × (1 − evasión)
 * La mezcla refleja las tasas de IVA/renta/sociedades con su curva de Laffer; el factor de economía
 * hace que un PIB que cae o una evasión que sube recauden menos. Sin referencia (primer turno, o
 * estados mínimos de tests) el factor vale 1, así que el equilibrio inicial se conserva.
 */
export function calculateTaxRevenue(state: GameState): TaxRevenueBreakdown {
  const activePopulation = state.population * BALANCE.ACTIVE_POPULATION_SHARE;
  const ministries = state.ministries ?? [];
  const taxMix = taxMixFactor(ministries);
  const taxRate = BALANCE.TAX_RATE_BASE * taxMix + lawTaxRateModifier(state);
  const potential = activePopulation * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * taxRate;

  const evasion = evasionRate(state.officials ?? [], state.organisms ?? []);
  const reference = state.fiscalBaseReference;
  const factor = reference && reference > 0 && ministries.length > 0
    ? economyFactor(collectibleBase(calculateGDP(state), evasion), reference)
    : 1;

  return { taxRate, taxMix, evasion, economyFactor: factor, potential, revenue: potential * factor };
}

/** Ingresos fiscales del mes (ver calculateTaxRevenue). */
export function calculateIncome(state: GameState): number {
  return calculateTaxRevenue(state).revenue;
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
 * costo mensual de leyes activas, costo (o ahorro) de las sub-decisiones e
 * intereses de la deuda pública.
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
  const subDecisionCost = subDecisionDeltas(state.ministries, state.population, subDecisionContext(state)).cost;

  // Intereses de la deuda pública (Economía, Fase 1)
  const debtInterest = monthlyDebtInterest(state);

  return {
    activeOfficialCount,
    officialSalaries,
    organismExpenses,
    lawCosts,
    lawDetails,
    subDecisionCost,
    debtInterest,
    total: officialSalaries + organismExpenses + lawCosts + subDecisionCost + debtInterest,
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
 *          + costo de sub-decisiones + intereses de la deuda.
 */
export function calculateExpenses(state: GameState): number {
  const income = calculateIncome(state);

  // Presupuestos ministeriales: cada ministerio recibe budgetPercent % del ingreso
  let ministryExpenses = 0;
  for (const ministry of state.ministries) {
    ministryExpenses += (ministry.budgetPercent / 100) * income;
  }

  const fixed = fixedExpenseBreakdown(state);
  const { activeOfficialCount, officialSalaries, organismExpenses, lawCosts, lawDetails, subDecisionCost, debtInterest } = fixed;

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
  console.log(`  Intereses de la deuda:    ${fmt(debtInterest)} AKN`);
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
  gdp += gdp * (subDecisionDeltas(state.ministries, state.population, subDecisionContext(state)).indicators.gdpPct / 100);

  return Math.max(0, gdp);
}
