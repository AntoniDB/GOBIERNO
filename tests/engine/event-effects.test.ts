import { describe, it, expect } from "vitest";
import type { EventState, GameState, OfficialState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { applyEventEffects } from "@/lib/engine/events";
import { applyEventStateEffects } from "@/lib/engine/event-effects";
import { addEventShocks, decayIndicatorShocks, indicatorShock } from "@/lib/engine/shocks";
import { calculateGDP } from "@/lib/engine/economy";
import { calculateApprovalByClass, approvalPenaltyFor } from "@/lib/engine/approval";

// KNOWN_ISSUES #26: getEventEffects declaraba efectos que ningún código leía (PIB, eficiencia de Salud y
// Seguridad, corrupción, reputación, subordinación militar, libertades civiles, aprobación).

const funcionario = (id: string, corruption: number, over: Partial<OfficialState> = {}): OfficialState => ({
  id, name: id, role: "GENERAL", specialty: null, ministryId: null, partyId: null, loyalty: 50, ambition: 30,
  wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption, skill: 50, reputation: 60, status: "ACTIVE",
  ...over,
});

function estado(overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 1)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions }, ministerOfficialId: null, producedResources: {}, consumedResources: {},
    healthBudgetSplit: {},
  }));
  return {
    gameId: "g", countryName: "Prueba", currentYear: 1, currentMonth: 3, treasury: 50_000_000, population,
    seed: "efectos", gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15, foodSecurity: 60,
    educationLevel: 50, inflation: 3, lifeExpectancy: 68, ministries,
    officials: [funcionario("a", 10), funcionario("b", 50), funcionario("c", 30), funcionario("d", 70), funcionario("e", 20)],
    parties: [], senators: [], activeLaws: [], judicialCases: [], organisms: [],
    socialClasses: [
      { id: "s1", key: "MIDDLE", populationPercent: 100, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
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

const evento = (type: string, severity: number, effectsApplied: Record<string, unknown>): EventState => ({
  id: `e-${type}`, type, severity, year: 1, month: 3, description: type, effectsApplied, resolvedAt: null,
});

const SIN = { unemploymentDelta: 0, sickRateDelta: 0, crimeRateDelta: 0, foodDelta: 0 };
const eficiencia = (s: GameState, key: string) => s.ministries.find((m) => m.key === key)!.efficiency;

describe("applyEventEffects: lee los efectos declarados", () => {
  it("PIB: crisis económica, protesta y desastre suman su % negativo", () => {
    const d = applyEventEffects([
      evento("ECONOMIC_CRISIS", 100, { gdpPenalty: -5 }),
      evento("PROTEST", 40, { economicDisruption: -0.4 }),
      evento("DISASTER", 60, { infrastructureDamage: -1.8 }),
    ]);
    expect(d.gdpPctDelta).toBeCloseTo(-7.2, 5);
  });

  it("eficiencia, corrupción, reputación y régimen", () => {
    const d = applyEventEffects([
      evento("EPIDEMIC", 50, { healthMinistryPenalty: -5 }),
      evento("CRIME_SURGE", 70, { securityPressure: 7 }),
      evento("SCANDAL", 40, { corruptionIncrease: 0.8, reputationDamage: 4 }),
      evento("COUP_ATTEMPT", 50, { militarySubordinationPenalty: -7.5, stabilityDamage: 5 }),
    ]);
    expect(d.healthEfficiencyDelta).toBe(5);
    expect(d.securityEfficiencyDelta).toBe(7);
    expect(d.corruptionDelta).toBeCloseTo(0.8, 5);
    expect(d.reputationDelta).toBe(4);
    expect(d.militarySubordinationDelta).toBe(-7.5);
    expect(d.civilLibertiesDelta).toBe(-5);
  });

  it("un evento sin esos efectos no los toca; valores inválidos se ignoran", () => {
    const d = applyEventEffects([evento("DISCOVERY", 50, { gdpPenalty: Number.NaN, securityPressure: "x" })]);
    expect(d.gdpPctDelta).toBe(0);
    expect(d.securityEfficiencyDelta).toBe(0);
  });
});

describe("choques nuevos (PIB y eficiencia)", () => {
  it("se suman, se disipan y se acotan como los demás", () => {
    const s = estado();
    addEventShocks(s, { ...SIN, gdpPctDelta: -5, healthEfficiencyDelta: 4, securityEfficiencyDelta: 100 });
    expect(indicatorShock(s, "gdpPct")).toBe(-5);
    expect(indicatorShock(s, "securityEfficiency")).toBe(BALANCE.EVENT_SHOCK_MAX);
    decayIndicatorShocks(s);
    expect(indicatorShock(s, "gdpPct")).toBeCloseTo(-5 * BALANCE.EVENT_SHOCK_RETENTION, 3);
    expect(indicatorShock(s, "healthEfficiency")).toBeCloseTo(4 * BALANCE.EVENT_SHOCK_RETENTION, 3);
  });

  it("calculateGDP aplica el choque en %", () => {
    const sin = calculateGDP(estado());
    const con = calculateGDP(estado({ indicatorShocks: { gdpPct: -5 } }));
    expect(con / sin).toBeCloseTo(0.95, 6);
  });
});

describe("applyEventStateEffects", () => {
  it("la corrupción sube a los funcionarios activos (no a los destituidos) con tope 100", () => {
    const s = estado({ officials: [funcionario("a", 10), funcionario("b", 99.5), funcionario("x", 10, { status: "DISMISSED" })] });
    applyEventStateEffects(s, { corruptionDelta: 2, reputationDelta: 0, militarySubordinationDelta: 0, civilLibertiesDelta: 0 });
    expect(s.officials.map((o) => o.corruption)).toEqual([12, 100, 10]);
  });

  it("la reputación la pierden solo los más corruptos (EVENT_SCANDAL_EXPOSED_OFFICIALS), de forma determinista", () => {
    const s = estado();
    applyEventStateEffects(s, { corruptionDelta: 0, reputationDelta: 10, militarySubordinationDelta: 0, civilLibertiesDelta: 0 });
    const perdieron = s.officials.filter((o) => o.reputation < 60).map((o) => o.id).sort();
    expect(perdieron).toEqual(["b", "c", "d"]); // corrupción 50, 30 y 70: los tres primeros
    expect(s.officials.filter((o) => o.reputation === 50)).toHaveLength(BALANCE.EVENT_SCANDAL_EXPOSED_OFFICIALS);
  });

  it("las métricas de régimen cambian y se acotan a [0, 100]", () => {
    const s = estado();
    applyEventStateEffects(s, { corruptionDelta: 0, reputationDelta: 0, militarySubordinationDelta: -7.5, civilLibertiesDelta: -5 });
    expect(s.regimeMetrics.militarySubordination).toBe(77.5);
    expect(s.regimeMetrics.civilLiberties).toBe(75);
    applyEventStateEffects(s, { corruptionDelta: 0, reputationDelta: 0, militarySubordinationDelta: -500, civilLibertiesDelta: 0 });
    expect(s.regimeMetrics.militarySubordination).toBe(0);
  });

  it("sin deltas no cambia nada", () => {
    const s = estado(); const antes = JSON.stringify(s);
    applyEventStateEffects(s, { corruptionDelta: 0, reputationDelta: 0, militarySubordinationDelta: 0, civilLibertiesDelta: 0 });
    expect(JSON.stringify(s)).toBe(antes);
  });
});

describe("aprobación: approvalPenalty declarado", () => {
  const clase = estado().socialClasses[0];
  const base = () => calculateApprovalByClass(clase, estado(), []);

  it("approvalPenaltyFor = −severidad × APPROVAL_EVENT_WEIGHT", () => {
    expect(approvalPenaltyFor(50)).toBeCloseTo(-50 * BALANCE.APPROVAL_EVENT_WEIGHT, 5);
  });

  it("se aplica lo declarado; sin declarar, severidad × peso (igual que antes)", () => {
    const conDeclarado = calculateApprovalByClass(clase, estado(), [evento("SCANDAL", 50, { approvalPenalty: -10 })]);
    const sinDeclarar = calculateApprovalByClass(clase, estado(), [evento("SCANDAL", 50, {})]);
    expect(base() - conDeclarado).toBeCloseTo(10 * 1.2, 1); // MIDDLE ×1,2
    expect(base() - sinDeclarar).toBeCloseTo(50 * BALANCE.APPROVAL_EVENT_WEIGHT * 1.2, 1);
  });

  it("un intento de golpe pesa el doble (EVENT_COUP_APPROVAL_MULT) que otro evento de igual severidad", () => {
    const decl = (type: string, s: number) => (type === "COUP_ATTEMPT" ? approvalPenaltyFor(s * BALANCE.EVENT_COUP_APPROVAL_MULT) : approvalPenaltyFor(s));
    const golpe = base() - calculateApprovalByClass(clase, estado(), [evento("COUP_ATTEMPT", 20, { approvalPenalty: decl("COUP_ATTEMPT", 20) })]);
    const escandalo = base() - calculateApprovalByClass(clase, estado(), [evento("SCANDAL", 20, { approvalPenalty: decl("SCANDAL", 20) })]);
    expect(golpe / escandalo).toBeCloseTo((BALANCE.EVENT_COUP_APPROVAL_MULT * 1.3) / 1.2, 1); // pesos de la clase MIDDLE: golpe 1,3 / escándalo 1,2
  });
});

describe("processTurn: los efectos llegan al estado y se disipan", () => {
  const turno = (events: EventState[], over: Partial<GameState> = {}) =>
    processTurn(estado({ events, ...over }), {}, createRNG("ef"));

  it("la crisis económica baja el PIB del snapshot y se recupera", () => {
    const sin = turno([]).monthSnapshot.gdp;
    const t1 = turno([evento("ECONOMIC_CRISIS", 100, { gdpPenalty: -5, inflationIncrease: 0, treasuryCost: 0 })]);
    expect(t1.monthSnapshot.gdp / sin).toBeCloseTo(0.95, 2);
    const t2 = processTurn({ ...t1.newState, currentMonth: 4, events: [] }, {}, createRNG("ef2"));
    const sin2 = processTurn({ ...estado(), currentMonth: 4 }, {}, createRNG("ef2")).monthSnapshot.gdp;
    expect(t2.monthSnapshot.gdp / sin2).toBeGreaterThan(0.95);
    expect(t2.monthSnapshot.gdp / sin2).toBeLessThan(1);
  });

  it("una ola de criminalidad le quita eficiencia a Seguridad (y no a otros ministerios)", () => {
    const sin = turno([]).newState;
    const con = turno([evento("CRIME_SURGE", 70, { crimeRateIncrease: 7, securityPressure: 7 })]);
    // El choque se aplica al cierre del mes: la eficiencia del mes siguiente es la que cae
    const sig = processTurn({ ...con.newState, currentMonth: 4, events: [] }, {}, createRNG("ef3")).newState;
    const sigSin = processTurn({ ...sin, currentMonth: 4, events: [] }, {}, createRNG("ef3")).newState;
    expect(eficiencia(sigSin, "SECURITY") - eficiencia(sig, "SECURITY")).toBeCloseTo(7 * BALANCE.EVENT_SHOCK_RETENTION, 0);
    expect(eficiencia(sig, "ECONOMY")).toBeCloseTo(eficiencia(sigSin, "ECONOMY"), 5);
  });

  it("un intento de golpe baja la subordinación militar y las libertades civiles", () => {
    const sin = turno([]).newState.regimeMetrics;
    const con = turno([evento("COUP_ATTEMPT", 50, { militarySubordinationPenalty: -7.5, stabilityDamage: 5, approvalPenalty: -20 })]).newState.regimeMetrics;
    expect(sin.militarySubordination - con.militarySubordination).toBeCloseTo(7.5, 1);
    expect(sin.civilLiberties - con.civilLiberties).toBeCloseTo(5, 1);
  });

  it("un escándalo sube la corrupción y baja la reputación de los más corruptos", () => {
    const sin = turno([]).newState.officials;
    const con = turno([evento("SCANDAL", 40, { corruptionIncrease: 0.8, reputationDamage: 4, approvalPenalty: -8 })]).newState.officials;
    for (const o of con) expect(o.corruption - sin.find((x) => x.id === o.id)!.corruption).toBeCloseTo(0.8, 1);
    const top = con.find((o) => o.id === "d")!; // la más corrupta
    expect(sin.find((o) => o.id === "d")!.reputation - top.reputation).toBeCloseTo(4, 1);
    expect(con.find((o) => o.id === "a")!.reputation).toBe(sin.find((o) => o.id === "a")!.reputation); // la menos corrupta, no
  });

  it("la referencia fiscal del primer mes no incluye el choque del evento de ese mes", () => {
    const crisis = turno([evento("ECONOMIC_CRISIS", 100, { gdpPenalty: -5, inflationIncrease: 0, treasuryCost: 0 })]).newState.fiscalBaseReference!;
    const normal = turno([]).newState.fiscalBaseReference!;
    expect(crisis).toBeCloseTo(normal, 0);
  });

  it("es determinista", () => {
    const e = [evento("SCANDAL", 40, { corruptionIncrease: 0.8, reputationDamage: 4, approvalPenalty: -8 })];
    expect(JSON.stringify(turno(e).newState.officials)).toBe(JSON.stringify(turno(e).newState.officials));
  });
});
