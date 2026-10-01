import { describe, it, expect } from "vitest";
import { BALANCE } from "@/lib/balance";
import type { GameState, TurnInput, LongRunningDecisionState } from "@/lib/engine/types";
import {
  advanceDecisions,
  createNewDecisions,
  applyDecisionEffects,
} from "@/lib/engine/long-running-decisions";

function crearEstadoBase(
  overrides?: Partial<GameState>,
  lrds?: LongRunningDecisionState[]
): GameState {
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
    currentMonth: 6,
    treasury: 1000000,
    population: 10000000,
    seed: "test-seed",
    gdp: 30000000000,
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
      powerConcentration: 30, pressFreedom: 80, judicialIndependence: 80,
      politicalPluralism: 80, civilLiberties: 80, transparency: 75, militarySubordination: 85,
    },
    media: [],
    events: [],
    longRunningDecisions: lrds ?? [],
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
    id: "lrd-test-1",
    type: "OBRA_DE_PRUEBA",
    name: "Obra de Prueba",
    monthsRemaining: 6,
    totalMonths: 6,
    monthlyCost: 100000,
    parameters: {},
    status: "IN_PROGRESS",
    startedAt: "2024-06-01T00:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    progressLog: [],
    effectOnCompletion: {},
    ...overrides,
  };
}

function emptyInput(): TurnInput {
  return {};
}

describe("advanceDecisions", () => {
  it("decrementa monthsRemaining cada mes", () => {
    const state = crearEstadoBase({}, [crearLrd({ monthsRemaining: 6 })]);
    const result = advanceDecisions(state, emptyInput());
    expect(result.updatedDecisions[0].monthsRemaining).toBe(5);
    expect(result.updatedDecisions[0].status).toBe("IN_PROGRESS");
  });

  it("marca COMPLETED cuando monthsRemaining llega a 0", () => {
    const state = crearEstadoBase({}, [crearLrd({ monthsRemaining: 1, totalMonths: 3 })]);
    const result = advanceDecisions(state, emptyInput());
    expect(result.updatedDecisions[0].monthsRemaining).toBe(0);
    expect(result.updatedDecisions[0].status).toBe("COMPLETED");
    expect(result.updatedDecisions[0].completedAt).not.toBeNull();
    expect(result.completed).toHaveLength(1);
  });

  it("desc cuenta monthlyCost del tesoro por cada LRD activa", () => {
    const state = crearEstadoBase({ treasury: 500000 }, [
      crearLrd({ monthsRemaining: 3, monthlyCost: 100000 }),
      crearLrd({ id: "lrd-test-2", monthsRemaining: 5, monthlyCost: 50000 }),
    ]);
    const result = advanceDecisions(state, emptyInput());
    expect(result.totalCost).toBe(150000);
  });

  it("cancela LRD cuando el jugador lo ordena", () => {
    const state = crearEstadoBase({}, [crearLrd({ monthsRemaining: 4 })]);
    const input: TurnInput = { cancelDecisionIds: ["lrd-test-1"] };
    const result = advanceDecisions(state, input);
    expect(result.updatedDecisions[0].status).toBe("CANCELLED");
    expect(result.updatedDecisions[0].cancelledAt).not.toBeNull();
    expect(result.cancelled).toHaveLength(1);
  });

  it("no avanza LRD ya completadas o canceladas", () => {
    const state = crearEstadoBase({}, [
      crearLrd({ id: "lrd-completed", status: "COMPLETED", monthsRemaining: 0, completedAt: "2024-05-01T00:00:00.000Z" }),
      crearLrd({ id: "lrd-cancelled", status: "CANCELLED", monthsRemaining: 3, cancelledAt: "2024-05-01T00:00:00.000Z" }),
    ]);
    const result = advanceDecisions(state, emptyInput());
    expect(result.updatedDecisions[0].status).toBe("COMPLETED");
    expect(result.updatedDecisions[1].status).toBe("CANCELLED");
    // No cambian monthsRemaining
    expect(result.updatedDecisions[1].monthsRemaining).toBe(3);
    // Sin costo (ya terminadas)
    expect(result.totalCost).toBe(0);
  });

  it("maneja multiples LRD concurrentes correctamente", () => {
    const lrds = [
      crearLrd({ id: "lrd-1", monthsRemaining: 1, monthlyCost: 100000 }),
      crearLrd({ id: "lrd-2", monthsRemaining: 6, monthlyCost: 50000 }),
      crearLrd({ id: "lrd-3", monthsRemaining: 3, monthlyCost: 75000 }),
    ];
    const state = crearEstadoBase({}, lrds);
    const result = advanceDecisions(state, emptyInput());

    expect(result.updatedDecisions).toHaveLength(3);
    // lrd-1 completa
    expect(result.updatedDecisions[0].status).toBe("COMPLETED");
    expect(result.updatedDecisions[0].monthsRemaining).toBe(0);
    // lrd-2 y lrd-3 en progreso
    expect(result.updatedDecisions[1].monthsRemaining).toBe(5);
    expect(result.updatedDecisions[2].monthsRemaining).toBe(2);
    // costo total
    expect(result.totalCost).toBe(225000);
    expect(result.completed).toHaveLength(1);
  });
});

