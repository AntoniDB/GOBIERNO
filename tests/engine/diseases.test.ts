import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import type { DiseaseState } from "@/lib/engine/diseases";
import {
  calculateDiseasePrevalence,
  calculateSickRateFromDiseases,
  calculateDiseaseMortality,
} from "@/lib/engine/diseases";
import { BALANCE } from "@/lib/balance";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
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
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    consecutiveLowApprovalMonths: 0,
    ...overrides,
  };
}

function crearDisease(overrides?: Partial<DiseaseState>): DiseaseState {
  return {
    id: "d-gripe",
    name: "Gripe estacional",
    category: "TRANSMISSIBLE",
    contagionRate: 0.15,
    mortalityRate: 0.001,
    prevalence: 0,
    prevalenceBase: 10,
    hasVaccine: true,
    preventionSensitivity: 0.8,
    monthlyCostPerPatient: 200,
    classAffinity: { EXTREME_POVERTY: 1.0, POVERTY: 1.0, MIDDLE: 1.0, ELITE: 1.0 },
    ...overrides,
  };
}

describe("calculateDiseasePrevalence", () => {
  it("calcula prevalencia segun cobertura sanitaria", () => {
    const state = crearEstadoBase();
    const diseases: DiseaseState[] = [crearDisease()];
    // coverageBonus = 50/100 = 0.5, preventionEffect = 0.5 * 0.8 = 0.4
    // raw = 10 * (1-0.4) + 0.15*(1-0.5)*5 = 6 + 0.375 = 6.375
    const result = calculateDiseasePrevalence(state, diseases);
    expect(result).toHaveLength(1);
    expect(result[0].currentPrevalence).toBeCloseTo(6.38, 1);
  });

  it("mayor eficiencia sanitaria reduce la prevalencia", () => {
    const stateBaja = crearEstadoBase({
      ministries: [{ id: "min-health", key: "HEALTH", budgetPercent: 5, efficiency: 30, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: { primary: 50, secondary: 30, tertiary: 20 } }],
    });
    const stateAlta = crearEstadoBase({
      ministries: [{ id: "min-health", key: "HEALTH", budgetPercent: 20, efficiency: 90, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: { primary: 50, secondary: 30, tertiary: 20 } }],
    });
    const diseases: DiseaseState[] = [crearDisease()];
    const resBaja = calculateDiseasePrevalence(stateBaja, diseases);
    const resAlta = calculateDiseasePrevalence(stateAlta, diseases);
    expect(resAlta[0].currentPrevalence).toBeLessThan(resBaja[0].currentPrevalence);
  });

  it("enfermedad sin prevencion mantiene prevalencia alta", () => {
    const state = crearEstadoBase();
    const disease = crearDisease({ preventionSensitivity: 0.1, prevalenceBase: 8 });
    const result = calculateDiseasePrevalence(state, [disease]);
    // coverage=0.5, preventionEffect=0.5*0.1=0.05, raw=8*(1-0.05)+0.375=7.975
    expect(result[0].currentPrevalence).toBeCloseTo(7.98, 1);
  });
});

describe("calculateSickRateFromDiseases", () => {
  it("sin prevalencias retorna null", () => {
    const result = calculateSickRateFromDiseases([]);
    expect(result).toBeNull();
  });

  it("calcula Π-fórmula correctamente", () => {
    // 2 enfermedades: 6% y 8% → Π = 1 - (1-0.06)*(1-0.08) = 1 - 0.94*0.92 = 1-0.8648 = 13.52%
    const result = calculateSickRateFromDiseases([
      { id: "p1", diseaseId: "d1", currentPrevalence: 6 },
      { id: "p2", diseaseId: "d2", currentPrevalence: 8 },
    ]);
    expect(result).toBeCloseTo(13.52, 0);
  });

  it("con 14 enfermedades, Π ≤ 100", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      id: `p${i}`, diseaseId: `d${i}`, currentPrevalence: 8,
    }));
    const result = calculateSickRateFromDiseases(many)!;
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThan(50);
  });
});

describe("calculateDiseaseMortality", () => {
  it("sin prevalencias retorna 0", () => {
    const result = calculateDiseaseMortality([], []);
    expect(result).toBe(0);
  });

  it("calcula mortalidad aditiva correctamente", () => {
    const diseases: DiseaseState[] = [
      crearDisease({ id: "d-gripe", mortalityRate: 0.001 }),
      crearDisease({ id: "d-cancer", name: "Cancer", category: "CHRONIC", mortalityRate: 0.04, prevalenceBase: 2.5 }),
    ];
    const prevalences = [
      { id: "p1", diseaseId: "d-gripe", currentPrevalence: 5 },
      { id: "p2", diseaseId: "d-cancer", currentPrevalence: 2 },
    ];
    // 0.05*0.001 + 0.02*0.04 = 0.00005 + 0.0008 = 0.00085
    const result = calculateDiseaseMortality(prevalences, diseases);
    expect(result).toBeCloseTo(0.00085, 5);
  });
});
