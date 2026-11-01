import { describe, it, expect } from "vitest";
import type { GameState, OrganismState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { triggerRandomEvents, applyEventEffects } from "@/lib/engine/events";
import { monthlyDebtInterest } from "@/lib/engine/fiscal";
import { ratingFromScore } from "@/lib/engine/rating";
import {
  advanceDebtCrisis, applyDebtCrisisResponse, areMarketsClosed, debtCrisisCondition, isDebtCrisisOpen, settleMonth,
  updateCreditScore,
} from "@/lib/engine/debt-crisis";

const REV = 1_000_000; // recaudación mensual de referencia en los tests unitarios

function estado(overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 1)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions }, ministerOfficialId: null, producedResources: {}, consumedResources: {},
    healthBudgetSplit: {},
  }));
  return {
    gameId: "g", countryName: "Prueba", currentYear: 1, currentMonth: 1, treasury: 50_000_000, population,
    seed: "crisis", gdp: 1_000_000_000, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15,
    foodSecurity: 60, educationLevel: 50, inflation: 3, lifeExpectancy: 68, ministries,
    officials: [{
      id: "o1", name: "F", role: "MINISTER", specialty: null, ministryId: null, partyId: null, loyalty: 50, ambition: 30,
      wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 50, reputation: 50, status: "ACTIVE",
    }],
    parties: [], senators: [], activeLaws: [], judicialCases: [], organisms: [],
    socialClasses: [
      { id: "s1", key: "POVERTY", populationPercent: 50, averageIncome: 500, approval: 50, demands: [], educationLevel: 30, healthAccess: 40 },
      { id: "s2", key: "ELITE", populationPercent: 50, averageIncome: 5000, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
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

/** Estado con una deuda cuyos intereses (a la tasa base 4 %) son `burden` de la recaudación REV. */
function conCarga(burden: number, overrides: Partial<GameState> = {}): GameState {
  const debt = (burden * REV * 12) / BALANCE.DEBT_BASE_ANNUAL_RATE;
  return estado({ publicDebt: debt, creditScore: 95, ...overrides });
}

describe("condición de crisis", () => {
  it("se abre con la carga de intereses sobre el umbral", () => {
    expect(debtCrisisCondition(conCarga(BALANCE.DEBT_CRISIS_INTEREST_BURDEN + 0.01), REV)).toBe(true);
    expect(debtCrisisCondition(conCarga(BALANCE.DEBT_CRISIS_INTEREST_BURDEN - 0.05), REV)).toBe(false);
  });

  it("o con deuda/PIB insostenible; sin deuda nunca", () => {
    expect(debtCrisisCondition(estado({ publicDebt: BALANCE.DEBT_CRISIS_DEBT_GDP * 1_000_000_000 }), 1e12)).toBe(true);
    expect(debtCrisisCondition(estado({ publicDebt: 0 }), 0)).toBe(false);
  });

  it("sin recaudación y con deuda, hay crisis", () => {
    expect(debtCrisisCondition(estado({ publicDebt: 1000 }), 0)).toBe(true);
  });
});

describe("máquina de la crisis (fin de turno)", () => {
  const ctx = { monthlyRevenue: REV, monthlyExpenses: REV };

  it("abre la crisis con aviso y no la abre durante el enfriamiento ni con mercados cerrados", () => {
    const s = conCarga(0.4);
    const avisos = advanceDebtCrisis(s, ctx);
    expect(isDebtCrisisOpen(s)).toBe(true);
    expect(s.debtCrisisMonths).toBe(1);
    expect(avisos.map((a) => a.title)).toContain("Crisis de deuda");

    const enfriando = conCarga(0.4, { debtCrisisCooldown: 3 });
    advanceDebtCrisis(enfriando, ctx);
    expect(isDebtCrisisOpen(enfriando)).toBe(false);
    expect(enfriando.debtCrisisCooldown).toBe(2);

    const cerrado = conCarga(0.4, { marketsClosedMonths: 5 });
    advanceDebtCrisis(cerrado, ctx);
    expect(isDebtCrisisOpen(cerrado)).toBe(false);
  });

  it("sin respuesta: avisa el primer mes y cae en default automático al vencer el plazo", () => {
    const s = conCarga(0.4, { debtCrisisMonths: 1 });
    const primero = advanceDebtCrisis(s, ctx);
    expect(s.debtCrisisMonths).toBe(2);
    expect(primero.map((a) => a.title)).toEqual(["Crisis de deuda sin respuesta"]);
    expect(areMarketsClosed(s)).toBe(false);

    const deuda = s.publicDebt!;
    const segundo = advanceDebtCrisis(s, ctx);
    expect(segundo.map((a) => a.title)).toEqual(["Default automático"]);
    expect(s.publicDebt).toBeCloseTo(deuda * (1 - BALANCE.DEFAULT_HAIRCUT), 6);
    expect(isDebtCrisisOpen(s)).toBe(false);
  });

  it("los mercados reabren al terminar el cierre y se levantan las sanciones", () => {
    const s = estado({ marketsClosedMonths: 1, sanctionsMultiplier: BALANCE.DEFAULT_SANCTIONS_MULTIPLIER, publicDebt: 0 });
    const avisos = advanceDebtCrisis(s, ctx);
    expect(s.marketsClosedMonths).toBe(0);
    expect(s.sanctionsMultiplier).toBe(BALANCE.TRADE_SANCTIONS_MULTIPLIER);
    expect(avisos.map((a) => a.title)).toContain("Los mercados reabren");
  });

  it("cuenta los meses desde el default solo si hubo uno", () => {
    const nunca = estado(); advanceDebtCrisis(nunca, ctx);
    expect(nunca.monthsSinceDefault ?? null).toBeNull();
    const hubo = estado({ monthsSinceDefault: 3 }); advanceDebtCrisis(hubo, ctx);
    expect(hubo.monthsSinceDefault).toBe(4);
  });
});

describe("respuesta del jugador", () => {
  it("austeridad: recorta presupuestos (con piso), baja la aprobación por clase, cierra la crisis y da bono", () => {
    const s = conCarga(0.4, { debtCrisisMonths: 1, creditScore: 40 });
    const antes = s.ministries.map((m) => m.budgetPercent);
    applyDebtCrisisResponse(s, "AUSTERITY");
    s.ministries.forEach((m, i) => {
      expect(m.budgetPercent).toBeLessThan(antes[i]);
      expect(m.budgetPercent).toBeGreaterThanOrEqual(BALANCE.MIN_BUDGET_PERCENT);
    });
    const pobre = s.socialClasses.find((c) => c.key === "POVERTY")!.approval;
    const elite = s.socialClasses.find((c) => c.key === "ELITE")!.approval;
    expect(50 - pobre).toBeCloseTo(BALANCE.AUSTERITY_APPROVAL_HIT * BALANCE.CRISIS_APPROVAL_CLASS_WEIGHT.POVERTY, 1);
    expect(50 - elite).toBeLessThan(50 - pobre);
    expect(s.creditScore).toBe(40 + BALANCE.AUSTERITY_SCORE_BONUS);
    expect(isDebtCrisisOpen(s)).toBe(false);
    expect(s.debtCrisisCooldown).toBe(BALANCE.DEBT_CRISIS_COOLDOWN_MONTHS);
  });

  it("default: quita, calificación D, mercados cerrados, sanciones, inflación y aprobación", () => {
    const s = conCarga(0.4, { debtCrisisMonths: 2 });
    const deuda = s.publicDebt!;
    applyDebtCrisisResponse(s, "DEFAULT");
    expect(s.publicDebt).toBeCloseTo(deuda * (1 - BALANCE.DEFAULT_HAIRCUT), 6);
    expect(ratingFromScore(s.creditScore)).toBe("D");
    expect(s.marketsClosedMonths).toBe(BALANCE.DEFAULT_MARKET_CLOSURE_MONTHS);
    expect(s.sanctionsMultiplier).toBe(BALANCE.DEFAULT_SANCTIONS_MULTIPLIER);
    expect(s.inflation).toBe(3 + BALANCE.DEFAULT_INFLATION_SHOCK);
    expect(s.monthsSinceDefault).toBe(0);
    expect(s.socialClasses.every((c) => c.approval < 50)).toBe(true);
    expect(isDebtCrisisOpen(s)).toBe(false);
  });

  it("sin crisis abierta la respuesta se ignora con aviso; una respuesta inválida no hace nada", () => {
    const s = estado({ publicDebt: 100 });
    const antes = JSON.stringify(s);
    expect(applyDebtCrisisResponse(s, "DEFAULT").map((a) => a.title)).toEqual(["Respuesta ignorada"]);
    expect(applyDebtCrisisResponse(s, undefined)).toEqual([]);
    expect(JSON.stringify(s)).toBe(antes);

    const abierta = conCarga(0.4, { debtCrisisMonths: 1 });
    expect(applyDebtCrisisResponse(abierta, "QUIERO_DINERO")).toEqual([]);
    expect(isDebtCrisisOpen(abierta)).toBe(true);
  });

  it("tras un default la deuda reestructurada no paga diferencial de calificación", () => {
    const normal = conCarga(0.1, { creditScore: 10 });
    const reestructurada = { ...normal, marketsClosedMonths: 10 } as GameState;
    expect(monthlyDebtInterest(normal)).toBeGreaterThan(monthlyDebtInterest(reestructurada));
  });
});

describe("cierre de caja con mercados cerrados", () => {
  it("abiertos: el faltante se convierte en deuda", () => {
    const s = estado({ treasury: -300, publicDebt: 100 });
    const r = settleMonth(s, 1000, REV);
    expect(r.issued).toBe(300);
    expect(s.publicDebt).toBe(400);
    expect(r.monetized).toBe(0);
  });

  it("cerrados: no hay deuda nueva; el faltante se imprime y sube la inflación", () => {
    const s = estado({ treasury: -REV / 10, publicDebt: 100, marketsClosedMonths: 4 });
    const r = settleMonth(s, 1000, REV);
    expect(r.issued).toBe(0);
    expect(r.monetized).toBe(REV / 10);
    expect(s.publicDebt).toBe(100);
    expect(s.treasury).toBe(0);
    expect(s.inflation).toBeGreaterThan(3);
  });

  it("cerrados con superávit: no hay emisión de dinero", () => {
    const s = estado({ treasury: 500, publicDebt: 0, marketsClosedMonths: 4 });
    expect(settleMonth(s, 100, REV).monetized).toBe(0);
    expect(s.inflation).toBe(3);
  });
});

describe("puntaje del mes", () => {
  it("la primera vez arranca en el objetivo y después se mueve con inercia", () => {
    const s = estado({ creditScore: null });
    updateCreditScore(s, { monthlyRevenue: REV, monthlyExpenses: REV });
    const primero = s.creditScore!;
    expect(primero).toBeGreaterThan(60);
    s.publicDebt = 5 * 1_000_000_000; // deuda 500 % del PIB: el objetivo se desploma
    updateCreditScore(s, { monthlyRevenue: REV, monthlyExpenses: REV });
    expect(s.creditScore!).toBeLessThan(primero);
    expect(s.creditScore!).toBeGreaterThan(primero - 40); // inercia: no cae de golpe
  });
});

describe("eventos de mercado", () => {
  const cuantos = (creditScore: number | null, tipo: string) => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      n += triggerRandomEvents(estado({ creditScore }), createRNG(`mkt-${i}`)).newEvents.filter((e) => e.type === tipo).length;
    }
    return n;
  };

  it("con buena calificación (o sin calcular) no ocurren", () => {
    expect(cuantos(90, "CAPITAL_FLIGHT")).toBe(0);
    expect(cuantos(null, "CAPITAL_FLIGHT")).toBe(0);
    expect(cuantos(90, "SPECULATIVE_ATTACK")).toBe(0);
  });

  it("la fuga de capitales aparece bajo su umbral y el ataque especulativo solo más abajo", () => {
    expect(cuantos(BALANCE.RATING_EVENT_CAPITAL_FLIGHT_SCORE - 1, "CAPITAL_FLIGHT")).toBeGreaterThan(0);
    expect(cuantos(BALANCE.RATING_EVENT_CAPITAL_FLIGHT_SCORE - 1, "SPECULATIVE_ATTACK")).toBe(0);
    expect(cuantos(BALANCE.RATING_EVENT_ATTACK_SCORE - 1, "SPECULATIVE_ATTACK")).toBeGreaterThan(0);
  });

  it("el ataque especulativo resta calificación y la fuga de capitales no", () => {
    let delta = 0; let flightDelta = 0;
    for (let i = 0; i < 400 && (delta === 0 || flightDelta === 0); i++) {
      const { newEvents } = triggerRandomEvents(estado({ creditScore: 5 }), createRNG(`delta-${i}`));
      const a = applyEventEffects(newEvents.filter((e) => e.type === "SPECULATIVE_ATTACK")).creditScoreDelta;
      const f = applyEventEffects(newEvents.filter((e) => e.type === "CAPITAL_FLIGHT")).creditScoreDelta;
      if (a > 0) delta = a;
      if (newEvents.some((e) => e.type === "CAPITAL_FLIGHT")) flightDelta = f + 1e-9;
    }
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(BALANCE.RATING_ATTACK_SCORE_HIT);
    expect(flightDelta).toBeCloseTo(1e-9, 12);
  });
});

describe("processTurn y la crisis de deuda", () => {
  const banco: OrganismState = {
    id: "bc", type: "CENTRAL_BANK", name: "Banco Central", monthlyBudget: 0, staff: 10, effectiveness: 80, autonomyLevel: 90,
    headOfficialId: null,
  };

  it("el primer turno fija la calificación (sin transitorio) y la guarda en el snapshot", () => {
    const out = processTurn(estado({ creditScore: null }), {}, createRNG("rat-1"));
    expect(out.newState.creditScore).toBeGreaterThan(0);
    expect(out.monthSnapshot.creditScore).toBe(out.newState.creditScore);
  });

  it("deuda alta abre la crisis; si responde austeridad se cierra y recorta presupuestos", () => {
    const deuda = estado({ publicDebt: 25_000_000_000, creditScore: 60 });
    const turno1 = processTurn(deuda, {}, createRNG("cris-1"));
    expect(turno1.newState.debtCrisisMonths).toBe(1);
    expect(turno1.notifications.some((n) => n.title === "Crisis de deuda")).toBe(true);

    const presupuestoAntes = turno1.newState.ministries.reduce((s, m) => s + m.budgetPercent, 0);
    const turno2 = processTurn(turno1.newState, { debtCrisisResponse: "AUSTERITY" }, createRNG("cris-2"));
    expect(turno2.newState.debtCrisisMonths).toBe(0);
    expect(turno2.newState.ministries.reduce((s, m) => s + m.budgetPercent, 0)).toBeLessThan(presupuestoAntes);
  });

  it("sin responder, el país cae en default automático al segundo turno de plazo", () => {
    let s = processTurn(estado({ publicDebt: 25_000_000_000, creditScore: 60 }), {}, createRNG("auto-1")).newState;
    expect(s.debtCrisisMonths).toBe(1);
    const deuda = s.publicDebt!;
    s = processTurn(s, {}, createRNG("auto-2")).newState;
    expect(s.debtCrisisMonths).toBe(2);
    s = processTurn(s, {}, createRNG("auto-3")).newState;
    expect(s.marketsClosedMonths).toBeGreaterThan(0);
    expect(s.publicDebt!).toBeLessThan(deuda);
    expect(s.sanctionsMultiplier).toBe(BALANCE.DEFAULT_SANCTIONS_MULTIPLIER);
  });

  it("es determinista con la misma semilla", () => {
    const a = processTurn(estado({ publicDebt: 25_000_000_000, creditScore: 60 }), {}, createRNG("det-r"));
    const b = processTurn(estado({ publicDebt: 25_000_000_000, creditScore: 60 }), {}, createRNG("det-r"));
    expect(a.newState.creditScore).toBe(b.newState.creditScore);
    expect(a.newState.debtCrisisMonths).toBe(b.newState.debtCrisisMonths);
  });

  it("un Banco Central creíble mejora la calificación", () => {
    const sin = processTurn(estado({ creditScore: null }), {}, createRNG("bc-r")).newState.creditScore!;
    const con = processTurn(estado({ creditScore: null, organisms: [banco] }), {}, createRNG("bc-r")).newState.creditScore!;
    expect(con).toBeGreaterThan(sin);
  });
});
