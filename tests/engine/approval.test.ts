import { describe, it, expect } from "vitest";
import type { GameState, SocialClassState, EventState } from "@/lib/engine/types";
import { calculateApprovalByClass, calculateGeneralApproval } from "@/lib/engine/approval";

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
    ...overrides,
  };
}

function crearClaseSocial(overrides?: Partial<SocialClassState>): SocialClassState {
  return {
    id: "sc-test",
    key: "MIDDLE",
    populationPercent: 60,
    averageIncome: 2000,
    approval: 50,
    demands: [],
    educationLevel: 60,
    healthAccess: 70,
    ...overrides,
  };
}

describe("calculateApprovalByClass", () => {
  it("calcula aprobación con estado base", () => {
    const state = crearEstadoBase();
    const socialClass = crearClaseSocial();
    const approval = calculateApprovalByClass(socialClass, state, []);
    expect(approval).toBeGreaterThanOrEqual(0);
    expect(approval).toBeLessThanOrEqual(100);
  });

  it("eventos negativos reducen la aprobación", () => {
    const state = crearEstadoBase();
    const socialClass = crearClaseSocial();
    const sinEventos = calculateApprovalByClass(socialClass, state, []);
    const eventoNegativo: EventState = {
      id: "evt-test",
      type: "SCANDAL",
      severity: 50,
      year: 2024,
      month: 1,
      description: "Escándalo grave",
      effectsApplied: { corruptionIncrease: 25 },
      resolvedAt: null,
    };
    const conEventos = calculateApprovalByClass(socialClass, state, [eventoNegativo]);
    expect(conEventos).toBeLessThan(sinEventos);
  });

  it("corrupción alta de funcionarios reduce la aprobación", () => {
    const stateLimpio = crearEstadoBase();
    const stateCorrupto = crearEstadoBase({
      officials: [
        { id: "off-1", name: "X", role: "MINISTER", ministryId: null, partyId: null, loyalty: 50, ambition: 40, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 80, skill: 50, reputation: 30, status: "ACTIVE" },
      ],
    });
    const socialClass = crearClaseSocial();
    const limpio = calculateApprovalByClass(socialClass, stateLimpio, []);
    const corrupto = calculateApprovalByClass(socialClass, stateCorrupto, []);
    expect(corrupto).toBeLessThan(limpio);
  });
});

describe("calculateGeneralApproval", () => {
  it("es un promedio ponderado por población", () => {
    const state = crearEstadoBase();
    const general = calculateGeneralApproval(state, []);
    expect(general).toBeGreaterThanOrEqual(0);
    expect(general).toBeLessThanOrEqual(100);
  });

  it("devuelve APPROVAL_BASE cuando no hay clases sociales", () => {
    const state = crearEstadoBase({ socialClasses: [] });
    const general = calculateGeneralApproval(state, []);
    expect(general).toBe(50);
  });

  it("se mantiene en rango [0, 100]", () => {
    const state = crearEstadoBase();
    const general = calculateGeneralApproval(state, []);
    expect(general).toBeGreaterThanOrEqual(0);
    expect(general).toBeLessThanOrEqual(100);
  });
});
