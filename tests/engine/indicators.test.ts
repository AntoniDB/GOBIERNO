import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import {
  calculatePoverty,
  calculateUnemployment,
  calculateHealth,
  calculateFoodSecurity,
  calculateCrime,
  calculateEducation,
  calculateGini,
  calculateInflationSimple,
} from "@/lib/engine/indicators";
import { BALANCE } from "@/lib/balance";

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
    ministries: [
      { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 50, internalCorruption: 10, subDecisions: {}, ministerOfficialId: null },
      { id: "min-salud", key: "salud", budgetPercent: 8, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-seguridad", key: "seguridad", budgetPercent: 6, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 50, internalCorruption: 8, subDecisions: {}, ministerOfficialId: null },
      { id: "min-agricultura", key: "agricultura", budgetPercent: 5, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "min-educacion", key: "educacion", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
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

describe("calculatePoverty", () => {
  it("calcula pobreza con valores conocidos", () => {
    const state = crearEstadoBase();
    // socialDevImpact = eff(50) * budgetFactor(7%) = 50 * 0.442 = 22.1
    // economyImpact = app, unemployment = -0.26*28.25+25 ≈ 17.65
    // raw = -0.50*22.1 + 0.5*17.65 + 0.3*0.2 + 43 ≈ 40.8
    const poverty = calculatePoverty(state);
    expect(poverty).toBeCloseTo(40.8, 0);
  });

  it("eficiencia alta reduce la pobreza", () => {
    const stateBase = crearEstadoBase();
    const stateAlta = crearEstadoBase({
      ministries: [
        { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 10, efficiency: 80, internalCorruption: 0, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    const pobrezaBase = calculatePoverty(stateBase);
    const pobrezaAlta = calculatePoverty(stateAlta);
    expect(pobrezaAlta).toBeLessThan(pobrezaBase);
  });
});

describe("calculateUnemployment", () => {
  it("calcula desempleo con valores conocidos", () => {
    const state = crearEstadoBase();
    // economyImpact = eff(50) * budgetFactor(10%) = 50 * 0.565 = 28.25
    // raw = -0.26 * 28.25 + 25 = 17.65
    expect(calculateUnemployment(state)).toBeCloseTo(17.7, 0);
  });

  it("devuelve al menos 2 aunque la eficiencia sea muy alta", () => {
    const state = crearEstadoBase({
      ministries: [
        { id: "min-economia", key: "economia", budgetPercent: 40, efficiency: 100, internalCorruption: 0, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    // economyImpact = 100 * budgetFactor(40%) = 100 * 0.964 = 96.4
    // raw = -0.26*96.4 + 25 = -0.06 → clamp → 2
    expect(calculateUnemployment(state)).toBe(2);
  });
});

describe("calculateHealth", () => {
  it("calcula salud con valores conocidos", () => {
    const state = crearEstadoBase();
    // healthImpact = eff(50) * budgetFactor(8%) = 50 * 0.487 = 24.35
    // raw = -0.34 * 24.35 + 28 ≈ 19.7
    expect(calculateHealth(state)).toBeCloseTo(19.7, 0);
  });

  it("usa impacto 25 por defecto si no existe ministerio de salud", () => {
    const state = crearEstadoBase({ ministries: [] });
    // sin ministerio: impacto = 25. raw = -0.34*25 + 28 = 19.5
    expect(calculateHealth(state)).toBeCloseTo(19.5, 0);
  });
});

describe("calculateFoodSecurity", () => {
  it("calcula seguridad alimentaria con valores conocidos", () => {
    const state = crearEstadoBase();
    // agricultureImpact = eff(50) * budgetFactor(5%) = 50 * 0.341 = 17.05
    // raw = 0.35 * 17.05 + 54 ≈ 60.0
    expect(calculateFoodSecurity(state)).toBeCloseTo(60, 0);
  });
});

describe("calculateCrime", () => {
  it("calcula crimen con valores conocidos", () => {
    const state = crearEstadoBase();
    // securityImpact = eff(50) * budgetFactor(6%) ≈ 19.65, poverty≈40.8, unemp≈17.7
    // raw = -0.35*19.65 + 0.3*40.8 + 0.4*17.7 + 29 ≈ 41.4
    expect(calculateCrime(state)).toBeCloseTo(41.4, 0);
  });
});

describe("calculateEducation", () => {
  it("calcula educacion con valores conocidos", () => {
    const state = crearEstadoBase();
    // educationImpact = eff(50) * budgetFactor(10%) = 50 * 0.565 = 28.25
    // raw = 0.42 * 28.25 + 34 ≈ 45.9
    expect(calculateEducation(state)).toBeCloseTo(45.9, 0);
  });
});

describe("calculateGini", () => {
  it("devuelve el Gini base sin leyes activas", () => {
    const state = crearEstadoBase();
    expect(calculateGini(state, [])).toBe(BALANCE.GINI_BASE);
  });

  it("ley progresiva reduce el Gini", () => {
    const state = crearEstadoBase();
    const gini = calculateGini(state, [
      { id: "law-prog", lawKey: "impuesto_progresivo", activatedAt: "2024-01", effectsJson: {} },
    ]);
    expect(gini).toBe(BALANCE.GINI_BASE + BALANCE.GINI_PROGRESSIVE_TAX_FACTOR);
  });

  it("ley de liberalización aumenta el Gini", () => {
    const state = crearEstadoBase();
    const gini = calculateGini(state, [
      { id: "law-lib", lawKey: "liberalizacion_economica", activatedAt: "2024-01", effectsJson: {} },
    ]);
    expect(gini).toBe(BALANCE.GINI_BASE + BALANCE.GINI_LIBERALIZATION_FACTOR);
  });

  it("se mantiene en rango [20, 70]", () => {
    const state = crearEstadoBase();
    const giniMuchasLeyes = calculateGini(state, [
      { id: "law-p1", lawKey: "impuesto_progresivo", activatedAt: "2024-01", effectsJson: {} },
      { id: "law-p2", lawKey: "otro_progresivo", activatedAt: "2024-01", effectsJson: {} },
      { id: "law-p3", lawKey: "mas_progresivo", activatedAt: "2024-01", effectsJson: {} },
      { id: "law-p4", lawKey: "aun_progresivo", activatedAt: "2024-01", effectsJson: {} },
    ]);
    expect(giniMuchasLeyes).toBeGreaterThanOrEqual(20);
    expect(giniMuchasLeyes).toBeLessThanOrEqual(70);
  });
});

describe("calculateInflationSimple", () => {
  it("devuelve un valor numérico positivo", () => {
    const state = crearEstadoBase();
    const inflation = calculateInflationSimple(state);
    expect(inflation).toBeGreaterThanOrEqual(0);
    expect(typeof inflation).toBe("number");
  });
});

describe("todos los indicadores en rango", () => {
  it("todos los indicadores devuelven valores en [0, 100]", () => {
    const state = crearEstadoBase();
    const indicadores = [
      calculatePoverty(state),
      calculateUnemployment(state),
      calculateHealth(state),
      calculateFoodSecurity(state),
      calculateCrime(state),
      calculateEducation(state),
      calculateGini(state, []),
      calculateInflationSimple(state),
    ];
    for (const val of indicadores) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});
