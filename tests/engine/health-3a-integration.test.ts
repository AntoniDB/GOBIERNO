import { describe, it, expect } from "vitest";
import type { GameState, LongRunningDecisionState } from "@/lib/engine/types";
import { advanceDecisions, applyDecisionEffects, createNewDecisions } from "@/lib/engine/long-running-decisions";
import { BALANCE } from "@/lib/balance";

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
    regions: [
      {
        id: "r1",
        name: "Capital Federal",
        type: "URBAN",
        populationPercent: 25,
        povertyRate: 10,
        infrastructureLevel: 80,
        accessModifier: 0.2,
        povertyModifier: 0.8,
        healthCoverage: {
          primary: { facilities: 10, beds: 500, operationalCost: 1_000_000 },
          secondary: { facilities: 4, beds: 200, operationalCost: 600_000 },
          tertiary: { facilities: 1, beds: 80, operationalCost: 1_500_000 },
        },
      },
      {
        id: "r2",
        name: "Zona Rural",
        type: "RURAL",
        populationPercent: 75,
        povertyRate: 40,
        infrastructureLevel: 30,
        accessModifier: 0.7,
        povertyModifier: 1.2,
        healthCoverage: {
          primary: { facilities: 3, beds: 100, operationalCost: 200_000 },
          secondary: { facilities: 1, beds: 40, operationalCost: 80_000 },
          tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
        },
      },
    ],
    diseases: [
      { id: "d1", name: "VIH", category: "TRANSMISSIBLE", contagionRate: 0.01, mortalityRate: 0.05, prevalence: 0, prevalenceBase: 2, hasVaccine: false, preventionSensitivity: 0.7, monthlyCostPerPatient: 3000, classAffinity: {} },
      { id: "d2", name: "Gripe", category: "TRANSMISSIBLE", contagionRate: 0.15, mortalityRate: 0.001, prevalence: 0, prevalenceBase: 10, hasVaccine: true, preventionSensitivity: 0.8, monthlyCostPerPatient: 200, classAffinity: {} },
    ],
    diseasePrevalences: [
      { id: "p1", diseaseId: "d1", currentPrevalence: 2 },
      { id: "p2", diseaseId: "d2", currentPrevalence: 10 },
    ],
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

function crearLrd(overrides?: Partial<LongRunningDecisionState>): LongRunningDecisionState {
  return {
    id: "lrd-test",
    type: "HOSPITAL_CONSTRUCTION",
    name: "Construcción hospital",
    monthsRemaining: 12,
    totalMonths: 12,
    monthlyCost: 3_000_000,
    parameters: {},
    status: "IN_PROGRESS",
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    progressLog: [],
    effectOnCompletion: {},
    ...overrides,
  };
}

