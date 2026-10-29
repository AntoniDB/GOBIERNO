import { describe, it, expect } from "vitest";
import type { GameState, OfficialState, OrganismState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { processTurn } from "@/lib/engine/turn";
import { triggerRandomEvents } from "@/lib/engine/events";
import { calculateIncome } from "@/lib/engine/economy";
import { createRNG } from "@/lib/rng";
import {
  applyCentralBankPolicy, calculateInflation, centralBank, emissionPercent, isCentralBankAutonomous,
  monetaryCredibility, monetaryEmission, nextCentralBankRate, policyRate, taylorRate,
} from "@/lib/engine/monetary";

const funcionario = (corruption: number, role = "MINISTER"): OfficialState => ({
  id: `o-${role}-${corruption}`, name: "F", role, specialty: null, ministryId: null, partyId: null, loyalty: 50,
  ambition: 30, wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption, skill: 50, reputation: 50,
  status: "ACTIVE",
});

const banco = (autonomyLevel: number, effectiveness = 50): OrganismState => ({
  id: "bc", type: "CENTRAL_BANK", name: "Banco Central", monthlyBudget: 0, staff: 10, effectiveness, autonomyLevel,
  headOfficialId: null,
});

/** Estado como lo deja la siembra de una partida nueva, con inflación y organismos a elección. */
function estado(overrides: Partial<GameState> = {}, economia: Record<string, number> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 3)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions, ...(m.key === "ECONOMY" ? economia : {}) }, ministerOfficialId: null,
    producedResources: {}, consumedResources: {}, healthBudgetSplit: {},
  }));
  return {
    countryName: "Prueba", currentYear: 1, currentMonth: 1, treasury: 50_000_000, population, seed: "monetaria",
    gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15, foodSecurity: 60, educationLevel: 50,
    inflation: BALANCE.INFLATION_TARGET, lifeExpectancy: 68, ministries,
    officials: [funcionario(20), funcionario(10, "JUDGE"), funcionario(10, "PROSECUTOR")],
    parties: [], senators: [], activeLaws: [], judicialCases: [], organisms: [],
    socialClasses: [
      { id: "s1", key: "MIDDLE", populationPercent: 60, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "s2", key: "POVERTY", populationPercent: 40, averageIncome: 500, approval: 50, demands: [], educationLevel: 30, healthAccess: 40 },
    ],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 80, judicialIndependence: 80, politicalPluralism: 80,
      civilLiberties: 80, transparency: 75, militarySubordination: 85,
    },
    media: [], events: [], longRunningDecisions: [], programs: [], resourceStocks: [], regions: [], diseases: [],
    diseasePrevalences: [], diseaseMortality: 0, consecutiveLowApprovalMonths: 0, healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {}, sanctionsMultiplier: 1, tradeGoods: [], tradeFlows: [], tradeBalance: 0,
    totalImports: 0, totalExports: 0,
    ...overrides,
  } as GameState;
}

const SIN_DEFICIT = { taxRevenue: 1_000, expenses: 1_000, emission: 0 };
const eco = (s: GameState) => s.ministries.find((m) => m.key === "ECONOMY")!;

describe("credibilidad y Banco Central", () => {
  it("sin Banco Central (o disuelto) la credibilidad es la mínima", () => {
    expect(monetaryCredibility([])).toBe(BALANCE.MONETARY_CRED_MIN);
    expect(monetaryCredibility([banco(100, 0)])).toBe(BALANCE.MONETARY_CRED_MIN);
    expect(centralBank([banco(100, 0)])).toBeUndefined();
  });

  it("sube con la autonomía y la efectividad, hasta la máxima", () => {
    const rango = BALANCE.MONETARY_CRED_MAX - BALANCE.MONETARY_CRED_MIN;
    expect(monetaryCredibility([banco(100, 50)])).toBeCloseTo(BALANCE.MONETARY_CRED_MIN + rango * 0.75, 10);
    expect(monetaryCredibility([banco(100, 100)])).toBeCloseTo(BALANCE.MONETARY_CRED_MAX, 10);
    expect(monetaryCredibility([banco(30)])).toBeLessThan(monetaryCredibility([banco(80)]));
  });

  it("es autónomo desde CB_AUTONOMY_THRESHOLD", () => {
    expect(isCentralBankAutonomous([banco(BALANCE.CB_AUTONOMY_THRESHOLD)])).toBe(true);
    expect(isCentralBankAutonomous([banco(BALANCE.CB_AUTONOMY_THRESHOLD - 1)])).toBe(false);
    expect(isCentralBankAutonomous([])).toBe(false);
  });
});

