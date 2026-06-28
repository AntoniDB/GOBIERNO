import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { createMonthSnapshot } from "@/lib/engine/snapshot";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    countryName: "República de Prueba",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "test-seed",
    gdp: 50000000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 50, internalCorruption: 8, subDecisions: {}, ministerOfficialId: null },
      { id: "min-agricultura", key: "agricultura", budgetPercent: 5, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-educacion", key: "educacion", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
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
      powerConcentration: 30, pressFreedom: 80, judicialIndependence: 80,
      politicalPluralism: 80, civilLiberties: 80, transparency: 75, militarySubordination: 85,
    },
    media: [],
    events: [],
    consecutiveLowApprovalMonths: 0,
    longRunningDecisions: [],
    sanctionsMultiplier: 1,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    ...overrides,
  };
}

describe("createMonthSnapshot", () => {
  it("produce todos los campos requeridos", () => {
    const state = crearEstadoBase();
    const snapshot = createMonthSnapshot(state, 2024, 1);

    expect(snapshot).toHaveProperty("year");
    expect(snapshot).toHaveProperty("month");
    expect(snapshot).toHaveProperty("treasury");
    expect(snapshot).toHaveProperty("gdp");
    expect(snapshot).toHaveProperty("population");
    expect(snapshot).toHaveProperty("approval");
    expect(snapshot).toHaveProperty("corruption");
    expect(snapshot).toHaveProperty("povertyRate");
    expect(snapshot).toHaveProperty("unemploymentRate");
    expect(snapshot).toHaveProperty("sickRate");
    expect(snapshot).toHaveProperty("crimeRate");
    expect(snapshot).toHaveProperty("foodSecurity");
    expect(snapshot).toHaveProperty("educationLevel");
    expect(snapshot).toHaveProperty("inflation");
    expect(snapshot).toHaveProperty("gini");
    expect(snapshot).toHaveProperty("regimeType");
    expect(snapshot).toHaveProperty("regimeMetrics");
  });

  it("año y mes son correctos", () => {
    const state = crearEstadoBase();
    const snapshot = createMonthSnapshot(state, 2025, 6);
    expect(snapshot.year).toBe(2025);
    expect(snapshot.month).toBe(6);
  });

  it("tesorería y población reflejan el estado", () => {
    const state = crearEstadoBase({ treasury: 5000000, population: 25000000 });
    const snapshot = createMonthSnapshot(state, 2024, 1);
    expect(snapshot.treasury).toBe(5000000);
    expect(snapshot.population).toBe(25000000);
  });

  it("todos los valores numéricos son finitos y no NaN", () => {
    const state = crearEstadoBase();
    const snapshot = createMonthSnapshot(state, 2024, 1);
    const numericKeys = [
      "treasury", "gdp", "population", "approval", "corruption",
      "povertyRate", "unemploymentRate", "sickRate", "crimeRate",
      "foodSecurity", "educationLevel", "inflation", "gini",
    ] as const;
    for (const key of numericKeys) {
      const val = snapshot[key];
      expect(Number.isFinite(val)).toBe(true);
      expect(Number.isNaN(val)).toBe(false);
    }
  });

  it("regimeType es una cadena conocida", () => {
    const state = crearEstadoBase();
    const snapshot = createMonthSnapshot(state, 2024, 1);
    const tiposValidos = [
      "Democracia plena", "Democracia defectuosa", "Régimen híbrido",
      "Autoritarismo electoral", "Dictadura", "Estado fallido",
    ];
    expect(tiposValidos).toContain(snapshot.regimeType);
  });
});
