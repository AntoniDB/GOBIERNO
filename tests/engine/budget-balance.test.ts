import { describe, it, expect } from "vitest";
import type { GameState, OfficialState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal, getPresetConfig, PRESET_KEYS } from "@/lib/game-factory";
import { scaleLawCost } from "@/lib/engine/cost-scale";
import {
  baseMonthlyIncome, calculateIncome, calculateExpenses,
  calculateCommittedSpending, calculateCommittedSpendingPercent,
} from "@/lib/engine/economy";

const funcionarios = (n: number): OfficialState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `o${i}`, name: "F", role: "MINISTER", specialty: null, ministryId: null, partyId: null, loyalty: 50, ambition: 30,
    wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 50, reputation: 50, status: "ACTIVE",
  }));

/** Estado como lo deja la siembra de una partida nueva. */
function estadoInicial(population: number, activeOfficials: number): GameState {
  const total = initialMinistryBudgetTotal(population, activeOfficials);
  const ministries = generateMinistries(total).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: m.subDecisions, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {},
  }));
  return {
    population, ministries, officials: funcionarios(activeOfficials), activeLaws: [], judicialCases: [],
    organisms: [{ id: "c", type: "COMPTROLLER", name: "Contraloría", monthlyBudget: scaleLawCost(BALANCE.INITIAL_COMPTROLLER_BUDGET, population), staff: 30, effectiveness: 40, autonomyLevel: 50, headOfficialId: null }],
    longRunningDecisions: [], programs: [], tradeFlows: [],
  } as unknown as GameState;
}

describe("generateMinistries(totalPercent)", () => {
  it("por defecto reparte 100 con los pesos originales", () => {
    const ms = generateMinistries();
    expect(ms.map((m) => m.budgetPercent)).toEqual([14, 16, 18, 10, 12, 8, 10, 12]);
  });

  it.each([93.3, 90, 85.5, 100, 70.1])("la suma es exactamente %s (en décimas)", (total) => {
    const suma = generateMinistries(total).reduce((s, m) => s + Math.round(m.budgetPercent * 10), 0);
    expect(suma).toBe(Math.floor(total * 10 + 1e-9));
  });

  it("conserva el orden relativo, los límites del motor y las sub-decisiones", () => {
    const ms = generateMinistries(93.3);
    const base = generateMinistries();
    for (let i = 0; i < ms.length; i++) {
      expect(ms[i].key).toBe(base[i].key);
      expect(ms[i].subDecisions).toEqual(base[i].subDecisions);
      expect(ms[i].budgetPercent).toBeGreaterThanOrEqual(BALANCE.MIN_BUDGET_PERCENT);
      expect(ms[i].budgetPercent).toBeLessThanOrEqual(BALANCE.MAX_BUDGET_PERCENT);
      expect(Math.abs(ms[i].budgetPercent - (base[i].budgetPercent * 93.3) / 100)).toBeLessThan(0.1);
    }
  });

  it("los porcentajes están en décimas (sin ruido de coma flotante)", () => {
    for (const m of generateMinistries(93.3)) expect(Math.round(m.budgetPercent * 10) / 10).toBe(m.budgetPercent);
  });
});

describe("initialMinistryBudgetTotal", () => {
  it("deja lugar a la Contraloría y a los sueldos, y es igual en todos los presets", () => {
    const totales = PRESET_KEYS.map((p) => initialMinistryBudgetTotal(getPresetConfig(p, "normal").population, 32));
    for (const t of totales) {
      expect(t).toBeGreaterThan(90);
      expect(t).toBeLessThan(100);
    }
    expect(new Set(totales).size).toBe(1); // la Contraloría pesa lo mismo (6,7%) en cualquier país
  });

  it("más funcionarios activos → menos presupuesto ministerial disponible", () => {
    expect(initialMinistryBudgetTotal(10_000_000, 400)).toBeLessThan(initialMinistryBudgetTotal(10_000_000, 30));
  });
});

