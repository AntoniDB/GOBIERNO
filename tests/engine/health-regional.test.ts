import { describe, it, expect } from "vitest";
import type { GameState, RegionState } from "@/lib/engine/types";
import {
  calculateHealthRegional,
  calculateNationalSaturationMortality,
} from "@/lib/engine/indicators";
import { BALANCE } from "@/lib/balance";

function crearRegion(overrides?: Partial<RegionState>): RegionState {
  return {
    id: "r-test",
    name: "Region Test",
    type: "URBAN",
    populationPercent: 25,
    povertyRate: 20,
    infrastructureLevel: 60,
    accessModifier: 0.3,
    povertyModifier: 1.0,
    healthCoverage: {
      primary: { facilities: 5, beds: 200, operationalCost: 500000 },
      secondary: { facilities: 2, beds: 100, operationalCost: 300000 },
      tertiary: { facilities: 1, beds: 50, operationalCost: 700000 },
    },
    ...overrides,
  };
}

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    programs: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "test",
    gdp: 30000000000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 20,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [
      {
        id: "min-health", key: "HEALTH", budgetPercent: 14, efficiency: 50,
        internalCorruption: 5, subDecisions: {}, ministerOfficialId: null,
        producedResources: {}, consumedResources: {},
        healthBudgetSplit: { primary: 50, secondary: 30, tertiary: 20 },
      },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
    },
    media: [],
    events: [],
    longRunningDecisions: [],
    resourceStocks: [],
    regions: [],
    consecutiveLowApprovalMonths: 0,
    sanctionsMultiplier: 1,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    ...overrides,
  };
}

describe("calculateHealthRegional", () => {
  it("sin regiones, usa fallback global (calculateHealth)", () => {
    const state = crearEstadoBase({ regions: [] });
    const sickRate = calculateHealthRegional(state);
    expect(sickRate).toBeGreaterThan(0);
    expect(sickRate).toBeLessThan(50);
  });

  it("region con cobertura alta produce menor sickRate", () => {
    const state = crearEstadoBase({
      regions: [
        crearRegion({
          accessModifier: 0.1,
          healthCoverage: {
            primary: { facilities: 20, beds: 1000, operationalCost: 500000 },
            secondary: { facilities: 10, beds: 500, operationalCost: 300000 },
            tertiary: { facilities: 5, beds: 300, operationalCost: 700000 },
          },
        }),
      ],
    });
    const sickRate = calculateHealthRegional(state);
    expect(sickRate).toBeLessThan(15);
  });

  it("region rural con acceso dificil produce mayor sickRate", () => {
    const state = crearEstadoBase({
      regions: [
        crearRegion({
          type: "RURAL",
          populationPercent: 100,
          accessModifier: 0.9,
          povertyRate: 60,
          povertyModifier: 1.5,
          healthCoverage: {
            primary: { facilities: 1, beds: 20, operationalCost: 50000 },
            secondary: { facilities: 0, beds: 0, operationalCost: 0 },
            tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
          },
        }),
      ],
    });
    const sickRate = calculateHealthRegional(state);
    // raw = 60*1.5*0.35+28 = 59.5, casi sin cobertura → ~59%
    expect(sickRate).toBeGreaterThan(50);
  });

  it("sickRate es promedio ponderado por poblacion entre regiones", () => {
    const state = crearEstadoBase({
      regions: [
        crearRegion({
          id: "r-low", name: "Baja Cobertura", populationPercent: 30, povertyRate: 50, accessModifier: 0.8,
          povertyModifier: 2.0,
          healthCoverage: {
            primary: { facilities: 1, beds: 30, operationalCost: 50000 },
            secondary: { facilities: 0, beds: 0, operationalCost: 0 },
            tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
          },
        }),
        crearRegion({
          id: "r-high", name: "Alta Cobertura", populationPercent: 70, povertyRate: 10, accessModifier: 0.1,
          povertyModifier: 0.5,
          healthCoverage: {
            primary: { facilities: 20, beds: 1000, operationalCost: 500000 },
            secondary: { facilities: 10, beds: 500, operationalCost: 300000 },
            tertiary: { facilities: 5, beds: 300, operationalCost: 700000 },
          },
        }),
      ],
    });
    const sickRate = calculateHealthRegional(state);
    // ~35% (30% zona pobre a 63, 70% zona rica a 23.5)
    expect(sickRate).toBeGreaterThan(30);
    expect(sickRate).toBeLessThan(40);
  });
});

