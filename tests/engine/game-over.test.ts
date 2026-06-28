import { describe, it, expect } from "vitest";
import { checkGameOverConditions, canBeAssassinated, electionResult } from "@/lib/engine/game-over";
import type { GameState, EventState } from "@/lib/engine/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    countryName: "Testlandia",
    currentYear: 1,
    currentMonth: 1,
    treasury: 5_000_000_000,
    population: 10_000_000,
    seed: "test-game-over",
    gdp: 100_000_000_000,
    povertyRate: 10,
    unemploymentRate: 5,
    sickRate: 2,
    crimeRate: 8,
    foodSecurity: 85,
    educationLevel: 60,
    inflation: 3,
    lifeExpectancy: 68,
    ministries: [
      { id: "m-def", key: "DEFENSE", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: "off-1" },
      { id: "m-soc", key: "SOCIAL_DEVELOPMENT", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-hea", key: "HEALTH", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-edu", key: "EDUCATION", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-eco", key: "ECONOMY", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-sec", key: "SECURITY", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-jus", key: "JUSTICE", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-agr", key: "AGRICULTURE", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [
      { id: "off-1", name: "Test", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 60, ambition: 30, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 70, reputation: 50, status: "ACTIVE" },
    ],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc-ep", key: "EXTREME_POVERTY", populationPercent: 100, averageIncome: 100, approval: 50, demands: [], educationLevel: 10, healthAccess: 20 },
    ],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 65,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
    },
    media: [],
    events: [],
    longRunningDecisions: [],
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

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Evento PROTEST: en EXTREME_POVERTY baja aprobacion severidad*1.6 */
function protest(severity: number, year = 1, month = 1): EventState {
  return {
    id: `protest-${severity}`, type: "PROTEST", severity, year, month,
    description: "Protesta", effectsApplied: {}, resolvedAt: null,
  };
}

/**
 * Config para aprobacion ~17 (entre 10 y 25):
 * - 1 oficial corruption=60 → penalty=12
 * - PROTEST severidad=13 → impacto=13*1.6=20.8 en EXTREME_POVERTY
 * - approval = 50-12-20.8 = 17.2
 */
function cfgModerate(overrides: Partial<GameState> = {}): GameState {
  return baseState({
    officials: [{ id: "off-x", name: "Golpista", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 10, ambition: 90, wealth: 500000, ideology: { economic: 0, social: 0, authority: 80 }, corruption: 60, skill: 50, reputation: 20, status: "ACTIVE" }],
    events: [protest(13)],
    ...overrides,
  });
}

/**
 * Config para aprobacion ~0 (por debajo de 10):
 * - 1 oficial corruption=95 → penalty=19
 * - PROTEST severidad=100 → impacto=100*1.6=160
 * - approval clamped to 0
 */
function cfgCritical(overrides: Partial<GameState> = {}): GameState {
  return baseState({
    officials: [{ id: "off-x", name: "Corrupto", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 10, ambition: 90, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 95, skill: 30, reputation: 10, status: "ACTIVE" }],
    events: [protest(100)],
    ...overrides,
  });
}

