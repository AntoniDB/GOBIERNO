import { describe, it, expect } from "vitest";
import type { GameState, MinistryState } from "@/lib/engine/types";
import {
  calculateMedicalProduction,
  calculateMedicalDemand,
  calculateHospitalOperationalFactor,
} from "@/lib/engine/medical-professionals";
import { calculateResourceFlows } from "@/lib/engine/resource-balance";
import { BALANCE } from "@/lib/balance";

function crearMinisterio(overrides?: Partial<MinistryState>): MinistryState {
  return {
    id: "min-test",
    key: "EDUCATION",
    budgetPercent: 16,
    efficiency: 60,
    internalCorruption: 5,
    subDecisions: {},
    ministerOfficialId: null,
    producedResources: {},
    consumedResources: {},
    healthBudgetSplit: { primary: 50, secondary: 30, tertiary: 20 },
    ...overrides,
  };
}

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1_000_000_000,
    population: 10_000_000,
    seed: "test",
    gdp: 30_000_000_000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [],
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
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
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

const RED_COMPLETA: GameState["regions"] = [
  {
    id: "r1", name: "Capital", type: "URBAN", populationPercent: 100,
    povertyRate: 10, infrastructureLevel: 80, accessModifier: 0.2, povertyModifier: 0.8,
    healthCoverage: {
      primary: { facilities: 8, beds: 1500, operationalCost: 1_500_000 },
      secondary: { facilities: 5, beds: 1500, operationalCost: 1_000_000 },
      tertiary: { facilities: 2, beds: 800, operationalCost: 2_000_000 },
    },
  },
];

describe("calculateMedicalProduction", () => {
  it("produccion escala con budget × efficiency × population × FACTOR", () => {
    // 16% × 60% × 10M × 0.00095 = 912
    const state = crearEstadoBase({
      population: 10_000_000,
      ministries: [crearMinisterio({ budgetPercent: 16, efficiency: 60 })],
    });
    expect(calculateMedicalProduction(state)).toBeCloseTo(912, 0);
  });

  it("mayor budget educativo produce mas medicos linealmente", () => {
    const state16 = crearEstadoBase({ ministries: [crearMinisterio({ budgetPercent: 16 })] });
    const state32 = crearEstadoBase({ ministries: [crearMinisterio({ budgetPercent: 32 })] });
    expect(calculateMedicalProduction(state32)).toBeCloseTo(calculateMedicalProduction(state16) * 2, 0);
  });

  it("mayor efficiency educativa produce mas medicos linealmente", () => {
    const state60 = crearEstadoBase({ ministries: [crearMinisterio({ efficiency: 60 })] });
    const state80 = crearEstadoBase({ ministries: [crearMinisterio({ efficiency: 80 })] });
    expect(calculateMedicalProduction(state80)).toBeCloseTo(calculateMedicalProduction(state60) * (80 / 60), 0);
  });

  it("educacion abandonada (budget 2%, eff 20%) produce muy poco", () => {
    const state = crearEstadoBase({
      population: 10_000_000,
      ministries: [crearMinisterio({ budgetPercent: 2, efficiency: 20 })],
    });
    // 2% × 20% × 10M × 0.00095 = 38
    expect(calculateMedicalProduction(state)).toBeCloseTo(38, 0);
  });

  it("sin ministerio EDUCATION retorna 0", () => {
    const state = crearEstadoBase({ ministries: [] });
    expect(calculateMedicalProduction(state)).toBe(0);
  });
});

describe("calculateMedicalDemand", () => {
  it("demanda escala con total de beds × MEDICS_PER_BED", () => {
    // red total = 1500 + 1500 + 800 = 3800 beds → 3800 × 0.2 = 760
    const state = crearEstadoBase({ regions: RED_COMPLETA });
    expect(calculateMedicalDemand(state)).toBeCloseTo(760, 0);
  });

  it("sin regiones definidas → demanda 0", () => {
    const state = crearEstadoBase({ regions: [] });
    expect(calculateMedicalDemand(state)).toBe(0);
  });

  it("demanda crece al construir mas camas", () => {
    const statePequeno = crearEstadoBase({ regions: [{
      id: "r1", name: "R", type: "URBAN", populationPercent: 100, povertyRate: 10,
      infrastructureLevel: 60, accessModifier: 0.2, povertyModifier: 0.8,
      healthCoverage: {
        primary: { facilities: 5, beds: 200, operationalCost: 0 },
        secondary: { facilities: 1, beds: 50, operationalCost: 0 },
        tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
      },
    }] });
    const stateGrande = crearEstadoBase({ regions: [{
      id: "r1", name: "R", type: "URBAN", populationPercent: 100, povertyRate: 10,
      infrastructureLevel: 60, accessModifier: 0.2, povertyModifier: 0.8,
      healthCoverage: {
        primary: { facilities: 5, beds: 1000, operationalCost: 0 },
        secondary: { facilities: 1, beds: 300, operationalCost: 0 },
        tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
      },
    }] });
    expect(calculateMedicalDemand(stateGrande)).toBeGreaterThan(calculateMedicalDemand(statePequeno));
  });
});