describe("createNewDecisions (el cliente solo elige tipo y parámetros)", () => {
  const region = { id: "r1", name: "Capital", type: "URBAN", populationPercent: 50, povertyRate: 10,
    infrastructureLevel: 80, accessModifier: 0.2, povertyModifier: 0.8,
    healthCoverage: { primary: { facilities: 1, beds: 10, operationalCost: 0 }, secondary: { facilities: 0, beds: 0, operationalCost: 0 }, tertiary: { facilities: 0, beds: 0, operationalCost: 0 } } };
  const disease = (id: string, name: string) => ({ id, name, category: "TRANSMISSIBLE", contagionRate: 0.1, mortalityRate: 0.01,
    prevalence: 5, prevalenceBase: 5, hasVaccine: false, preventionSensitivity: 0.5, monthlyCostPerPatient: 100, classAffinity: {} });
  const estado = (pop = 10_000_000) => crearEstadoBase({
    currentYear: 2024, currentMonth: 6, population: pop,
    regions: [region] as never,
    diseases: [disease("d1", "Gripe"), disease("d2", "Dengue"), disease("d3", "TB")] as never,
  });
  const crear = (request: Record<string, unknown>, state = estado()) =>
    createNewDecisions(state, { newLongRunningDecisions: [request as never] });

  it("crea un hospital con nombre, duración y costo fijados por el motor", () => {
    const { decisions, rejections } = crear({ type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "secondary" } });
    expect(rejections).toEqual([]);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      id: "lrd-2024-6-0",
      type: "HOSPITAL_CONSTRUCTION",
      name: "Construcción hospital secondary — Capital",
      totalMonths: BALANCE.HOSPITAL_DURATIONS.secondary,
      monthsRemaining: BALANCE.HOSPITAL_DURATIONS.secondary,
      monthlyCost: BALANCE.HOSPITAL_COSTS.secondary,
      status: "IN_PROGRESS",
      parameters: { regionId: "r1", level: "secondary" },
      effectOnCompletion: {},
    });
    expect(decisions[0].progressLog).toHaveLength(1);
  });

  it("ignora el costo, la duración, el nombre y los efectos que envíe el cliente", () => {
    const { decisions } = crear({
      type: "HOSPITAL_CONSTRUCTION", name: "Gratis", totalMonths: 1, monthlyCost: -9_999_999_999,
      effectOnCompletion: { treasury: 1e12 }, parameters: { regionId: "r1", level: "primary", extra: "x" },
    });
    expect(decisions[0].monthlyCost).toBe(BALANCE.HOSPITAL_COSTS.primary);
    expect(decisions[0].totalMonths).toBe(BALANCE.HOSPITAL_DURATIONS.primary);
    expect(decisions[0].name).not.toBe("Gratis");
    expect(decisions[0].effectOnCompletion).toEqual({});
    expect(decisions[0].parameters).toEqual({ regionId: "r1", level: "primary" });
  });

  it("escala el costo con la población del estado", () => {
    const { decisions } = crear({ type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "tertiary" } }, estado(40_000_000));
    expect(decisions[0].monthlyCost).toBe(BALANCE.HOSPITAL_COSTS.tertiary * 4);
  });

  it("investigación médica: nombre y parámetros salen del estado", () => {
    const { decisions } = crear({ type: "MEDICAL_RESEARCH", parameters: { diseaseIds: ["d1", "d2", "d1"] } });
    expect(decisions[0].name).toBe("Investigación médica — Gripe, Dengue");
    expect(decisions[0].parameters).toEqual({ diseaseIds: ["d1", "d2"] });
    expect(decisions[0].totalMonths).toBe(BALANCE.MEDICAL_RESEARCH_DURATION);
    expect(decisions[0].monthlyCost).toBe(BALANCE.MEDICAL_RESEARCH_COST);
  });

  it.each([
    ["tipo desconocido", { type: "OBRA_DE_PRUEBA", monthlyCost: 1 }, "tipo de decisión no reconocido"],
    ["sin tipo", {}, "tipo de decisión no reconocido"],
    ["nivel inválido", { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "mega" } }, "nivel de hospital inválido"],
    ["nivel heredado de Object (constructor)", { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "constructor" } }, "nivel de hospital inválido"],
    ["región inexistente", { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "zzz", level: "primary" } }, "región inexistente"],
    ["sin parámetros", { type: "HOSPITAL_CONSTRUCTION" }, "nivel de hospital inválido"],
    ["enfermedad inexistente", { type: "MEDICAL_RESEARCH", parameters: { diseaseIds: ["nope"] } }, "enfermedad inexistente"],
    ["diseaseIds no es un arreglo", { type: "MEDICAL_RESEARCH", parameters: { diseaseIds: "d1" } }, "enfermedad inexistente"],
    ["más de 2 enfermedades", { type: "MEDICAL_RESEARCH", parameters: { diseaseIds: ["d1", "d2", "d3"] } }, "máximo 2"],
  ])("rechaza: %s", (_nombre, request, motivo) => {
    const { decisions, rejections } = crear(request);
    expect(decisions).toEqual([]);
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toContain(motivo);
  });

  it("las rechazadas no consumen el índice de los ids de las válidas", () => {
    const { decisions, rejections } = createNewDecisions(estado(), {
      newLongRunningDecisions: [
        { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "zzz", level: "primary" } },
        { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "primary" } },
        { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: "r1", level: "secondary" } },
      ],
    });
    expect(rejections).toHaveLength(1);
    expect(decisions.map((d) => d.id)).toEqual(["lrd-2024-6-0", "lrd-2024-6-1"]);
  });

  it("devuelve vacío si no hay newLongRunningDecisions", () => {
    expect(createNewDecisions(crearEstadoBase(), emptyInput())).toEqual({ decisions: [], rejections: [] });
  });
});

