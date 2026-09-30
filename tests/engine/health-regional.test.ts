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

  it("region con 350 camas sufre saturacion a sickRate 5%", () => {
    const state = crearEstadoBase({
      sickRate: 5,
      regions: [
        crearRegion({
          populationPercent: 25,
          healthCoverage: {
            primary: { facilities: 5, beds: 200, operationalCost: 500000 },
            secondary: { facilities: 2, beds: 100, operationalCost: 300000 },
            tertiary: { facilities: 1, beds: 50, operationalCost: 700000 },
          },
        }),
      ],
    });
    const mort = calculateNationalSaturationMortality(state);
    // 25% pop=2.5M, sick=125K, sickNeedingBeds(8%)=10K, beds=350
    // sat=(10000-350)/350=27.6, limited=2, mult=3, mort=2*0.25=0.5
    expect(mort).toBeGreaterThan(0.4);
    expect(mort).toBeLessThan(0.6);
  });

  it("multiples regiones con saturacion acumulada", () => {
    const state = crearEstadoBase({
      sickRate: 10,
      regions: [
        crearRegion({
          id: "r-sat", name: "Saturada", populationPercent: 40,
          healthCoverage: {
            primary: { facilities: 1, beds: 50, operationalCost: 50000 },
            secondary: { facilities: 0, beds: 0, operationalCost: 0 },
            tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
          },
        }),
        crearRegion({
          id: "r-med", name: "Media", populationPercent: 60,
          healthCoverage: {
            primary: { facilities: 50, beds: 5000, operationalCost: 5000000 },
            secondary: { facilities: 20, beds: 2000, operationalCost: 3000000 },
            tertiary: { facilities: 10, beds: 1000, operationalCost: 7000000 },
          },
        }),
      ],
    });
    const mort = calculateNationalSaturationMortality(state);
    // r-sat: 40% pop=4M, sick=400K, sickNeed=32K, beds=50 → sat extreme → mult=3, mort=2*0.4=0.8
    // r-med: 60% pop=6M, sick=600K, sickNeed=48K, beds=8000 → sat, mult=3, mort=2*0.6=1.2
    // total = 2.0
    expect(mort).toBeGreaterThan(1.5);
    expect(mort).toBeLessThan(3.0);
  });
});