describe("calculateHospitalOperationalFactor", () => {
  it("sin red hospitalaria (demanda 0) → factor 1.0 (plena capacidad)", () => {
    const state = crearEstadoBase({ regions: [] });
    expect(calculateHospitalOperationalFactor(state)).toBe(1.0);
  });

  it("stock > demanda → factor 1.0 + bonus decreciente (cap 1.2)", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,  // demanda 760
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 2000 },
      ],
    });
    const factor = calculateHospitalOperationalFactor(state);
    expect(factor).toBeGreaterThan(1.0);
    expect(factor).toBeLessThanOrEqual(1.2);
  });

  it("stock >>> demanda → bonus saturado en cap 1.2", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 100_000 },
      ],
    });
    expect(calculateHospitalOperationalFactor(state)).toBeCloseTo(1.2, 1);
  });

  it("stock = demanda → factor 1.0", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,  // demanda 760
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 760 },
      ],
    });
    expect(calculateHospitalOperationalFactor(state)).toBeCloseTo(1.0, 1);
  });

  it("stock < demanda → factor = stock/demanda (deficit proporcional)", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,  // demanda 760
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 380 },  // 50%
      ],
    });
    expect(calculateHospitalOperationalFactor(state)).toBeCloseTo(0.5, 2);
  });

  it("stock muy bajo respeta el floor MEDICS_OPERATIONAL_FLOOR", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,  // demanda 760
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 0 },
      ],
    });
    const factor = calculateHospitalOperationalFactor(state);
    expect(factor).toBe(BALANCE.MEDICS_OPERATIONAL_FLOOR);
    expect(factor).toBeGreaterThan(0);
  });

  it("educacion abandonada produce ~5% de la demanda → factor floor (5%)", () => {
    // edu abandonada: 2% × 20% × 10M × 0.00095 = 38 vs demanda 760 → 5%
    const state = crearEstadoBase({
      population: 10_000_000,
      regions: RED_COMPLETA,
      ministries: [crearMinisterio({ budgetPercent: 2, efficiency: 20 })],
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 38 },
      ],
    });
    const factor = calculateHospitalOperationalFactor(state);
    expect(factor).toBeCloseTo(0.05, 2);
  });
});

describe("Integración: producto cruzado Education → Health", () => {
  it("calculateResourceFlows usa perfiles dinamicos (EDU produce, SAL consume)", () => {
    const state = crearEstadoBase({
      population: 10_000_000,
      regions: RED_COMPLETA,
      ministries: [
        crearMinisterio({ id: "min-edu", key: "EDUCATION", budgetPercent: 16, efficiency: 60 }),
        crearMinisterio({ id: "min-hea", key: "HEALTH" }),
      ],
    });
    const { production, consumption } = calculateResourceFlows(state.ministries, state);
    // EDUCATION produce medical_professionals: 0.16 × 0.6 × 10M × 0.00095 = 912
    expect(production["medical_professionals"]).toBeCloseTo(912, 0);
    // HEALTH consume: 3800 × 0.2 = 760
    expect(consumption["medical_professionals"]).toBeCloseTo(760, 0);
    // Sustraer net: +152 superavit
    const balance = production["medical_professionals"] - consumption["medical_professionals"];
    expect(balance).toBeCloseTo(152, 0);
  });

  it("pais con educacion robusta produce superavit considerable", () => {
    const state = crearEstadoBase({
      population: 10_000_000,
      regions: RED_COMPLETA,
      ministries: [
        crearMinisterio({ id: "min-edu", key: "EDUCATION", budgetPercent: 22, efficiency: 80 }),
        crearMinisterio({ id: "min-hea", key: "HEALTH" }),
      ],
    });
    const { production, consumption } = calculateResourceFlows(state.ministries, state);
    // prod: 0.22 × 0.8 × 10M × 0.00095 = 1672; demanda 760 → +912
    expect(production["medical_professionals"] - consumption["medical_professionals"]).toBeGreaterThan(800);
  });
});

describe("Factor operativo en cobertura regional", () => {
  it("déficit de mdcs reduce factor operativo → no afecta ministry.efficiency", () => {
    const state = crearEstadoBase({
      regions: RED_COMPLETA,
      ministries: [
        crearMinisterio({ id: "min-hea", key: "HEALTH", efficiency: 70 }),
        crearMinisterio({ id: "min-edu", key: "EDUCATION", budgetPercent: 2, efficiency: 20 }),
      ],
      resourceStocks: [
        { id: "rs1", resourceType: "medical_professionals", quantity: 38 },
      ],
    });
    const factor = calculateHospitalOperationalFactor(state);
    expect(factor).toBeCloseTo(0.05, 2);
    // La efficiency de gestion del ministerio HEALTH queda intacta
    const health = state.ministries.find((m) => m.key === "HEALTH");
    expect(health!.efficiency).toBe(70);
  });
});