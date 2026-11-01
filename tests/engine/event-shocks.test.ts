import { describe, it, expect } from "vitest";
import type { EventState, GameState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { applyEventEffects } from "@/lib/engine/events";

// KNOWN_ISSUES #25: los deltas de los eventos sobre desempleo, enfermos, crimen y alimentación se sumaban al
// estado en el paso 11b, pero el snapshot y el paso 8 del mes siguiente recalculaban el indicador desde su
// fórmula y el delta se perdía. Ahora son choques persistentes que se disipan.

function estado(overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 1)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions }, ministerOfficialId: null, producedResources: {}, consumedResources: {},
    healthBudgetSplit: {},
  }));
  return {
    gameId: "g", countryName: "Prueba", currentYear: 1, currentMonth: 3, treasury: 50_000_000, population,
    seed: "shocks", gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15, foodSecurity: 60,
    educationLevel: 50, inflation: 3, lifeExpectancy: 68, ministries,
    officials: [{
      id: "o1", name: "F", role: "MINISTER", specialty: null, ministryId: null, partyId: null, loyalty: 50, ambition: 30,
      wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 10, skill: 50, reputation: 50, status: "ACTIVE",
    }],
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

describe("escala de los efectos de los eventos", () => {
  it("las olas de criminalidad, protestas y desastres usan las constantes de balance (acotadas)", () => {
    const d = applyEventEffects([
      evento("CRIME_SURGE", 70, { crimeRateIncrease: Math.round(70 * BALANCE.EVENT_CRIME_SURGE_CRIME * 10) / 10 }),
      evento("DISASTER", 60, { foodSecurityPenalty: -Math.round(60 * BALANCE.EVENT_DISASTER_FOOD * 10) / 10 }),
    ]);
    expect(d.crimeRateDelta).toBeCloseTo(7, 5);
    expect(d.foodDelta).toBeCloseTo(-9, 5);
  });
});

describe("processTurn: los eventos dejan huella en los indicadores (#25)", () => {
  const base = () => processTurn(estado(), {}, createRNG("sh")).monthSnapshot;

  it("una ola de criminalidad sube el crimen del mes en el snapshot", () => {
    const ola = evento("CRIME_SURGE", 80, { crimeRateIncrease: 8 });
    const con = processTurn(estado({ events: [ola] }), {}, createRNG("sh")).monthSnapshot;
    expect(con.crimeRate - base().crimeRate).toBeCloseTo(8, 0);
  });

  it("un desastre baja la seguridad alimentaria; una crisis económica sube el desempleo", () => {
    const desastre = evento("DISASTER", 60, { foodSecurityPenalty: -9, treasuryCost: 0 });
    const crisis = evento("ECONOMIC_CRISIS", 100, { unemploymentIncrease: 5 });
    expect(processTurn(estado({ events: [desastre] }), {}, createRNG("sh")).monthSnapshot.foodSecurity).toBeLessThan(base().foodSecurity - 8);
    expect(processTurn(estado({ events: [crisis] }), {}, createRNG("sh")).monthSnapshot.unemploymentRate - base().unemploymentRate).toBeCloseTo(5, 0);
  });

  it("una epidemia sube los enfermos", () => {
    const epidemia = evento("EPIDEMIC", 50, { sickRateIncrease: 5 });
    expect(processTurn(estado({ events: [epidemia] }), {}, createRNG("sh")).monthSnapshot.sickRate - base().sickRate).toBeCloseTo(5, 0);
  });

  it("el choque se guarda en el estado y se disipa mes a mes (× retención)", () => {
    const ola = evento("CRIME_SURGE", 80, { crimeRateIncrease: 8 });
    const t1 = processTurn(estado({ events: [ola] }), {}, createRNG("sh"));
    expect(t1.newState.indicatorShocks?.crimeRate).toBeCloseTo(8, 5);

    // Mes siguiente sin eventos nuevos: el delta de la ola (evento del mes 3) ya no cuenta, el choque decae
    const t2 = processTurn({ ...t1.newState, currentMonth: 4, events: [] }, {}, createRNG("sh2"));
    expect(t2.newState.indicatorShocks?.crimeRate).toBeCloseTo(8 * BALANCE.EVENT_SHOCK_RETENTION, 2);
    const sin = processTurn({ ...estado(), currentMonth: 4 }, {}, createRNG("sh2")).monthSnapshot.crimeRate;
    expect(t2.monthSnapshot.crimeRate - sin).toBeGreaterThan(4);
    expect(t2.monthSnapshot.crimeRate - sin).toBeLessThan(8);
  });

  it("sin choque previo (partidas anteriores a este arreglo) todo queda como antes", () => {
    const a = processTurn(estado({ indicatorShocks: undefined }), {}, createRNG("sh"));
    const b = processTurn(estado({ indicatorShocks: {} }), {}, createRNG("sh"));
    expect(a.monthSnapshot.crimeRate).toBe(b.monthSnapshot.crimeRate);
    expect(a.newState.indicatorShocks).toEqual({});
  });

  it("el choque acumulado tiene tope", () => {
    const ola = evento("CRIME_SURGE", 100, { crimeRateIncrease: 40 });
    const t = processTurn(estado({ events: [ola], indicatorShocks: { crimeRate: 20 } }), {}, createRNG("sh"));
    expect(t.newState.indicatorShocks?.crimeRate).toBe(BALANCE.EVENT_SHOCK_MAX);
  });
});