describe("el primer mes de una partida nueva cierra en equilibrio", () => {
  it.each(PRESET_KEYS.flatMap((p) => [30, 38, 60].map((n) => [p, n] as const)))("preset %s con %i funcionarios", (preset, n) => {
    const pop = getPresetConfig(preset, "normal").population;
    const e = estadoInicial(pop, n);
    const balance = calculateIncome(e) - calculateExpenses(e);
    expect(balance).toBeGreaterThanOrEqual(0);                       // nunca déficit
    expect(balance).toBeLessThan(0.001 * calculateIncome(e));        // y menos de 0,1% del ingreso de sobra
  });

  it("con el reparto anterior (100%) había un déficit igual al gasto fijo", () => {
    const e = estadoInicial(50_000_000, 32);
    e.ministries = generateMinistries().map((m, i) => ({ ...e.ministries[i], budgetPercent: m.budgetPercent }));
    const deficit = calculateExpenses(e) - calculateIncome(e);
    expect(deficit).toBeCloseTo(calculateCommittedSpending(e), 0);
    expect(deficit / calculateIncome(e)).toBeGreaterThan(0.06);
  });

  it("baseMonthlyIncome coincide con calculateIncome sin leyes", () => {
    expect(baseMonthlyIncome(50_000_000)).toBe(calculateIncome({ population: 50_000_000, activeLaws: [] } as unknown as GameState));
  });
});

describe("calculateCommittedSpending", () => {
  const base = () => estadoInicial(10_000_000, 30);

  it("suma organismos y sueldos (los gastos fijos de calculateExpenses)", () => {
    const e = base();
    const ministerios = e.ministries.reduce((s, m) => s + (m.budgetPercent / 100) * calculateIncome(e), 0);
    expect(calculateCommittedSpending(e)).toBeCloseTo(calculateExpenses(e) - ministerios, 0);
    expect(calculateCommittedSpending(e)).toBe(scaleLawCost(BALANCE.INITIAL_COMPTROLLER_BUDGET, 10_000_000) + 30 * BALANCE.BASE_SALARY_PER_MINISTER);
  });

  it("incluye obras en curso, programas activos e importaciones activas, y excluye lo demás", () => {
    const e = base();
    const sinNada = calculateCommittedSpending(e);
    e.longRunningDecisions = [
      { monthlyCost: 1_000, status: "IN_PROGRESS" }, { monthlyCost: 9_999, status: "COMPLETED" }, { monthlyCost: 9_999, status: "CANCELLED" },
    ] as never;
    e.programs = [{ monthlyCost: 2_000, status: "ACTIVE" }, { monthlyCost: 9_999, status: "CANCELLED" }] as never;
    e.tradeFlows = [
      { monthlyCost: 4_000, isActive: true, direction: "IMPORT" }, { monthlyCost: 9_999, isActive: false, direction: "IMPORT" },
      { monthlyCost: 9_999, isActive: true, direction: "EXPORT" },
    ] as never;
    expect(calculateCommittedSpending(e) - sinNada).toBe(1_000 + 2_000 + 4_000);
  });

  it("incluye el costo mensual de las leyes activas", () => {
    const e = base();
    const sinLey = calculateCommittedSpending(e);
    e.activeLaws = [{ id: "l", lawKey: "x", activatedAt: "", effectsJson: { monthlyCost: 100_000_000 } }];
    expect(calculateCommittedSpending(e) - sinLey).toBe(scaleLawCost(100_000_000, 10_000_000));
  });

  it("el porcentaje es el gasto comprometido sobre el ingreso (6,7% con solo la Contraloría)", () => {
    const e = estadoInicial(50_000_000, 0);
    expect(calculateCommittedSpendingPercent(e)).toBeCloseTo((150 / (45 * 50)) * 100, 6);
  });

  it("sin ingreso devuelve 0 en vez de dividir por cero", () => {
    const e = base();
    e.population = 0;
    expect(calculateCommittedSpendingPercent(e)).toBe(0);
  });

  it("calculateExpenses no cambió: ministerios + gastos fijos", () => {
    const e = base();
    e.activeLaws = [{ id: "l", lawKey: "x", activatedAt: "", effectsJson: { monthlyCost: 50_000_000 } }];
    const ministerios = e.ministries.reduce((s, m) => s + (m.budgetPercent / 100) * calculateIncome(e), 0);
    const esperado = ministerios + 30 * BALANCE.BASE_SALARY_PER_MINISTER
      + scaleLawCost(BALANCE.INITIAL_COMPTROLLER_BUDGET, 10_000_000) + scaleLawCost(50_000_000, 10_000_000);
    expect(calculateExpenses(e)).toBeCloseTo(esperado, 0);
  });
});