describe("Construcción de hospital (HOSPITAL_CONSTRUCTION LRD)", () => {
  it("createNewDecisions genera la configuracion correcta del hospital", () => {
    const { decisions } = createNewDecisions(crearEstadoBase(), {
      newLongRunningDecisions: [{ type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "primary" } }],
    });
    const lrd = decisions[0];
    expect(lrd.type).toBe("HOSPITAL_CONSTRUCTION");
    expect(lrd.name).toContain("Capital Federal");
    expect(lrd.totalMonths).toBe(BALANCE.HOSPITAL_DURATIONS.primary);
    expect(lrd.monthlyCost).toBe(BALANCE.HOSPITAL_COSTS.primary);
    expect(lrd.parameters).toEqual({ regionId: "r1", level: "primary" });
  });

  it("al completarse, suma beds y facilities a la region y nivel correctos", () => {
    const state = crearEstadoBase();
    const regionBefore = state.regions.find((r) => r.id === "r1");
    const secondaryBefore = regionBefore!.healthCoverage.secondary.beds;
    expect(secondaryBefore).toBe(200);

    const lrd = crearLrd({
      monthsRemaining: 1,
      totalMonths: 18,
      parameters: { regionId: "r1", level: "secondary" },
    });
    state.longRunningDecisions = [lrd];
    const result = advanceDecisions(state, {});
    expect(result.completed).toHaveLength(1);
    applyDecisionEffects(result.completed, state);

    const regionAfter = state.regions.find((r) => r.id === "r1");
    const secondaryAfter = regionAfter!.healthCoverage.secondary.beds;
    expect(secondaryAfter).toBe(200 + BALANCE.HOSPITAL_BEDS_ADDED.secondary);
    const facilitiesAfter = regionAfter!.healthCoverage.secondary.facilities;
    expect(facilitiesAfter).toBe(4 + BALANCE.HOSPITAL_FACILITIES_ADDED.secondary);
  });

  it("construir en region diferente no afecta otras regiones", () => {
    const state = crearEstadoBase();
    const r2BedsBefore = state.regions.find((r) => r.id === "r2")!.healthCoverage.tertiary.beds;

    const lrd = crearLrd({
      monthsRemaining: 1,
      parameters: { regionId: "r2", level: "tertiary" },
    });
    state.longRunningDecisions = [lrd];
    const result = advanceDecisions(state, {});
    applyDecisionEffects(result.completed, state);

    // r2 terciario sube, r1 terciario no se toca
    expect(state.regions.find((r) => r.id === "r2")!.healthCoverage.tertiary.beds).toBe(
      r2BedsBefore + BALANCE.HOSPITAL_BEDS_ADDED.tertiary,
    );
    expect(state.regions.find((r) => r.id === "r1")!.healthCoverage.tertiary.beds).toBe(80);
  });

  it("cancelar antes pierde lo invertido y no aplica efecto sobre la region", () => {
    const state = crearEstadoBase({
      treasury: 1_000_000_000,
      longRunningDecisions: [crearLrd({ monthsRemaining: 5, monthlyCost: 6_000_000 })],
    });
    const bedsBefore = state.regions[0].healthCoverage.primary.beds;
    const treasuryBefore = state.treasury;

    // 2 meses de avance
    let r = advanceDecisions(state, {});
    state.longRunningDecisions = r.updatedDecisions;
    state.treasury -= r.totalCost;
    r = advanceDecisions(state, {});
    state.longRunningDecisions = r.updatedDecisions;
    state.treasury -= r.totalCost;

    const treasuryMid = state.treasury;
    expect(treasuryMid).toBe(treasuryBefore - 12_000_000);

    // Cancelar
    r = advanceDecisions(state, { cancelDecisionIds: [state.longRunningDecisions[0].id] });
    state.longRunningDecisions = r.updatedDecisions;
    state.treasury -= r.totalCost; // 0 porque se cancela

    expect(state.longRunningDecisions[0].status).toBe("CANCELLED");
    // No se aplica el efecto → beds no cambia
    expect(state.regions[0].healthCoverage.primary.beds).toBe(bedsBefore);
  });
});

