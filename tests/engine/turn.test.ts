import { describe, it, expect } from "vitest";
import type { GameState, TurnInput } from "@/lib/engine/types";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";

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
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 50, internalCorruption: 8, subDecisions: {}, ministerOfficialId: null },
      { id: "min-agricultura", key: "agricultura", budgetPercent: 5, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-educacion", key: "educacion", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [
      { id: "off-min", name: "Ministro Economía", role: "MINISTER", ministryId: "min-economia", partyId: null, loyalty: 50, ambition: 30, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 70, reputation: 60, status: "ACTIVE" },
      { id: "off-pros", name: "Fiscal General", role: "PROSECUTOR", ministryId: null, partyId: null, loyalty: 70, ambition: 20, wealth: 80000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 5, skill: 75, reputation: 80, status: "ACTIVE" },
      { id: "off-judge", name: "Juez Supremo", role: "JUDGE", ministryId: null, partyId: null, loyalty: 80, ambition: 10, wealth: 120000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 2, skill: 85, reputation: 90, status: "ACTIVE" },
    ],
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

describe("processTurn", () => {
  it("procesa un turno con un GameState mínimo", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {};
    const rng = createRNG("turn-minimo");
    const output = processTurn(state, input, rng);
    expect(output).toHaveProperty("newState");
    expect(output).toHaveProperty("monthSnapshot");
    expect(output).toHaveProperty("notifications");
    expect(output).toHaveProperty("newEvents");
    expect(output).toHaveProperty("mediaCoverages");
  });

  it("el snapshot contiene año y mes correctos", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {};
    const rng = createRNG("turn-snapshot");
    const output = processTurn(state, input, rng);
    expect(output.monthSnapshot.year).toBe(2024);
    expect(output.monthSnapshot.month).toBe(1);
  });

  it("es determinista: mismo estado + misma semilla = mismo output", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {};
    const rng1 = createRNG("det-turn");
    const rng2 = createRNG("det-turn");
    const out1 = processTurn(state, input, rng1);
    const out2 = processTurn(state, input, rng2);
    // El newState clonado debería ser idéntico en corrupción, eficiencia, etc.
    expect(out1.newState.treasury).toEqual(out2.newState.treasury);
    expect(out1.monthSnapshot).toEqual(out2.monthSnapshot);
    expect(out1.newEvents.map(e => e.id)).toEqual(out2.newEvents.map(e => e.id));
  });

  it("la tesorería cambia después de un turno", () => {
    const state = crearEstadoBase({ treasury: 1000000 });
    const input: TurnInput = {};
    const rng = createRNG("turn-treasury");
    const output = processTurn(state, input, rng);
    // Con population=10M, income positivo y expenses de ministerios,
    // la tesorería debería cambiar
    expect(output.newState.treasury).not.toBe(1000000);
  });

  it("aplica ajustes de presupuesto del input", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {
      budgetAdjustments: { economia: 25 },
    };
    const rng = createRNG("turn-budget");
    const output = processTurn(state, input, rng);
    const minEconomia = output.newState.ministries.find(m => m.key === "economia");
    expect(minEconomia?.budgetPercent).toBe(25);
  });

  it("no lanza excepción con input vacío", () => {
    const state = crearEstadoBase();
    const rng = createRNG("turn-no-exception");
    expect(() => processTurn(state, {}, rng)).not.toThrow();
  });

  it("devuelve notificaciones de tipo array", () => {
    const state = crearEstadoBase();
    const rng = createRNG("turn-notif");
    const output = processTurn(state, {}, rng);
    expect(Array.isArray(output.notifications)).toBe(true);
  });
});
