import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { calculateLifeExpectancy } from "@/lib/engine/indicators";
import { BALANCE } from "@/lib/balance";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    countryName: "República de Prueba",
    currentYear: 2024,
    currentMonth: 1,
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
    consecutiveLowApprovalMonths: 0,
    ...overrides,
  };
}

describe("calculateLifeExpectancy", () => {
  it("S1: pais colapsado devuelve ~53 anios", () => {
    const state = crearEstadoBase({
      sickRate: 45,
      crimeRate: 60,
      povertyRate: 55,
      foodSecurity: 25,
      gdp: 12_000_000_000,
      population: 10_000_000,
    });
    // gdpPerCapita = 12B / 10M = 1200
    // raw = 78 - 0.28*45 - 0.14*60 - 0.12*55 + 0.09*25 + 0.40*1200/1000
    //     = 78 - 12.6 - 8.4 - 6.6 + 2.25 + 0.48
    //     = 53.13
    const le = calculateLifeExpectancy(state);
    expect(le).toBeCloseTo(53.1, 0);
    expect(le).toBeGreaterThanOrEqual(BALANCE.LE_CLAMP_MIN);
  });

  it("S2: partida default motor devuelve ~68 anios", () => {
    const state = crearEstadoBase({
      sickRate: 19.7,
      crimeRate: 41.4,
      povertyRate: 40.8,
      foodSecurity: 60.0,
      gdp: 30_000_000_000,
      population: 10_000_000,
    });
    // gdpPerCapita = 30B / 10M = 3000
    // raw = 78 - 0.28*19.7 - 0.14*41.4 - 0.12*40.8 + 0.09*60 + 0.40*3
    //     = 78 - 5.516 - 5.796 - 4.896 + 5.4 + 1.2
    //     = 68.39
    const le = calculateLifeExpectancy(state);
    expect(le).toBeCloseTo(68.4, 0);
  });

  it("S3: pais desarrollado devuelve ~78 anios (capped)", () => {
    const state = crearEstadoBase({
      sickRate: 6,
      crimeRate: 12,
      povertyRate: 8,
      foodSecurity: 88,
      gdp: 54_000_000_000,
      population: 10_000_000,
    });
    // gdpPerCapita = 54B / 10M = 5400
    // raw = 78 - 0.28*6 - 0.14*12 - 0.12*8 + 0.09*88 + 0.40*5.4
    //     = 78 - 1.68 - 1.68 - 0.96 + 7.92 + 2.16
    //     = 83.76
    const le = calculateLifeExpectancy(state);
    expect(le).toBeCloseTo(83.8, 0);
    expect(le).toBeLessThanOrEqual(BALANCE.LE_CLAMP_MAX);
  });

  it("S4: post-reformas devuelve ~72 anios", () => {
    const state = crearEstadoBase({
      sickRate: 10,
      crimeRate: 18,
      povertyRate: 14,
      foodSecurity: 75,
      gdp: 40_000_000_000,
      population: 10_000_000,
    });
    // gdpPerCapita = 4000
    // raw = 78 - 2.8 - 2.52 - 1.68 + 6.75 + 1.6 = 79.35
    const le = calculateLifeExpectancy(state);
    expect(le).toBeGreaterThanOrEqual(72);
    expect(le).toBeLessThanOrEqual(85);
  });

  it("clamp inferior: estado hiper-catastrofico no baja de 48", () => {
    const state = crearEstadoBase({
      sickRate: 80,
      crimeRate: 90,
      povertyRate: 90,
      foodSecurity: 5,
      gdp: 500_000_000,
      population: 10_000_000,
    });
    const le = calculateLifeExpectancy(state);
    expect(le).toBeGreaterThanOrEqual(BALANCE.LE_CLAMP_MIN);
    expect(le).toBe(BALANCE.LE_CLAMP_MIN);
  });

  it("clamp superior: paraiso perfecto no supera 85", () => {
    const state = crearEstadoBase({
      sickRate: 1,
      crimeRate: 2,
      povertyRate: 2,
      foodSecurity: 99,
      gdp: 100_000_000_000,
      population: 10_000_000,
    });
    const le = calculateLifeExpectancy(state);
    expect(le).toBeLessThanOrEqual(BALANCE.LE_CLAMP_MAX);
    expect(le).toBe(BALANCE.LE_CLAMP_MAX);
  });

  it("usa gdpPerCapita explicito si se pasa como argumento", () => {
    const state = crearEstadoBase({
      sickRate: 5,
      crimeRate: 10,
      povertyRate: 10,
      foodSecurity: 90,
      gdp: 50_000_000_000,
      population: 10_000_000,
    });
    const leConGdpPerCapitaExplicito = calculateLifeExpectancy(state, 8000);
    const leSinGdpPerCapita = calculateLifeExpectancy(state);
    // Con gdpPerCapita = 8000: raw = 78 - 1.4 - 1.4 - 1.2 + 8.1 + 3.2 = 85.3 -> clamp 85
    expect(leConGdpPerCapitaExplicito).toBe(BALANCE.LE_CLAMP_MAX);
    expect(leSinGdpPerCapita).toBeLessThan(leConGdpPerCapitaExplicito);
  });

  it("valores extremos de indicadores no producen NaN", () => {
    const state = crearEstadoBase({
      sickRate: 0,
      crimeRate: 0,
      povertyRate: 0,
      foodSecurity: 0,
      gdp: 0,
      population: 0,
    });
    const le = calculateLifeExpectancy(state);
    expect(Number.isNaN(le)).toBe(false);
    expect(le).toBeGreaterThanOrEqual(0);
    expect(le).toBeLessThanOrEqual(100);
  });
});
