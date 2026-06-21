import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import {
  calculateIncome,
  calculateExpenses,
  calculateTreasury,
  calculateInflation,
  calculateGDP,
} from "@/lib/engine/economy";
import { BALANCE } from "@/lib/balance";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    countryName: "República de Prueba",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "test-seed",
    ministries: [
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc-rich", key: "RICH", populationPercent: 10, averageIncome: 5000, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
      { id: "sc-middle", key: "MIDDLE", populationPercent: 60, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "sc-poverty", key: "POVERTY", populationPercent: 30, averageIncome: 500, approval: 50, demands: [], educationLevel: 30, healthAccess: 40 },
    ],
    regimeMetrics: {
      powerConcentration: 30,
      pressFreedom: 80,
      judicialIndependence: 80,
      politicalPluralism: 80,
      civilLiberties: 80,
      transparency: 75,
      militarySubordination: 85,
    },
    media: [],
    events: [],
    ...overrides,
  };
}

describe("calculateIncome", () => {
  it("calcula ingresos con valores conocidos", () => {
    const state = crearEstadoBase();
    // poblaciónActiva = 10M * 0.6 = 6M
    // income = 6M * 500 * 0.15 = 450M
    const income = calculateIncome(state);
    expect(income).toBe(6000000 * 500 * 0.15);
  });

  it("aplica modificadores de tasa impositiva de leyes activas", () => {
    const state = crearEstadoBase({
      activeLaws: [
        { id: "law-1", lawKey: "impuesto_progresivo", activatedAt: "2024-01", effectsJson: { taxRateModifier: 0.05 } },
      ],
    });
    // tasa = 0.15 + 0.05 = 0.20
    // income = 6M * 500 * 0.20 = 600M
    expect(calculateIncome(state)).toBe(6000000 * 500 * 0.20);
  });

  it("ignora leyes sin taxRateModifier", () => {
    const state = crearEstadoBase({
      activeLaws: [
        { id: "law-2", lawKey: "otra_ley", activatedAt: "2024-01", effectsJson: { approval: 5 } },
      ],
    });
    expect(calculateIncome(state)).toBe(6000000 * 500 * 0.15);
  });
});

describe("calculateExpenses", () => {
  it("produce un número positivo", () => {
    const state = crearEstadoBase();
    const expenses = calculateExpenses(state);
    expect(expenses).toBeGreaterThan(0);
  });

  it("incluye gastos de ministerios", () => {
    const state = crearEstadoBase({
      ministries: [
        { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    const income = calculateIncome(state);
    const expectedMinistry = (10 / 100) * income;
    expect(calculateExpenses(state)).toBe(expectedMinistry);
  });

  it("incluye gastos de organismos", () => {
    const state = crearEstadoBase({
      organisms: [
        { id: "org-1", type: "COMPTROLLER", name: "Contraloría", monthlyBudget: 50000, staff: 10, effectiveness: 50, autonomyLevel: 50, headOfficialId: null },
      ],
    });
    const expenses = calculateExpenses(state);
    expect(expenses).toBeGreaterThanOrEqual(50000);
  });
});

describe("calculateTreasury", () => {
  it("ingreso > gasto aumenta tesorería", () => {
    const nueva = calculateTreasury(1000000, 500000, 300000);
    expect(nueva).toBe(1200000);
  });

  it("gasto > ingreso disminuye tesorería", () => {
    const nueva = calculateTreasury(1000000, 300000, 500000);
    expect(nueva).toBe(800000);
  });

  it("ingreso === gasto mantiene tesorería", () => {
    const nueva = calculateTreasury(1000000, 400000, 400000);
    expect(nueva).toBe(1000000);
  });
});

describe("calculateInflation", () => {
  it("inflación base cuando no hay déficit", () => {
    const state = crearEstadoBase();
    const income = calculateIncome(state);
    const expenses = income * 0.5; // superávit
    const inflation = calculateInflation(state, expenses, income);
    expect(inflation).toBe(BALANCE.BASE_INFLATION);
  });

  it("aumenta con el déficit", () => {
    const state = crearEstadoBase();
    const income = 1000000;
    const expenses = 1100000; // 10% déficit
    const inflation = calculateInflation(state, expenses, income);
    expect(inflation).toBe(BALANCE.BASE_INFLATION + 10 * BALANCE.INFLATION_DEFICIT_FACTOR);
  });
});

describe("calculateGDP", () => {
  it("escala con la eficiencia del ministerio de economía", () => {
    const state = crearEstadoBase({
      ministries: [
        { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 80, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    const gdp = calculateGDP(state);
    const baseGDP = state.population * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * 12;
    expect(gdp).toBe(baseGDP * 0.8);
  });

  it("usa 50 como eficiencia por defecto si no hay ministerio de economía", () => {
    const state = crearEstadoBase({ ministries: [] });
    const gdp = calculateGDP(state);
    const baseGDP = state.population * BALANCE.BASE_MONTHLY_INCOME_PER_CAPITA * 12;
    expect(gdp).toBe(baseGDP * 0.5);
  });
});
