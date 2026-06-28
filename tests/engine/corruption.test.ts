import { describe, it, expect } from "vitest";
import type { GameState, OfficialState } from "@/lib/engine/types";
import { updateOfficialCorruption, calculateGlobalCorruption } from "@/lib/engine/corruption";
import { BALANCE } from "@/lib/balance";

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
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: "off-min" },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [],
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

function crearFuncionario(overrides?: Partial<OfficialState>): OfficialState {
  return {
    id: "off-1",
    name: "Funcionario X",
    role: "MINISTER",
    ministryId: "min-economia",
    partyId: null,
    loyalty: 50,
    ambition: 40,
    wealth: 50000,
    ideology: { economic: 0, social: 0, authority: 0 },
    corruption: 20,
    skill: 60,
    reputation: 50,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("updateOfficialCorruption", () => {
  it("sin organismos de control, la corrupción debe aumentar", () => {
    const state = crearEstadoBase({ organisms: [], judicialCases: [] });
    const official = crearFuncionario({ corruption: 20 });
    const nueva = updateOfficialCorruption(official, state);
    expect(nueva).toBeGreaterThan(official.corruption);
  });

  it("con Contraloría activa, la corrupción debe reducirse respecto al aumento base", () => {
    const state = crearEstadoBase({
      organisms: [
        { id: "org-comp", type: "COMPTROLLER", name: "Contraloría", monthlyBudget: 10000, staff: 20, effectiveness: 80, autonomyLevel: 50, headOfficialId: null },
      ],
      judicialCases: [],
    });
    const official = crearFuncionario({ corruption: 20, ministryId: null });
    const nueva = updateOfficialCorruption(official, state);
    // sin control: 20 + 1.5 = 21.5
    // con contraloría 80%: reducción = 3 * 0.8 = 2.4
    // nueva = 20 + 1.5 - 2.4 = 19.1
    expect(nueva).toBeLessThan(20 + BALANCE.CORRUPTION_BASE_INCREASE);
  });

  it("con Fiscalía Anticorrupción y Contraloría, la reducción es mayor", () => {
    const state = crearEstadoBase({
      organisms: [
        { id: "org-comp", type: "COMPTROLLER", name: "Contraloría", monthlyBudget: 10000, staff: 20, effectiveness: 80, autonomyLevel: 50, headOfficialId: null },
        { id: "org-anti", type: "ANTICORRUPTION_PROSECUTION", name: "Fiscalía AC", monthlyBudget: 15000, staff: 15, effectiveness: 70, autonomyLevel: 50, headOfficialId: null },
      ],
      judicialCases: [],
    });
    const official = crearFuncionario({ corruption: 20, ministryId: null });
    const nueva = updateOfficialCorruption(official, state);
    // reducción = 3*0.8 + 2*0.7 = 2.4 + 1.4 = 3.8
    // nueva = 20 + 1.5 - 3.8 = 17.7
    expect(nueva).toBeCloseTo(20 + BALANCE.CORRUPTION_BASE_INCREASE - 3 * 0.8 - 2 * 0.7, 5);
  });

  it("presupuestos altos incrementan la corrupción adicionalmente", () => {
    const state = crearEstadoBase({
      ministries: [
        { id: "min-economia", key: "economia", budgetPercent: 30, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: "off-min" },
      ],
      organisms: [],
      judicialCases: [],
    });
    const official = crearFuncionario({ corruption: 20, ministryId: "min-economia" });
    const nueva = updateOfficialCorruption(official, state);
    // aumento base 1.5 + (30-20) * 0.1 = 1.5 + 1.0 = 2.5
    expect(nueva).toBe(20 + 1.5 + (30 - 20) * BALANCE.CORRUPTION_BUDGET_FACTOR);
  });

  it("casos judiciales activos generan efecto disuasivo", () => {
    const state = crearEstadoBase({
      organisms: [],
      judicialCases: [
        { id: "case-1", defendantOfficialId: "other", caseType: "CORRUPTION", currentPhase: "INVESTIGATION", monthsInPhase: 2, evidenceStrength: 50, prosecutorId: null, judgeId: null, verdict: null, sentenceMonths: null },
        { id: "case-2", defendantOfficialId: "other2", caseType: "CORRUPTION", currentPhase: "TRIAL", monthsInPhase: 1, evidenceStrength: 60, prosecutorId: null, judgeId: null, verdict: null, sentenceMonths: null },
      ],
    });
    const official = crearFuncionario({ corruption: 20, ministryId: null });
    const nueva = updateOfficialCorruption(official, state);
    // reducción por disuasión = 0.5 * 2 = 1.0
    expect(nueva).toBe(20 + BALANCE.CORRUPTION_BASE_INCREASE - BALANCE.CORRUPTION_DETERRENCE_BY_CASES * 2);
  });

  it("se mantiene en rango [0, 100]", () => {
    const state = crearEstadoBase({ organisms: [], judicialCases: [] });
    const officialBajo = crearFuncionario({ corruption: 0, ministryId: null });
    const officialAlto = crearFuncionario({ corruption: 99, ministryId: null });
    expect(updateOfficialCorruption(officialBajo, state)).toBeGreaterThanOrEqual(0);
    expect(updateOfficialCorruption(officialBajo, state)).toBeLessThanOrEqual(100);
    expect(updateOfficialCorruption(officialAlto, state)).toBeGreaterThanOrEqual(0);
    expect(updateOfficialCorruption(officialAlto, state)).toBeLessThanOrEqual(100);
  });
});

describe("calculateGlobalCorruption", () => {
  it("devuelve 0 cuando no hay funcionarios", () => {
    expect(calculateGlobalCorruption([])).toBe(0);
  });

  it("calcula promedio ponderado (ministros pesan 3x)", () => {
    const officials: OfficialState[] = [
      crearFuncionario({ corruption: 30, role: "MINISTER" }),
      crearFuncionario({ id: "off-2", name: "Asesor", corruption: 10, role: "ADVISOR", ministryId: null }),
      crearFuncionario({ id: "off-3", name: "Director", corruption: 20, role: "DIRECTOR", ministryId: null }),
    ];
    // pesos: 3 + 1 + 1 = 5
    // suma: 30*3 + 10*1 + 20*1 = 90 + 10 + 20 = 120
    // promedio = 120 / 5 = 24
    expect(calculateGlobalCorruption(officials)).toBe(24);
  });
});
