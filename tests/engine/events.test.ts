import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { triggerRandomEvents } from "@/lib/engine/events";
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
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 70, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 70, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc-rich", key: "RICH", populationPercent: 10, averageIncome: 5000, approval: 60, demands: [], educationLevel: 80, healthAccess: 90 },
      { id: "sc-middle", key: "MIDDLE", populationPercent: 65, averageIncome: 2000, approval: 55, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "sc-poverty", key: "POVERTY", populationPercent: 25, averageIncome: 500, approval: 45, demands: [], educationLevel: 30, healthAccess: 40 },
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

describe("triggerRandomEvents", () => {
  it("con estado sin triggers (salud, seguridad, corrupción bajos) debe devolver vacío la mayoría de veces", () => {
    const state = crearEstadoBase();
    const rng = createRNG("sin-triggers");
    const { newEvents } = triggerRandomEvents(state, rng);
    // Con saludEff=70 (>40) y corrupción 0 (<40) y otros umbrales bien,
    // solo DISASTER tiene condition:true con prob 0.03. Puede no dispararse.
    // Verificamos que no se disparen eventos condicionales.
    const tiposCondicionales = newEvents.filter(e => e.type !== "DISASTER");
    expect(tiposCondicionales.length).toBe(0);
  });

  it("con estado de corrupción alta, el número de eventos es determinista", () => {
    // Con alta corrupción + semilla fija, verificamos que el resultado es
    // determinista (aunque no sepamos cuántos eventos se disparan exactamente)
    const state = crearEstadoBase({
      officials: [
        { id: "off-1", name: "Corrupto", role: "MINISTER", ministryId: null, partyId: null, loyalty: 50, ambition: 60, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 90, skill: 50, reputation: 20, status: "ACTIVE" },
      ],
    });
    const rng1 = createRNG("alta-corrupcion");
    const rng2 = createRNG("alta-corrupcion");
    const res1 = triggerRandomEvents(state, rng1);
    const res2 = triggerRandomEvents(state, rng2);
    // El resultado debe ser idéntico para ambas ejecuciones
    expect(res1.newEvents.length).toBe(res2.newEvents.length);
    expect(res1.newEvents.map(e => e.type)).toEqual(res2.newEvents.map(e => e.type));
    if (res1.newEvents.length > 0) {
      const scandal = res1.newEvents.find(e => e.type === "SCANDAL");
      // Puede o no haber SCANDAL, pero si hay, debe tener la estructura correcta
      if (scandal) {
        expect(scandal.severity).toBeGreaterThan(0);
        expect(scandal.description).toBeTruthy();
        expect(scandal.year).toBe(2024);
      }
    }
  });

  it("los eventos devueltos tienen la estructura correcta", () => {
    const state = crearEstadoBase({
      officials: [
        { id: "off-1", name: "Corrupto", role: "MINISTER", ministryId: null, partyId: null, loyalty: 50, ambition: 60, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 90, skill: 50, reputation: 20, status: "ACTIVE" },
      ],
      ministries: [
        { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 20, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    const rng = createRNG("estructura-evento");
    const { newEvents, notifications } = triggerRandomEvents(state, rng);
    for (const event of newEvents) {
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("type");
      expect(event).toHaveProperty("severity");
      expect(event).toHaveProperty("year");
      expect(event).toHaveProperty("month");
      expect(event).toHaveProperty("description");
      expect(event).toHaveProperty("effectsApplied");
      expect(event).toHaveProperty("resolvedAt");
      expect(typeof event.id).toBe("string");
      expect(typeof event.type).toBe("string");
      expect(typeof event.severity).toBe("number");
      expect(event.severity).toBeGreaterThanOrEqual(0);
      expect(event.severity).toBeLessThanOrEqual(100);
    }
    for (const notif of notifications) {
      expect(notif).toHaveProperty("type");
      expect(notif).toHaveProperty("title");
      expect(notif).toHaveProperty("description");
      expect(["event", "warning", "info", "law", "case", "crisis"]).toContain(notif.type);
    }
  });

  it("es determinista: mismo estado + misma semilla = mismos eventos", () => {
    const state = crearEstadoBase({
      officials: [
        { id: "off-1", name: "Corrupto", role: "MINISTER", ministryId: null, partyId: null, loyalty: 50, ambition: 60, wealth: 500000, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 70, skill: 50, reputation: 20, status: "ACTIVE" },
      ],
    });
    const rng1 = createRNG("det-events");
    const rng2 = createRNG("det-events");
    const res1 = triggerRandomEvents(state, rng1);
    const res2 = triggerRandomEvents(state, rng2);
    expect(res1.newEvents.map(e => e.id)).toEqual(res2.newEvents.map(e => e.id));
    expect(res1.newEvents.map(e => e.type)).toEqual(res2.newEvents.map(e => e.type));
    expect(res1.newEvents.map(e => e.severity)).toEqual(res2.newEvents.map(e => e.severity));
  });
});