describe("checkGameOverConditions", () => {
  it("devuelve null para un estado sano", () => {
    const state = baseState();
    const result = checkGameOverConditions(state);
    expect(result).toBeNull();
  });

  it("detecta estado fallido (crimen >80, corrupcion >80, aprobacion <15)", () => {
    const state = cfgCritical({ crimeRate: 85 });
    const result = checkGameOverConditions(state);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("estado_fallido");
  });

  it("detecta golpe de estado con factores multiples en crisis", () => {
    // subordinacion baja (20), aprobacion baja (~17), corrupcion alta (60)
    // + defensa baja (eff=10, budget=10%) → coupRisk > 50
    const state = cfgModerate({
      regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 65, politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 20 },
    });
    state.ministries.find((m) => m.key === "DEFENSE")!.efficiency = 10;
    const result = checkGameOverConditions(state);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("golpe_estado");
  });

  it("no detecta golpe si subordinacion militar es alta aunque defensa sea debil", () => {
    // subordinacion alta (80), aunque aprobacion baja y defensa debil → coupRisk < 50
    const state = cfgModerate({
      regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 65, politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 80 },
    });
    state.ministries.find((m) => m.key === "DEFENSE")!.efficiency = 10;
    const result = checkGameOverConditions(state);
    expect(result).toBeNull();
  });

  it("detecta juicio politico via notification", () => {
    const state = baseState();
    const result = checkGameOverConditions(state, undefined, [
      { type: "juicio_politico", title: "Juicio politico" } as const,
    ]);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("juicio_politico");
  });

  it("detecta renuncia forzada (aprobacion <10, 6 meses consecutivos)", () => {
    // Baja aprobacion pero sin condiciones de golpe (subordinacion alta, corrupcion baja)
    const state = baseState({
      consecutiveLowApprovalMonths: 6,
      regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 65, politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 90 },
      officials: [
        { id: "off-x", name: "Impopular", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 10, ambition: 90, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 80, skill: 30, reputation: 10, status: "ACTIVE" },
      ],
      events: [protest(80)],
    });
    const result = checkGameOverConditions(state, { electionIntervalYears: 5, termLimit: 2, consecutiveLowApprovalMonths: 6 });
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("renuncia_forzada");
  });

  it("no detecta renuncia forzada si meses < 6", () => {
    const state = baseState({
      consecutiveLowApprovalMonths: 3,
      regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 65, politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 90 },
      officials: [
        { id: "off-x", name: "Impopular", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 10, ambition: 90, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 80, skill: 30, reputation: 10, status: "ACTIVE" },
      ],
      events: [protest(80)],
    });
    const result = checkGameOverConditions(state, { electionIntervalYears: 5, termLimit: 2, consecutiveLowApprovalMonths: 6 });
    expect(result).toBeNull();
  });

  it("pierde eleccion si votos < 50% (anio 6, mes 0)", () => {
    const state = baseState({
      currentYear: 6,
      currentMonth: 0,
      officials: [
        { id: "off-1", name: "Corrupto", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 10, ambition: 90, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 20, skill: 50, reputation: 20, status: "ACTIVE" },
      ],
      socialClasses: [
        { id: "sc-ep", key: "EXTREME_POVERTY", populationPercent: 30, averageIncome: 100, approval: 50, demands: [], educationLevel: 10, healthAccess: 20 },
        { id: "sc-p", key: "POVERTY", populationPercent: 30, averageIncome: 300, approval: 50, demands: [], educationLevel: 20, healthAccess: 35 },
        { id: "sc-m", key: "MIDDLE", populationPercent: 30, averageIncome: 1000, approval: 50, demands: [], educationLevel: 40, healthAccess: 50 },
        { id: "sc-e", key: "ELITE", populationPercent: 10, averageIncome: 10000, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
      ],
    });
    const result = checkGameOverConditions(state);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("perdida_electoral");
  });

  it("gana eleccion si votos >= 50% (anio 6, mes 0)", () => {
    // Sin corrupcion y con ley de transparencia que sube aprobacion a clase media
    const state = baseState({
      currentYear: 6,
      currentMonth: 0,
      officials: [
        { id: "off-1", name: "Honesto", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 80, ambition: 20, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 0, skill: 70, reputation: 80, status: "ACTIVE" },
      ],
      activeLaws: [
        { id: "law-sub", key: "subsidio-alimentario", activatedAt: new Date().toISOString(), effectsJson: { approval: { EXTREME_POVERTY: 8, POVERTY: 4 } } },
      ],
      socialClasses: [
        { id: "sc-ep", key: "EXTREME_POVERTY", populationPercent: 30, averageIncome: 100, approval: 50, demands: [], educationLevel: 10, healthAccess: 20 },
        { id: "sc-p", key: "POVERTY", populationPercent: 30, averageIncome: 300, approval: 50, demands: [], educationLevel: 20, healthAccess: 35 },
        { id: "sc-m", key: "MIDDLE", populationPercent: 30, averageIncome: 1000, approval: 50, demands: [], educationLevel: 40, healthAccess: 50 },
        { id: "sc-e", key: "ELITE", populationPercent: 10, averageIncome: 10000, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
      ],
    });
    const result = checkGameOverConditions(state);
    expect(result).toBeNull();
  });
});

