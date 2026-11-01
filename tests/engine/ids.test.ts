import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { entityId } from "@/lib/engine/ids";
import { generateCandidates } from "@/lib/engine/candidates";
import { createProgram } from "@/lib/engine/programs";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";

// KNOWN_ISSUES #22: los ids que crea el motor se guardan con upsert por id. Si dos partidas generaban
// el mismo id (p. ej. `org-1-1-0`), la segunda pisaba la fila de la primera. Ahora llevan la partida.

function estado(gameId: string | undefined, overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 1)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions }, ministerOfficialId: null, producedResources: {}, consumedResources: {},
    healthBudgetSplit: {},
  }));
  return {
    gameId, countryName: "Prueba", currentYear: 1, currentMonth: 6, treasury: 50_000_000, population,
    seed: "misma-semilla", gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15,
    foodSecurity: 60, educationLevel: 50, inflation: 3, lifeExpectancy: 68, ministries,
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

describe("entityId", () => {
  it("incluye la partida: mismo mes e índice en dos partidas dan ids distintos", () => {
    expect(entityId(estado("A"), "org", 1, 1, 0)).toBe("org-A-1-1-0");
    expect(entityId(estado("A"), "org", 1, 1, 0)).not.toBe(entityId(estado("B"), "org", 1, 1, 0));
  });

  it("sin gameId (tests, estados sueltos) usa el seed de la partida", () => {
    expect(entityId(estado(undefined), "cand", 1, 6, 2)).toBe("cand-misma-semilla-1-6-2");
  });

  it("es determinista", () => {
    expect(entityId(estado("A"), "lrd", 2, 3, 1)).toBe(entityId(estado("A"), "lrd", 2, 3, 1));
  });
});

describe("los generadores del motor usan ids por partida", () => {
  it("candidatos: misma semilla y mes en dos partidas → ids distintos", () => {
    const a = generateCandidates(estado("A"), createRNG("x")).map((c) => c.id);
    const b = generateCandidates(estado("B"), createRNG("x")).map((c) => c.id);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((id) => id.startsWith("cand-A-"))).toBe(true);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it("programas", () => {
    expect(createProgram(estado("A"), "PREVENTION_EDUCATION").id).toBe("prog-A-1-6-0");
    expect(createProgram(estado("B"), "PREVENTION_EDUCATION").id).toBe("prog-B-1-6-0");
  });

  it("organismos creados en el turno", () => {
    const input = { newOrganisms: { CENTRAL_BANK: { name: "Banco Central", monthlyBudget: 0, autonomyLevel: 80 } } };
    const orgA = processTurn(estado("A"), input, createRNG("t")).newState.organisms.map((o) => o.id);
    const orgB = processTurn(estado("B"), input, createRNG("t")).newState.organisms.map((o) => o.id);
    expect(orgA).toEqual(["org-A-1-6-0"]);
    expect(orgB).toEqual(["org-B-1-6-0"]);
  });
});
