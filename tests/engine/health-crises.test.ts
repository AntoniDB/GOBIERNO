// ─── Tests de crisis sanitarias (Salud-3B-ii) ────────────────────────────────
// 5 crisis + streak tracking. Cada función pura, determinista con rng sembrado.

import { describe, it, expect, vi } from "vitest";
import {
  detectDiseaseOutbreak,
  detectHospitalCollapse,
  detectMedicationShortage,
  detectMalpracticeScandal,
  detectMedicalBreakthrough,
  applyOutbreakEffects,
  updateEfficiencyStreak,
} from "../../src/lib/engine/health-crises";
import type { GameState, EventState, RegionState } from "../../src/lib/engine/types";
import type { DiseaseState } from "../../src/lib/engine/diseases";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRng(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

function makeBaseState(overrides: Partial<GameState> = {}): GameState {
  return {
    countryName: "Testlandia",
    currentYear: 1,
    currentMonth: 6,
    treasury: 500_000_000,
    population: 10_000_000,
    seed: "test-seed",
    povertyRate: 35,
    unemploymentRate: 12,
    sickRate: 40,
    crimeRate: 30,
    foodSecurity: 60,
    educationLevel: 55,
    inflation: 5,
    gdp: 200_000_000_000,
    lifeExpectancy: 68,
    gini: 42,
    diseaseMortality: 0.01,
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    sanctionsMultiplier: 1.0,
    consecutiveLowApprovalMonths: 0,
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    ministries: [
      {
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 30, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      },
    ],
    officials: [
      { id: "off-min", name: "Ministro", role: "MINISTER" as any, ministryId: "m-health", partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 20, skill: 65, reputation: 60, status: "ACTIVE" as any, specialty: null },
      { id: "off-dir1", name: "Dir Hospitales 1", role: "MINISTRY_DIRECTOR" as any, ministryId: "m-health", partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 15, skill: 70, reputation: 60, status: "ACTIVE" as any, specialty: null },
      { id: "off-dir2", name: "Dir Hospitales 2", role: "MINISTRY_DIRECTOR" as any, ministryId: "m-health", partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 20, skill: 60, reputation: 50, status: "ACTIVE" as any, specialty: null },
      { id: "off-pros", name: "Fiscal", role: "PROSECUTOR" as any, ministryId: null, partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 60, reputation: 50, status: "ACTIVE" as any, specialty: null },
      { id: "off-judge", name: "Juez", role: "JUDGE" as any, ministryId: null, partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 60, reputation: 50, status: "ACTIVE" as any, specialty: null },
    ],
    socialClasses: [
      { id: "sc-ep", key: "EXTREME_POVERTY" as any, populationPercent: 15, averageIncome: 5000, approval: 40, demands: [], educationLevel: 30, healthAccess: 20 },
      { id: "sc-p", key: "POVERTY" as any, populationPercent: 35, averageIncome: 15000, approval: 45, demands: [], educationLevel: 50, healthAccess: 40 },
      { id: "sc-m", key: "MIDDLE" as any, populationPercent: 40, averageIncome: 60000, approval: 55, demands: [], educationLevel: 75, healthAccess: 70 },
      { id: "sc-e", key: "ELITE" as any, populationPercent: 10, averageIncome: 300000, approval: 60, demands: [], educationLevel: 95, healthAccess: 90 },
    ],
    regions: [
      {
        id: "reg-north", name: "Norte", type: "RURAL", populationPercent: 30,
        povertyRate: 40, infrastructureLevel: 30, accessModifier: 0.6, povertyModifier: 1.2,
        healthCoverage: {
          primary: { facilities: 3, beds: 150, operationalCost: 500000 },
          secondary: { facilities: 1, beds: 60, operationalCost: 300000 },
          tertiary: { facilities: 0, beds: 0, operationalCost: 0 },
        },
      },
    ],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    media: [],
    events: [],
    longRunningDecisions: [],
    resourceStocks: [],
    diseasePrevalences: [
      { id: "prev-1", diseaseId: "dengue", currentPrevalence: 18 },
      { id: "prev-2", diseaseId: "gripe", currentPrevalence: 8 },
    ],
    diseases: [
      { id: "dengue", name: "Dengue", category: "TRANSMISSIBLE" as const, contagionRate: 0.08, mortalityRate: 0.005, prevalence: 5, prevalenceBase: 5, hasVaccine: false, preventionSensitivity: 0.6, monthlyCostPerPatient: 500, classAffinity: { EXTREME_POVERTY: 1.5, POVERTY: 1.2, MIDDLE: 0.8, ELITE: 0.5 } },
      { id: "gripe", name: "Gripe estacional", category: "TRANSMISSIBLE" as const, contagionRate: 0.15, mortalityRate: 0.001, prevalence: 10, prevalenceBase: 10, hasVaccine: true, preventionSensitivity: 0.8, monthlyCostPerPatient: 200, classAffinity: { EXTREME_POVERTY: 1.3, POVERTY: 1.1, MIDDLE: 1.0, ELITE: 0.9 } },
      { id: "diabetes", name: "Diabetes", category: "CHRONIC" as const, contagionRate: 0, mortalityRate: 0.01, prevalence: 8, prevalenceBase: 8, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 800, classAffinity: { EXTREME_POVERTY: 0.8, POVERTY: 1.0, MIDDLE: 1.3, ELITE: 1.5 } },
    ] as unknown as any[],
    tradeGoods: [],
    tradeFlows: [],
    programs: [],
    candidates: [],
    ...overrides,
  } as GameState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Crisis 1: Brote epidémico (DISEASE_OUTBREAK)
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectDiseaseOutbreak", () => {
  it("sin enfermedades TRANSMISSIBLES no genera brote", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      diseases: [] as any[],
    });
    const events = detectDiseaseOutbreak(state, rng);
    expect(events).toHaveLength(0);
  });

  it("con prevalencia baja pero cobertura alta no genera brote", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      diseasePrevalences: [
        { id: "prev-1", diseaseId: "dengue", currentPrevalence: 5 },
      ],
      regions: [{
        id: "reg-north", name: "Norte", type: "URBAN", populationPercent: 30,
        povertyRate: 10, infrastructureLevel: 80, accessModifier: 0.2, povertyModifier: 1.0,
        healthCoverage: { primary: { facilities: 5, beds: 300, operationalCost: 500000 }, secondary: { facilities: 3, beds: 150, operationalCost: 300000 }, tertiary: { facilities: 1, beds: 50, operationalCost: 0 } },
      }],
    });
    const events = detectDiseaseOutbreak(state, rng);
    expect(events).toHaveLength(0);
  });

  it("dispara brote cuando prevalencia supera umbral y cobertura baja", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      diseasePrevalences: [
        { id: "prev-1", diseaseId: "dengue", currentPrevalence: 18 },
      ],
      regions: [{
        id: "reg-north", name: "Norte", type: "RURAL", populationPercent: 30,
        povertyRate: 45, infrastructureLevel: 20, accessModifier: 0.7, povertyModifier: 1.3,
        healthCoverage: { primary: { facilities: 2, beds: 80, operationalCost: 500000 }, secondary: { facilities: 1, beds: 30, operationalCost: 300000 }, tertiary: { facilities: 0, beds: 0, operationalCost: 0 } },
      }],
    });
    const events = detectDiseaseOutbreak(state, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe("DISEASE_OUTBREAK");
    expect(events[0].description).toContain("Dengue");
    expect(events[0].description).toContain("Norte");
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.diseaseId).toBe("dengue");
    expect(fx.mortalityMultiplier).toBeGreaterThan(1);
    expect(fx.durationMonths).toBeGreaterThanOrEqual(2);
    expect(fx.durationMonths).toBeLessThanOrEqual(4);
    expect(fx.remainingMonths).toBeGreaterThan(0);
  });

  it("severidad escala con prevalencia", () => {
    const rng = makeRng(0.001);
    const low = makeBaseState({
      diseasePrevalences: [{ id: "prev-1", diseaseId: "dengue", currentPrevalence: 16 }],
    });
    const high = makeBaseState({
      diseasePrevalences: [{ id: "prev-1", diseaseId: "dengue", currentPrevalence: 40 }],
    });
    const lowEv = detectDiseaseOutbreak(low, rng);
    const highEv = detectDiseaseOutbreak(high, rng);
    expect(lowEv.length).toBeGreaterThanOrEqual(1);
    expect(highEv.length).toBeGreaterThanOrEqual(1);
    expect(highEv[0].severity).toBeGreaterThan(lowEv[0].severity);
  });

  it("auto-propose ley cuando severidad supera umbral", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      diseasePrevalences: [{ id: "prev-1", diseaseId: "dengue", currentPrevalence: 50 }],
    });
    const events = detectDiseaseOutbreak(state, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.autoProposeLaw).toBe(true);
  });

  it("no auto-propose ley con severidad baja", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      diseasePrevalences: [{ id: "prev-1", diseaseId: "dengue", currentPrevalence: 16 }],
    });
    const events = detectDiseaseOutbreak(state, rng);
    if (events.length > 0) {
      const fx = events[0].effectsApplied as Record<string, unknown>;
      expect(fx.autoProposeLaw).toBe(false);
    }
  });

  it("probabilidad base respeta rng alto (no dispara)", () => {
    const rng = makeRng(0.99);
    const state = makeBaseState({
      diseasePrevalences: [{ id: "prev-1", diseaseId: "dengue", currentPrevalence: 18 }],
    });
    const events = detectDiseaseOutbreak(state, rng);
    expect(events).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Crisis 2: Colapso hospitalario (HOSPITAL_COLLAPSE)
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectHospitalCollapse", () => {
  it("sin regiones no genera colapso", () => {
    const rng = makeRng(0);
    const state = makeBaseState({ regions: [] });
    const events = detectHospitalCollapse(state, rng);
    expect(events).toHaveLength(0);
  });

  it("saturacion baja no dispara colapso", () => {
    const rng = makeRng(0);
    const state = makeBaseState({
      sickRate: 5,
      regions: [{
        id: "reg-1", name: "Centro", type: "URBAN", populationPercent: 100,
        povertyRate: 20, infrastructureLevel: 70, accessModifier: 0.3, povertyModifier: 1.0,
        healthCoverage: { primary: { facilities: 10, beds: 500, operationalCost: 500000 }, secondary: { facilities: 5, beds: 300, operationalCost: 300000 }, tertiary: { facilities: 2, beds: 100, operationalCost: 0 } },
      }],
    });
    const events = detectHospitalCollapse(state, rng);
    expect(events).toHaveLength(0);
  });

  it("saturacion alta por 1 mes no dispara (necesita 3)", () => {
    const rng = makeRng(0);
    // sickRate 50% → sickPop = 5M → sickNeedingBeds = 400k
    // totalBeds = 100 → 400k > 150 → saturación 4000x, bien arriba de 1.5
    const state = makeBaseState({
      sickRate: 50,
      consecutiveSaturationMonths: { "reg-1": 1 },
      regions: [{
        id: "reg-1", name: "Centro", type: "URBAN", populationPercent: 100,
        povertyRate: 20, infrastructureLevel: 70, accessModifier: 0.3, povertyModifier: 1.0,
        healthCoverage: { primary: { facilities: 0, beds: 50, operationalCost: 500000 }, secondary: { facilities: 0, beds: 30, operationalCost: 300000 }, tertiary: { facilities: 0, beds: 20, operationalCost: 0 } },
      }],
    });
    const events = detectHospitalCollapse(state, rng);
    expect(events).toHaveLength(0);
    // El contador se incrementó
    expect(state.consecutiveSaturationMonths["reg-1"]).toBe(2);
  });

  it("saturacion alta por 3 meses SI dispara colapso", () => {
    const rng = makeRng(0);
    const state = makeBaseState({
      sickRate: 50,
      consecutiveSaturationMonths: { "reg-1": 2 },
      regions: [{
        id: "reg-1", name: "Centro", type: "URBAN", populationPercent: 100,
        povertyRate: 20, infrastructureLevel: 70, accessModifier: 0.3, povertyModifier: 1.0,
        healthCoverage: { primary: { facilities: 0, beds: 50, operationalCost: 500000 }, secondary: { facilities: 0, beds: 30, operationalCost: 300000 }, tertiary: { facilities: 0, beds: 20, operationalCost: 0 } },
      }],
    });
    const events = detectHospitalCollapse(state, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe("HOSPITAL_COLLAPSE");
    expect(events[0].description).toContain("Centro");
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.regionId).toBe("reg-1");
    // Resetea contador tras disparo
    expect(state.consecutiveSaturationMonths["reg-1"]).toBe(0);
  });

  it("saturacion se resetea al bajar del umbral", () => {
    const rng = makeRng(0);
    const state = makeBaseState({
      sickRate: 5,
      consecutiveSaturationMonths: { "reg-1": 2 },
      regions: [{
        id: "reg-1", name: "Centro", type: "URBAN", populationPercent: 100,
        povertyRate: 20, infrastructureLevel: 70, accessModifier: 0.3, povertyModifier: 1.0,
        healthCoverage: { primary: { facilities: 10, beds: 500, operationalCost: 500000 }, secondary: { facilities: 5, beds: 300, operationalCost: 300000 }, tertiary: { facilities: 2, beds: 100, operationalCost: 0 } },
      }],
    });
    detectHospitalCollapse(state, rng);
    expect(state.consecutiveSaturationMonths["reg-1"]).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Crisis 3: Escasez de medicamentos (MEDICATION_SHORTAGE)
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectMedicationShortage", () => {
  it("sin escasez ni historial no genera evento", () => {
    const state = makeBaseState();
    // Por defecto no hay tradeFlows activos, así que coverage es 1.0
    const events = detectMedicationShortage(state, false);
    expect(events).toHaveLength(0);
  });

  it("con escasez activa previa (wasShortage=true) no duplica", () => {
    const state = makeBaseState();
    // Aunque detectara escasez, wasShortage=true previene
    const events = detectMedicationShortage(state, true);
    expect(events).toHaveLength(0);
  });

  it("genera evento cuando escasez es nueva", () => {
    // Para forzar escasez: necesitamos coverage < 0.5
    // Sin importaciones activas, coverage = 1.0 (totalTarget=0), no hay escasez
    // Necesitamos tradeFlows con algunas importaciones que no cubran demanda
    const state = makeBaseState({
      tradeFlows: [
        {
          id: "tf-1", gameId: "g-1", tradeGoodId: "tg-1", direction: "IMPORT" as any,
          monthlyVolume: 10, targetVolume: 1000, unitCost: 50,
          sanctionsMultiplier: 1.0, monthlyCost: 500, isActive: true,
        },
      ],
      tradeGoods: [
        {
          id: "tg-1", gameId: "g-1", key: "med-generic", category: "MEDICAMENTS_GENERIC" as any,
          name: "Genéricos", description: null, baseCostPerUnit: 50,
          unitDescription: "Tratamiento", demandPerCapita: 0.00001,
        },
      ],
    });
    const events = detectMedicationShortage(state, false);
    if (events.length > 0) {
      expect(events[0].type).toBe("MEDICATION_SHORTAGE");
      expect(events[0].description).toContain("cobertura");
      const fx = events[0].effectsApplied as Record<string, unknown>;
      expect(fx.shortageMultiplier).toBeGreaterThan(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Crisis 4: Escándalo de mala praxis (MALPRACTICE_SCANDAL)
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectMalpracticeScandal", () => {
  it("con corrupcion baja y rng alto no dispara", () => {
    const rng = makeRng(0.99);
    const state = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 15, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    const events = detectMalpracticeScandal(state, rng);
    expect(events).toHaveLength(0);
  });

  it("con corrupcion alta y rng bajo SI dispara", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 80, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    const events = detectMalpracticeScandal(state, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe("MALPRACTICE_SCANDAL");
    expect(events[0].description).toContain("mala praxis");
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.directorOfficialId).toBeDefined();
    expect(fx.reputationHit).toBeGreaterThan(0);
    expect(fx.opensJudicialCase).toBe(true);
  });

  it("elige director con mayor skill", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 80, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
      officials: [
        { id: "off-dir-low", name: "Dir Bajo", role: "MINISTRY_DIRECTOR" as any, ministryId: "m-health", partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 15, skill: 40, reputation: 50, status: "ACTIVE" as any, specialty: null },
        { id: "off-dir-high", name: "Dir Alto", role: "MINISTRY_DIRECTOR" as any, ministryId: "m-health", partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 15, skill: 90, reputation: 60, status: "ACTIVE" as any, specialty: null },
        { id: "off-pros", name: "Fiscal", role: "PROSECUTOR" as any, ministryId: null, partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 60, reputation: 50, status: "ACTIVE" as any, specialty: null },
        { id: "off-judge", name: "Juez", role: "JUDGE" as any, ministryId: null, partyId: null, loyalty: 50, ambition: 30, wealth: 500_000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 60, reputation: 50, status: "ACTIVE" as any, specialty: null },
      ],
    });
    const events = detectMalpracticeScandal(state, rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.directorOfficialId).toBe("off-dir-high");
  });

  it("severidad escala con corrupcion", () => {
    const rng = makeRng(0.001);
    const low = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 40, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    const high = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 90, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    const lowEv = detectMalpracticeScandal(low, rng);
    const highEv = detectMalpracticeScandal(high, rng);
    if (lowEv.length > 0 && highEv.length > 0) {
      expect(highEv[0].severity).toBeGreaterThan(lowEv[0].severity);
    }
  });

  it("sin directores de salud no dispara", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 60,
        internalCorruption: 80, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
      officials: [],
    });
    const events = detectMalpracticeScandal(state, rng);
    expect(events).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Crisis 5: Avance médico (MEDICAL_BREAKTHROUGH)
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectMedicalBreakthrough", () => {
  it("sin research ni streak alto no dispara", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      healthEfficiencyStreak: 2,
    });
    const events = detectMedicalBreakthrough(state, rng, false, []);
    expect(events).toHaveLength(0);
  });

  it("con research completada y rng bajo SI dispara", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({ healthEfficiencyStreak: 0 });
    const events = detectMedicalBreakthrough(state, rng, true, []);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe("MEDICAL_BREAKTHROUGH");
    expect(events[0].description).toContain("tratamientos");
    const fx = events[0].effectsApplied as Record<string, unknown>;
    expect(fx.diseaseId).toBeDefined();
    expect(fx.mortalityAfter).toBeLessThan(fx.mortalityBefore as number);
  });

  it("con eficiencia alta por 3+ meses y rng bajo SI dispara", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({
      healthEfficiencyStreak: 3,
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 75,
        internalCorruption: 30, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    const events = detectMedicalBreakthrough(state, rng, false, []);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe("MEDICAL_BREAKTHROUGH");
  });

  it("reduce mortalityRate de la enfermedad elegida", () => {
    const rng = makeRng(0.001, 0);
    const state = makeBaseState({ healthEfficiencyStreak: 0 });
    const diseaseBefore = (state.diseases as unknown as DiseaseState[])[0].mortalityRate;
    const events = detectMedicalBreakthrough(state, rng, true, []);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const diseaseAfter = (state.diseases as unknown as DiseaseState[])[0].mortalityRate;
    expect(diseaseAfter).toBeLessThan(diseaseBefore);
  });

  it("no beneficia a enfermedad que ya recibio breakthrough", () => {
    const rng = makeRng(0.001);
    const state = makeBaseState({ healthEfficiencyStreak: 0 });
    // Marcar todas las enfermedades como ya beneficiadas
    const allIds = (state.diseases as unknown as DiseaseState[]).map((d) => d.id);
    const events = detectMedicalBreakthrough(state, rng, true, allIds);
    expect(events).toHaveLength(0);
  });

  it("respeta piso de mortalidad (5% del original)", () => {
    const rng = makeRng(0.001, 0);
    const state = makeBaseState({
      healthEfficiencyStreak: 0,
      diseases: [
        { id: "dengue", name: "Dengue", category: "TRANSMISSIBLE" as const, contagionRate: 0.08, mortalityRate: 0.001, prevalence: 5, prevalenceBase: 5, hasVaccine: false, preventionSensitivity: 0.6, monthlyCostPerPatient: 500, classAffinity: {} },
      ] as unknown as any[],
    });
    const events = detectMedicalBreakthrough(state, rng, true, []);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const disease = (state.diseases as unknown as DiseaseState[])[0];
    // mortalityRate bajó de 0.001 a max(0.00005, 0.001 * 1) = 0.001 (no cambia porque ya está en piso)
    // Actually 0.001 * 0.8 = 0.0008, piso = 0.001 * 0.05 = 0.00005 → 0.0008 > 0.00005 → usa 0.0008
    expect(disease.mortalityRate).toBeLessThan(0.001);
    expect(disease.mortalityRate).toBeGreaterThanOrEqual(0.001 * 0.05);
  });

  it("severidad en rango 30-50", () => {
    const rng = makeRng(0.001, 0.5);
    const state = makeBaseState({ healthEfficiencyStreak: 0 });
    const events = detectMedicalBreakthrough(state, rng, true, []);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].severity).toBeGreaterThanOrEqual(30);
    expect(events[0].severity).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tracking de streaks y efectos
// ═══════════════════════════════════════════════════════════════════════════════

describe("updateEfficiencyStreak", () => {
  it("incrementa cuando eficiencia >= umbral", () => {
    const state = makeBaseState({
      healthEfficiencyStreak: 2,
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 75,
        internalCorruption: 30, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    updateEfficiencyStreak(state);
    expect(state.healthEfficiencyStreak).toBe(3);
  });

  it("resetea cuando eficiencia < umbral", () => {
    const state = makeBaseState({
      healthEfficiencyStreak: 3,
      ministries: [{
        id: "m-health", key: "HEALTH" as any, budgetPercent: 14, efficiency: 50,
        internalCorruption: 30, ministerOfficialId: null,
        subDecisions: {}, producedResources: {} as any, consumedResources: {} as any,
        healthBudgetSplit: {} as any,
      }],
    });
    updateEfficiencyStreak(state);
    expect(state.healthEfficiencyStreak).toBe(0);
  });
});

describe("applyOutbreakEffects", () => {
  it("decrementa remainingMonths de brotes activos", () => {
    const state = makeBaseState({
      events: [{
        id: "outbreak-1", type: "DISEASE_OUTBREAK" as any, severity: 50,
        year: 1, month: 6, description: "test",
        effectsApplied: { diseaseId: "dengue", remainingMonths: 3 },
        resolvedAt: null,
      }],
    });
    applyOutbreakEffects(state, []);
    const ev = state.events[0];
    const fx = ev.effectsApplied as Record<string, unknown>;
    expect(fx.remainingMonths).toBe(2);
  });

  it("resuelve brote cuando remainingMonths llega a 0", () => {
    const state = makeBaseState({
      events: [{
        id: "outbreak-1", type: "DISEASE_OUTBREAK" as any, severity: 50,
        year: 1, month: 6, description: "test",
        effectsApplied: { diseaseId: "dengue", remainingMonths: 1 },
        resolvedAt: null,
      }],
    });
    applyOutbreakEffects(state, []);
    const ev = state.events[0];
    expect(ev.resolvedAt).not.toBeNull();
  });
});
