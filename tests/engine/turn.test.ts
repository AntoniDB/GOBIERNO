import { describe, it, expect } from "vitest";
import type { GameState, TurnInput } from "@/lib/engine/types";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";
import { BALANCE } from "@/lib/balance";
import { scaleCost } from "@/lib/engine/cost-scale";
import { candidateHireCost } from "@/lib/engine/candidates";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
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
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: "off-min", producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
      { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 50, internalCorruption: 8, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
      { id: "min-agricultura", key: "agricultura", budgetPercent: 5, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
      { id: "min-educacion", key: "educacion", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} },
    ],
    officials: [
      { id: "off-min", name: "Ministro Economía", role: "MINISTER", specialty: null, ministryId: "min-economia", partyId: null, loyalty: 50, ambition: 30, wealth: 100000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 70, reputation: 60, status: "ACTIVE" },
      { id: "off-pros", name: "Fiscal General", role: "PROSECUTOR", specialty: null, ministryId: null, partyId: null, loyalty: 70, ambition: 20, wealth: 80000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 5, skill: 75, reputation: 80, status: "ACTIVE" },
      { id: "off-judge", name: "Juez Supremo", role: "JUDGE", specialty: null, ministryId: null, partyId: null, loyalty: 80, ambition: 10, wealth: 120000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 2, skill: 85, reputation: 90, status: "ACTIVE" },
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

describe("processTurn — costos fijos escalados por población", () => {
  const candidato = {
    id: "cand-1", name: "Candidato", role: "JUDGE", specialty: null, ministryId: null,
    partyId: null, loyalty: 60, ambition: 30, wealth: 50000,
    ideology: { economic: 0, social: 0, authority: 0 },
    corruption: 10, skill: 60, reputation: 50, status: "CANDIDATE",
  };
  const medio = {
    id: "med1", name: "El Diario", type: "NEWSPAPER",
    ideologicalAffinity: { economic: 0, social: 0, authority: 0 },
    reach: 30, credibility: 60, governmentAffinity: 50, status: "ACTIVE",
  };

  // Mismo turno con y sin la acción: la diferencia de tesorería es el costo.
  function costoObservado(population: number, input: TurnInput, overrides: Partial<GameState>): number {
    const base = crearEstadoBase({ population, treasury: 50_000_000_000, ...overrides });
    const sin = processTurn(base, {}, createRNG("costos"));
    const con = processTurn(base, input, createRNG("costos"));
    return sin.newState.treasury - con.newState.treasury;
  }

  it.each([10_000_000, 40_000_000])("contratar un candidato cuesta el valor escalado (pob. %i)", (population) => {
    // 1 juez ACTIVE + el contratado: el costo usa el conteo previo (1)
    const esperado = candidateHireCost(1, population);
    // El candidato contratado pasa a ACTIVE y cobra el salario base del mes
    const delta = costoObservado(
      population,
      { hireCandidateIds: ["cand-1"] },
      { officials: [...crearEstadoBase().officials, candidato as never] },
    );
    expect(delta).toBeCloseTo(esperado + BALANCE.BASE_SALARY_PER_MINISTER, 0);
  });

  it.each([10_000_000, 40_000_000])("comprar afinidad de un medio cuesta el valor escalado (pob. %i)", (population) => {
    const delta = costoObservado(
      population,
      { mediaActions: { med1: "buyAffinity" } },
      { media: [medio as never] },
    );
    expect(delta).toBeCloseTo(scaleCost(BALANCE.MEDIA_BUY_AFFINITY_COST, population), 0);
  });
});

describe("processTurn — el cliente no define costos", () => {
  const region = { id: "r1", name: "Capital", type: "URBAN", populationPercent: 100, povertyRate: 10,
    infrastructureLevel: 80, accessModifier: 0.2, povertyModifier: 0.8,
    healthCoverage: { primary: { facilities: 1, beds: 10, operationalCost: 0 }, secondary: { facilities: 0, beds: 0, operationalCost: 0 }, tertiary: { facilities: 0, beds: 0, operationalCost: 0 } } };
  const run = (input: unknown, overrides: Partial<GameState> = {}) =>
    processTurn(crearEstadoBase({ regions: [region] as never, ...overrides }), input as TurnInput, createRNG("cliente"));

  it("una obra con costo negativo y duración 1 se crea con los valores del motor", () => {
    const out = run({ newLongRunningDecisions: [{
      type: "HOSPITAL_CONSTRUCTION", monthlyCost: -9e12, totalMonths: 1,
      parameters: { regionId: "r1", level: "primary" },
    }] });
    const lrd = out.newState.longRunningDecisions[0];
    expect(lrd.monthlyCost).toBe(BALANCE.HOSPITAL_COSTS.primary);
    expect(lrd.totalMonths).toBe(BALANCE.HOSPITAL_DURATIONS.primary);
  });

  it("una decisión inválida se descarta y el jugador recibe un aviso", () => {
    const out = run({ newLongRunningDecisions: [{ type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "zzz", level: "primary" } }] });
    expect(out.newState.longRunningDecisions).toEqual([]);
    expect(out.notifications.some((n) => n.title === "Decisión rechazada" && n.description.includes("región inexistente"))).toBe(true);
  });

  it("un programa con costo negativo se crea con el costo del motor", () => {
    const out = run({ newPrograms: [{ type: "PREVENTION_EDUCATION", monthlyCost: -9e12 }] });
    expect(out.newState.programs[0].monthlyCost).toBe(BALANCE.PROGRAM_PREVENTION_COST);
  });

  it("un programa inválido se descarta y el jugador recibe un aviso", () => {
    const out = run({ newPrograms: [{ type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: "nope" } }] });
    expect(out.newState.programs).toEqual([]);
    expect(out.notifications.some((n) => n.title === "Programa rechazado")).toBe(true);
  });

  it.each([[-5e9, 50_000_000], [0, 50_000_000], [9e15, 500_000_000], [120_000_000, 120_000_000]])(
    "un organismo pedido con presupuesto %s queda en %s (pob. 50M)",
    (pedido, esperado) => {
      const out = run({ newOrganisms: { COMPTROLLER: { name: "C", monthlyBudget: pedido } } }, { population: 50_000_000 });
      expect(out.newState.organisms[0].monthlyBudget).toBe(esperado);
    },
  );
});
