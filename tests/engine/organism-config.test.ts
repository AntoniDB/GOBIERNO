import { describe, it, expect } from "vitest";
import type { GameState, TurnInput } from "@/lib/engine/types";
import { resolveOrganismConfig } from "@/lib/engine/organism-config";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";
import { BALANCE } from "@/lib/balance";
import { organismBudgetRange } from "@/lib/engine/cost-scale";

const POP = 50_000_000; // rango 50-500 M$ (referencia de leyes)
const pedir = (extra: Record<string, unknown> = {}) => ({ name: "Fiscalía", monthlyBudget: 200_000_000, ...extra });

describe("resolveOrganismConfig", () => {
  it("respeta el personal y la autonomía elegidos (antes el motor fijaba 10 y 50)", () => {
    const r = resolveOrganismConfig(pedir({ staff: 35, autonomyLevel: 85 }), POP);
    expect(r).toMatchObject({ staff: 35, autonomyLevel: 85, monthlyBudget: 200_000_000, budgetAdjusted: false, warnings: [] });
  });

  it("sin personal ni autonomía usa los valores por defecto del balance", () => {
    const r = resolveOrganismConfig(pedir(), POP);
    expect(r.staff).toBe(BALANCE.ORGANISM_STAFF_DEFAULT);
    expect(r.autonomyLevel).toBe(BALANCE.ORGANISM_AUTONOMY_DEFAULT);
    expect(r.warnings).toEqual([]);
  });

  it.each([[1, 5], [4.4, 5], [27.6, 28], [500, 50], [-3, 5]])("el personal %s queda en %s (entero 5-50)", (pedido, esperado) => {
    expect(resolveOrganismConfig(pedir({ staff: pedido }), POP).staff).toBe(esperado);
  });

  it.each([[-10, 0], [0, 0], [42.5, 42.5], [100, 100], [900, 100]])("la autonomía %s queda en %s (0-100)", (pedido, esperado) => {
    expect(resolveOrganismConfig(pedir({ autonomyLevel: pedido }), POP).autonomyLevel).toBe(esperado);
  });

  it.each([["alto"], [NaN], [Infinity], [{}], [true]])("un personal o autonomía no numérico (%s) se descarta con aviso", (basura) => {
    const r = resolveOrganismConfig(pedir({ staff: basura, autonomyLevel: basura }), POP);
    expect(r.staff).toBe(BALANCE.ORGANISM_STAFF_DEFAULT);
    expect(r.autonomyLevel).toBe(BALANCE.ORGANISM_AUTONOMY_DEFAULT);
    expect(r.warnings).toHaveLength(2);
  });

  it("acota el presupuesto al rango del país y lo avisa", () => {
    const { min, max } = organismBudgetRange(POP);
    expect(resolveOrganismConfig(pedir({ monthlyBudget: 1 }), POP)).toMatchObject({ monthlyBudget: min, budgetAdjusted: true });
    expect(resolveOrganismConfig(pedir({ monthlyBudget: 9e15 }), POP)).toMatchObject({ monthlyBudget: max, budgetAdjusted: true });
    expect(resolveOrganismConfig(pedir({ monthlyBudget: NaN }), POP)).toMatchObject({ monthlyBudget: min, budgetAdjusted: true });
  });
});

describe("processTurn: crear un organismo aplica lo que eligió el jugador", () => {
  const estado = (): GameState => ({
    programs: [], resourceStocks: [], regions: [], diseases: [], diseasePrevalences: [], diseaseMortality: 0,
    healthEfficiencyStreak: 0, consecutiveSaturationMonths: {}, countryName: "T", currentYear: 2024, currentMonth: 1,
    treasury: 5e9, population: POP, seed: "s", gdp: 1e10, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15,
    foodSecurity: 60, educationLevel: 50, inflation: 2, lifeExpectancy: 68,
    ministries: [{ id: "m", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {}, healthBudgetSplit: {} }],
    officials: [{ id: "fiscal", name: "Fiscal", role: "PROSECUTOR", specialty: null, ministryId: null, partyId: null, loyalty: 70, ambition: 20, wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 5, skill: 75, reputation: 80, status: "ACTIVE" }],
    parties: [], senators: [], activeLaws: [], judicialCases: [], organisms: [],
    socialClasses: [{ id: "sc", key: "MIDDLE", populationPercent: 100, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 }],
    regimeMetrics: { powerConcentration: 30, pressFreedom: 80, judicialIndependence: 80, politicalPluralism: 80, civilLiberties: 80, transparency: 75, militarySubordination: 85 },
    media: [], events: [], consecutiveLowApprovalMonths: 0, longRunningDecisions: [], sanctionsMultiplier: 1,
    tradeGoods: [], tradeFlows: [], tradeBalance: 0, totalImports: 0, totalExports: 0,
  } as unknown as GameState);
  const crear = (config: Record<string, unknown>) =>
    processTurn(estado(), { newOrganisms: { ANTICORRUPTION_PROSECUTION: config } } as unknown as TurnInput, createRNG("org"));

  it("la Fiscalía Anticorrupción nace con el presupuesto, el personal, la autonomía y el titular elegidos", () => {
    const out = crear({ name: "Fiscalía Anticorrupción", monthlyBudget: 300_000_000, headOfficialId: "fiscal", staff: 40, autonomyLevel: 90 });
    const org = out.newState.organisms.find((o) => o.type === "ANTICORRUPTION_PROSECUTION")!;
    expect(org).toMatchObject({ name: "Fiscalía Anticorrupción", monthlyBudget: 300_000_000, staff: 40, autonomyLevel: 90, headOfficialId: "fiscal" });
  });

  it("sigue funcionando con la petición antigua (sin personal ni autonomía)", () => {
    const out = crear({ name: "F", monthlyBudget: 100_000_000 });
    expect(out.newState.organisms[0]).toMatchObject({ staff: 10, autonomyLevel: 50 });
  });

  it("avisa al jugador de lo descartado y de un presupuesto acotado", () => {
    const out = crear({ name: "F", monthlyBudget: 9e15, staff: "mucho" });
    const titulos = out.notifications.map((n) => n.title);
    expect(titulos).toContain("Configuración de organismo ajustada");
    expect(titulos).toContain("Presupuesto de organismo ajustado");
  });

  it("la autonomía elegida (alta o baja) queda en el organismo", () => {
    const alta = crear({ name: "F", monthlyBudget: 100_000_000, autonomyLevel: 95 }).newState.organisms[0];
    const baja = crear({ name: "F", monthlyBudget: 100_000_000, autonomyLevel: 5 }).newState.organisms[0];
    expect(alta.autonomyLevel).toBeGreaterThan(70);
    expect(baja.autonomyLevel).toBeLessThan(30);
  });
});