describe("Investigación medica (MEDICAL_RESEARCH LRD)", () => {
  it("createNewDecisions genera la configuracion correcta de la investigacion", () => {
    const state = crearEstadoBase();
    const ids = state.diseases.slice(0, 2).map((d) => d.id);
    const { decisions } = createNewDecisions(state, {
      newLongRunningDecisions: [{ type: "MEDICAL_RESEARCH", parameters: { diseaseIds: ids } }],
    });
    const lrd = decisions[0];
    expect(lrd.type).toBe("MEDICAL_RESEARCH");
    expect(lrd.name).toContain(state.diseases[0].name);
    expect(lrd.totalMonths).toBe(BALANCE.MEDICAL_RESEARCH_DURATION);
    expect(lrd.monthlyCost).toBe(BALANCE.MEDICAL_RESEARCH_COST);
    expect(lrd.parameters.diseaseIds).toEqual(ids);
  });

  it("al completarse, desbloquea vacuna para enfermedad sin hasVaccine", () => {
    const state = crearEstadoBase();
    // VIH (d1) no tiene vacuna
    expect(state.diseases[0].hasVaccine).toBe(false);

    const lrd = crearLrd({
      id: "lrd-vih",
      type: "MEDICAL_RESEARCH",
      monthsRemaining: 1,
      totalMonths: 48,
      parameters: { diseaseIds: ["d1"] },
    });
    state.longRunningDecisions = [lrd];
    const r = advanceDecisions(state, {});
    applyDecisionEffects(r.completed, state);

    // VIH ahora tiene vacuna
    expect(state.diseases.find((d) => d.id === "d1")!.hasVaccine).toBe(true);
  });

  it("al completarse, reduce mortalityRate a la mitad si ya tenia vacuna", () => {
    const state = crearEstadoBase();
    // Gripe (d2) ya tiene vacuna, mortalityRate = 0.001
    expect(state.diseases.find((d) => d.id === "d2")!.mortalityRate).toBe(0.001);

    const lrd = crearLrd({
      id: "lrd-gripe",
      type: "MEDICAL_RESEARCH",
      monthsRemaining: 1,
      totalMonths: 48,
      parameters: { diseaseIds: ["d2"] },
    });
    state.longRunningDecisions = [lrd];
    const r = advanceDecisions(state, {});
    applyDecisionEffects(r.completed, state);

    expect(state.diseases.find((d) => d.id === "d2")!.hasVaccine).toBe(true);
    expect(state.diseases.find((d) => d.id === "d2")!.mortalityRate).toBeCloseTo(
      0.001 * BALANCE.MEDICAL_RESEARCH_MORTALITY_REDUCTION,
    );
  });

  it("investiga 2 enfermedades simultaneamente: aplica a las dos", () => {
    const state = crearEstadoBase();
    const lrd = crearLrd({
      id: "lrd-2",
      type: "MEDICAL_RESEARCH",
      monthsRemaining: 1,
      totalMonths: 48,
      parameters: { diseaseIds: ["d1", "d2"] },
    });
    state.longRunningDecisions = [lrd];
    const r = advanceDecisions(state, {});
    applyDecisionEffects(r.completed, state);

    // d1 desbloquea vacuna, d2 reduce mortalidad
    expect(state.diseases.find((d) => d.id === "d1")!.hasVaccine).toBe(true);
    expect(state.diseases.find((d) => d.id === "d2")!.mortalityRate).toBeCloseTo(0.0005, 5);
  });

  it("LRD completada sin diseaseIds no rompe (no-op)", () => {
    const state = crearEstadoBase();
    const lrd = crearLrd({
      id: "lrd-empty",
      type: "MEDICAL_RESEARCH",
      monthsRemaining: 1,
      parameters: {},
    });
    state.longRunningDecisions = [lrd];
    const r = advanceDecisions(state, {});
    expect(() => applyDecisionEffects(r.completed, state)).not.toThrow();
    // No se cambia nada
    expect(state.diseases[0].hasVaccine).toBe(false);
  });
});

describe("Flujo completo LRD construccion: 12 meses → completar → region mejorada", () => {
  it("Simula 12 meses de construccion primario en region pobre y verifica +beds", () => {
    const state = crearEstadoBase({
      treasury: 1_000_000_000,
      longRunningDecisions: [
        crearLrd({
          id: "lrd-flow",
          type: "HOSPITAL_CONSTRUCTION",
          monthsRemaining: 12,
          totalMonths: 12,
          monthlyCost: BALANCE.HOSPITAL_COSTS.primary,
          parameters: { regionId: "r2", level: "primary" },
        }),
      ],
    });

    const bedsBefore = state.regions.find((r) => r.id === "r2")!.healthCoverage.primary.beds;
    let spent = 0;
    let lastCompleted: LongRunningDecisionState[] = [];

    for (let i = 0; i < 12; i++) {
      const r = advanceDecisions(state, {});
      state.longRunningDecisions = r.updatedDecisions;
      state.treasury -= r.totalCost;
      spent += r.totalCost;
      lastCompleted = r.completed;
    }
    expect(spent).toBe(BALANCE.HOSPITAL_COSTS.primary * 12);
    expect(state.longRunningDecisions[0].status).toBe("COMPLETED");
    expect(lastCompleted).toHaveLength(1);

    // Aplicar efecto
    applyDecisionEffects(lastCompleted, state);
    expect(state.regions.find((r) => r.id === "r2")!.healthCoverage.primary.beds).toBe(
      bedsBefore + BALANCE.HOSPITAL_BEDS_ADDED.primary,
    );
  });
});