describe("regla de Taylor", () => {
  it("con la inflación en la meta pide la tasa sembrada (4,5)", () => {
    expect(taylorRate(BALANCE.INFLATION_TARGET)).toBeCloseTo(4.5, 10);
  });

  it("sube con la inflación y se acota a [1, 20]", () => {
    expect(taylorRate(8)).toBeGreaterThan(taylorRate(5));
    expect(taylorRate(40)).toBe(20);
    expect(taylorRate(0)).toBe(1);
  });

  it("el Banco Central se mueve como mucho CB_MAX_RATE_STEP por mes, en pasos de 0,5", () => {
    expect(nextCentralBankRate(4.5, 18)).toBe(4.5 + BALANCE.CB_MAX_RATE_STEP);
    expect(nextCentralBankRate(10, 3)).toBe(10 - BALANCE.CB_MAX_RATE_STEP);
    expect(nextCentralBankRate(4.5, 3)).toBe(4.5);
    expect(nextCentralBankRate(4.5, 3.2) * 2 % 1).toBe(0);
  });
});

describe("applyCentralBankPolicy", () => {
  it("sin Banco Central autónomo no toca nada", () => {
    const s = estado({ organisms: [banco(30)], inflation: 18 }, { tasaInteres: 2, emisionMonetaria: 10 });
    expect(applyCentralBankPolicy(s, { tasaInteres: 2 })).toEqual([]);
    expect(eco(s).subDecisions.tasaInteres).toBe(2);
    expect(eco(s).subDecisions.emisionMonetaria).toBe(10);
  });

  it("autónomo: fija la tasa, anula la emisión y avisa si el jugador lo intentó", () => {
    const s = estado({ organisms: [banco(80)], inflation: 18 }, { tasaInteres: 2, emisionMonetaria: 10 });
    const avisos = applyCentralBankPolicy(s, { tasaInteres: 2, emisionMonetaria: 10 });
    expect(eco(s).subDecisions.tasaInteres).toBe(3); // desde 2, un paso hacia la de Taylor
    expect(eco(s).subDecisions.emisionMonetaria).toBe(0);
    expect(avisos.map((a) => a.title)).toEqual(["El Banco Central fija la tasa", "Emisión rechazada"]);
  });

  it("autónomo y sin pedidos del jugador: informa si movió la tasa", () => {
    const s = estado({ organisms: [banco(80)], inflation: 10 });
    const avisos = applyCentralBankPolicy(s);
    expect(eco(s).subDecisions.tasaInteres).toBe(5.5);
    expect(avisos.map((a) => a.title)).toEqual(["Decisión del Banco Central"]);
  });
});

describe("emisión monetaria", () => {
  it("es un % de la recaudación, acotado al rango; sin valor, 0", () => {
    expect(monetaryEmission(estado({}, { emisionMonetaria: 10 }).ministries, 2_000)).toBeCloseTo(200, 10);
    expect(emissionPercent(estado({}, { emisionMonetaria: 99 }).ministries)).toBe(30);
    expect(emissionPercent(estado({}, { emisionMonetaria: Number.NaN }).ministries)).toBe(0);
    expect(monetaryEmission([], 1_000)).toBe(0);
  });
});

describe("calculateInflation (anual, con memoria)", () => {
  it("en la meta y sin presiones se queda en la meta", () => {
    const r = calculateInflation(estado(), SIN_DEFICIT);
    expect(r.equilibrium).toBeCloseTo(BALANCE.INFLATION_TARGET, 10);
    expect(r.inflation).toBeCloseTo(BALANCE.INFLATION_TARGET, 10);
  });

  it("una inflación alta baja de a poco hacia la meta (no desaparece en un mes)", () => {
    const r = calculateInflation(estado({ inflation: 18 }), SIN_DEFICIT);
    const esperado = 18 + BALANCE.INFLATION_ADJUST * BALANCE.MONETARY_CRED_MIN * (BALANCE.INFLATION_TARGET - 18);
    expect(r.inflation).toBeCloseTo(esperado, 10);
    expect(r.inflation).toBeGreaterThan(17);
  });

  it("con un Banco Central creíble converge más rápido", () => {
    const sin = calculateInflation(estado({ inflation: 18 }), SIN_DEFICIT).inflation;
    const con = calculateInflation(estado({ inflation: 18, organisms: [banco(100)] }), SIN_DEFICIT).inflation;
    expect(con).toBeLessThan(sin);
  });

  it("déficit y emisión suben el equilibrio; una tasa alta lo baja", () => {
    const base = calculateInflation(estado(), SIN_DEFICIT).equilibrium;
    expect(calculateInflation(estado(), { taxRevenue: 1_000, expenses: 1_100, emission: 0 }).equilibrium).toBeGreaterThan(base);
    expect(calculateInflation(estado(), { taxRevenue: 1_000, expenses: 1_000, emission: 100 }).equilibrium).toBeGreaterThan(base);
    expect(calculateInflation(estado({}, { tasaInteres: 10 }), SIN_DEFICIT).equilibrium).toBeLessThan(base);
  });

  it("la falta de credibilidad amplifica las presiones", () => {
    const deficit = { taxRevenue: 1_000, expenses: 1_200, emission: 0 };
    const sin = calculateInflation(estado(), deficit);
    const con = calculateInflation(estado({ organisms: [banco(100, 100)] }), deficit);
    expect(sin.equilibrium - BALANCE.INFLATION_TARGET).toBeGreaterThan(con.equilibrium - BALANCE.INFLATION_TARGET);
    expect(sin.deficit).toBeCloseTo(BALANCE.INFLATION_DEFICIT_FACTOR * 20, 10);
  });

  it("nunca negativa; una inflación previa inválida parte de la meta", () => {
    expect(calculateInflation(estado({ inflation: 0.5 }, { tasaInteres: 20 }), SIN_DEFICIT).inflation).toBeGreaterThanOrEqual(0);
    expect(calculateInflation(estado({ inflation: Number.NaN }), SIN_DEFICIT).inflation).toBeCloseTo(BALANCE.INFLATION_TARGET, 10);
  });

  it("las sub-decisiones con efecto inflacionario (IVA) suman presión", () => {
    expect(calculateInflation(estado({}, { iva: 30 }), SIN_DEFICIT).subDecisions).toBeCloseTo(0.06 * 14, 10);
    expect(policyRate(estado({}, { tasaInteres: 99 }).ministries)).toBe(20);
  });
});