describe("applyDecisionEffects", () => {
  it("OBRA_DE_PRUEBA no modifica el estado (no-op)", () => {
    const state = crearEstadoBase();
    const treasuryBefore = state.treasury;
    const completed = [crearLrd({ status: "COMPLETED", monthsRemaining: 0 })];
    applyDecisionEffects(completed, state);
    // No-op: el estado no cambia
    expect(state.treasury).toBe(treasuryBefore);
  });

  it("aplica efectos si el tipo lo requiere (placeholder para futuros tipos)", () => {
    const state = crearEstadoBase();
    const completed = [
      crearLrd({ id: "lrd-future", type: "OBRA_DE_PRUEBA", status: "COMPLETED", monthsRemaining: 0 }),
    ];
    // No deberia lanzar errores para tipos desconocidos
    expect(() => applyDecisionEffects(completed, state)).not.toThrow();
  });
});

describe("flujo completo LRD", () => {
  it("crear → avanzar hasta completar → verificar efectos", () => {
    const state = crearEstadoBase({
      currentYear: 2024,
      currentMonth: 1,
      treasury: 2_000_000,
    });

    // Una LRD recién creada (la creación por input se prueba aparte)
    const newLrds = [crearLrd({ id: "lrd-2024-1-0", name: "Proyecto de 3 meses", monthsRemaining: 3, totalMonths: 3, monthlyCost: 100_000 })];
    expect(newLrds[0].monthsRemaining).toBe(3);

    // Mes 1: avanzar
    const stateMes1 = { ...state, longRunningDecisions: newLrds };
    const r1 = advanceDecisions(stateMes1, emptyInput());
    expect(r1.updatedDecisions[0].monthsRemaining).toBe(2);
    expect(r1.totalCost).toBe(100_000);

    // Mes 2: avanzar
    const stateMes2 = {
      ...stateMes1,
      longRunningDecisions: r1.updatedDecisions,
    };
    const r2 = advanceDecisions(stateMes2, emptyInput());
    expect(r2.updatedDecisions[0].monthsRemaining).toBe(1);

    // Mes 3: avanzar → completa
    const stateMes3 = {
      ...stateMes2,
      longRunningDecisions: r2.updatedDecisions,
    };
    const r3 = advanceDecisions(stateMes3, emptyInput());
    expect(r3.updatedDecisions[0].monthsRemaining).toBe(0);
    expect(r3.updatedDecisions[0].status).toBe("COMPLETED");
    expect(r3.completed).toHaveLength(1);
  });

  it("cancelar en medio pierde lo invertido", () => {
    const state = crearEstadoBase({
      currentYear: 2024,
      currentMonth: 1,
      treasury: 2_000_000,
    });

    // Una LRD recién creada (la creación por input se prueba aparte)
    const newLrds = [crearLrd({ id: "lrd-2024-1-0", name: "Proyecto cancelado", monthsRemaining: 6, totalMonths: 6, monthlyCost: 200_000 })];

    // Mes 1: avanzar
    const stateMes1 = { ...state, longRunningDecisions: newLrds };
    const r1 = advanceDecisions(stateMes1, emptyInput());
    expect(r1.totalCost).toBe(200_000);

    // Mes 2: cancelar
    const cancelInput: TurnInput = { cancelDecisionIds: [newLrds[0].id] };
    const stateMes2 = {
      ...stateMes1,
      currentMonth: 2,
      longRunningDecisions: r1.updatedDecisions,
    };
    const r2 = advanceDecisions(stateMes2, cancelInput);
    expect(r2.updatedDecisions[0].status).toBe("CANCELLED");
    // El costo del mes 2 NO se descuenta (se cancela antes)
    expect(r2.totalCost).toBe(0);
    expect(r2.cancelled).toHaveLength(1);
  });
});