describe("calculateNationalSaturationMortality", () => {
  it("sin regiones retorna 0", () => {
    const state = crearEstadoBase({ regions: [] });
    const mort = calculateNationalSaturationMortality(state);
    expect(mort).toBe(0);
  });

  const region = (populationPercent: number, beds: number, id = "r") =>
    crearRegion({
      id, name: id, populationPercent,
      healthCoverage: {
        primary: { facilities: 1, beds, operationalCost: 0 },
        secondary: { facilities: 0, beds: 0, operationalCost: 0 },
        tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
      },
    });

  it("una red con camas de sobra no genera mortalidad por saturación", () => {
    // pob. 10M, 25% = 2.5M, sick 5% → demanda = 2.5M × 0.05 × HOSPITALIZATION_SHARE = 62.5 camas; hay 350
    const state = crearEstadoBase({ sickRate: 5, regions: [region(25, 350)] });
    expect(calculateNationalSaturationMortality(state)).toBe(0);
  });

  it("una región con demanda > camas sufre mortalidad, ponderada por su población", () => {
    // demanda = 2.5M × 0.05 × 0.0005 = 62.5; camas = 10 → saturación (62.5−10)/10 = 5.25
    // multiplicador extra = min(2, 5.25/3) = 1.75, ponderado por 25% de la población
    const state = crearEstadoBase({ sickRate: 5, regions: [region(25, 10)] });
    const demanda = 2_500_000 * 0.05 * BALANCE.HOSPITALIZATION_SHARE;
    const esperado = Math.min(2, (demanda - 10) / 10 / 3) * 0.25;
    expect(calculateNationalSaturationMortality(state)).toBeCloseTo(esperado, 8);
    expect(esperado).toBeCloseTo(0.4375, 8);
  });

  it("la mortalidad crece de forma gradual con la saturación (no salta al tope)", () => {
    const mort = (beds: number) => calculateNationalSaturationMortality(crearEstadoBase({ sickRate: 40, regions: [region(100, beds)] }));
    // demanda = 10M × 0.4 × 0.0005 = 2000 camas
    expect(mort(2000)).toBe(0);               // justo suficiente
    expect(mort(1500)).toBeGreaterThan(0);
    expect(mort(1500)).toBeLessThan(mort(1000));
    expect(mort(1000)).toBeLessThan(mort(100));
    expect(mort(1)).toBe(2);                  // tope (cap del multiplicador)
  });

  it("múltiples regiones: se suman ponderadas y las que tienen camas de sobra no aportan", () => {
    // sick 10%: r-sat 40% → demanda 4M×0.1×0.0005 = 200 vs 50 camas → min(2, 150/50/3) = 1 → ×0.4
    //           r-med 60% → demanda 6M×0.1×0.0005 = 300 vs 8000 camas → 0
    const state = crearEstadoBase({
      sickRate: 10,
      regions: [region(40, 50, "r-sat"), region(60, 8000, "r-med")],
    });
    expect(calculateNationalSaturationMortality(state)).toBeCloseTo(1 * 0.4, 8);
  });

  it("una región sin camas no se cuenta (evita dividir por cero)", () => {
    const state = crearEstadoBase({ sickRate: 40, regions: [region(100, 0)] });
    expect(calculateNationalSaturationMortality(state)).toBe(0);
  });
});