describe("crisis económica", () => {
  const crisis = (inflation: number) => {
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const { newEvents } = triggerRandomEvents(estado({ inflation }), createRNG(`crisis-${i}`));
      n += newEvents.filter((e) => e.type === "ECONOMIC_CRISIS").length;
    }
    return n;
  };

  it("solo se dispara con la inflación del estado sobre el umbral", () => {
    expect(crisis(BALANCE.EVENT_ECONOMIC_CRISIS_INFLATION - 1)).toBe(0);
    expect(crisis(30)).toBeGreaterThan(0);
  });

  it("sus efectos están acotados (shock de inflación ≤ 10 puntos)", () => {
    for (let i = 0; i < 200; i++) {
      const { newEvents } = triggerRandomEvents(estado({ inflation: 60 }), createRNG(`crisis-efectos-${i}`));
      for (const e of newEvents.filter((ev) => ev.type === "ECONOMIC_CRISIS")) {
        const eff = e.effectsApplied as Record<string, number>;
        expect(eff.inflationIncrease).toBeLessThanOrEqual(100 * BALANCE.EVENT_ECONOMIC_CRISIS_INFLATION_SHOCK);
        expect(eff.treasuryCost).toBeLessThanOrEqual(100 * 10_000_000 * BALANCE.EVENT_ECONOMIC_CRISIS_COST_PER_CAPITA);
      }
    }
  });
});

describe("processTurn y la política monetaria", () => {
  it("la inflación inicial del preset persiste (antes caía a 0,2 en el primer mes)", () => {
    const out = processTurn(estado({ inflation: 18 }), {}, createRNG("mon-1"));
    expect(out.newState.inflation).toBeGreaterThan(15);
    expect(out.newState.inflation).toBeLessThan(18);
    expect(out.monthSnapshot.inflation).toBe(out.newState.inflation);
  });

  it("la emisión entra al tesoro y sube la inflación", () => {
    const sin = processTurn(estado(), {}, createRNG("mon-em"));
    const con = processTurn(estado(), { subDecisionChanges: { ECONOMY: { emisionMonetaria: 10 } } }, createRNG("mon-em"));
    const ingreso = calculateIncome(estado());
    expect(con.newState.treasury - sin.newState.treasury).toBeGreaterThan(0.09 * ingreso);
    expect(con.newState.inflation).toBeGreaterThan(sin.newState.inflation);
    expect(con.notifications.some((n) => n.title === "Emisión monetaria")).toBe(true);
  });

  it("un Banco Central autónomo sube la tasa ante inflación alta y bloquea la emisión", () => {
    const out = processTurn(
      estado({ inflation: 18, organisms: [banco(80)] }),
      { subDecisionChanges: { ECONOMY: { emisionMonetaria: 10 } } },
      createRNG("mon-bc"),
    );
    expect(eco(out.newState).subDecisions.tasaInteres).toBe(5.5);
    expect(eco(out.newState).subDecisions.emisionMonetaria).toBe(0);
    expect(out.notifications.some((n) => n.title === "Emisión rechazada")).toBe(true);
  });

  it("es determinista con la misma semilla", () => {
    const a = processTurn(estado({ inflation: 12 }), {}, createRNG("mon-det"));
    const b = processTurn(estado({ inflation: 12 }), {}, createRNG("mon-det"));
    expect(a.newState.inflation).toBe(b.newState.inflation);
  });
});