describe("canBeAssassinated", () => {
  it("devuelve null sin inteligencia presente", () => {
    const state = cfgCritical();
    const rng = () => 0.01;
    const result = canBeAssassinated(state, rng);
    expect(result).toBeNull();
  });

  it("devuelve null si inteligencia tiene autonomia alta", () => {
    const state = cfgCritical({
      organisms: [{ id: "org-int", type: "INTELLIGENCE", name: "Intel", monthlyBudget: 100000, staff: 10, effectiveness: 50, autonomyLevel: 80, headOfficialId: null }],
    });
    const rng = () => 0.01;
    const result = canBeAssassinated(state, rng);
    expect(result).toBeNull();
  });

  it("detecta asesinato con baja aprobacion + inteligencia politizada + suerte baja", () => {
    const state = cfgCritical({
      organisms: [{ id: "org-int", type: "INTELLIGENCE", name: "Intel", monthlyBudget: 100000, staff: 10, effectiveness: 50, autonomyLevel: 20, headOfficialId: null }],
    });
    const rng = () => 0.01;
    const result = canBeAssassinated(state, rng);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("asesinato");
  });
});

describe("electionResult", () => {
  it("calcula votos ponderados por poblacion", () => {
    const state = baseState({
      officials: [
        { id: "off-1", name: "Honesto", role: "GENERAL", ministryId: "m-def", partyId: null, loyalty: 80, ambition: 20, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 0, skill: 70, reputation: 80, status: "ACTIVE" },
      ],
      socialClasses: [
        { id: "sc-ep", key: "EXTREME_POVERTY", populationPercent: 25, averageIncome: 100, approval: 50, demands: [], educationLevel: 10, healthAccess: 20 },
        { id: "sc-p", key: "POVERTY", populationPercent: 35, averageIncome: 300, approval: 40, demands: [], educationLevel: 20, healthAccess: 35 },
        { id: "sc-m", key: "MIDDLE", populationPercent: 30, averageIncome: 1000, approval: 60, demands: [], educationLevel: 40, healthAccess: 50 },
        { id: "sc-e", key: "ELITE", populationPercent: 10, averageIncome: 10000, approval: 55, demands: [], educationLevel: 80, healthAccess: 90 },
      ],
    });
    const result = electionResult(state);
    expect(result.votePercent).toBeCloseTo(48.6, 0);
    expect(result.winner).toBe(false);
    expect(result.perClassVotes["EXTREME_POVERTY"]).toBeDefined();
    expect(result.perClassVotes["MIDDLE"]).toBeDefined();
  });

  it("devuelve winner false con baja aprobacion", () => {
    const state = baseState({
      socialClasses: [
        { id: "sc-ep", key: "EXTREME_POVERTY", populationPercent: 40, averageIncome: 100, approval: 50, demands: [], educationLevel: 10, healthAccess: 20 },
        { id: "sc-p", key: "POVERTY", populationPercent: 30, averageIncome: 300, approval: 10, demands: [], educationLevel: 20, healthAccess: 35 },
        { id: "sc-m", key: "MIDDLE", populationPercent: 20, averageIncome: 1000, approval: 20, demands: [], educationLevel: 40, healthAccess: 50 },
        { id: "sc-e", key: "ELITE", populationPercent: 10, averageIncome: 10000, approval: 20, demands: [], educationLevel: 80, healthAccess: 90 },
      ],
    });
    const result = electionResult(state);
    expect(result.winner).toBe(false);
    expect(result.votePercent).toBeLessThan(50);
  });
});
