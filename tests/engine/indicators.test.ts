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
    ...overrides,
  };
}

describe("calculatePoverty", () => {
  it("calcula pobreza con valores conocidos", () => {
    const state = crearEstadoBase();
    // socialDevEff = 50 (eficiencia)
    // unemployment = -0.4 * 50 + 8 = -20 + 8 → clamp(2, 50) → 2? Wait, -20+8=-12, clamp to 2
    // unemployment = 2
    // inflation = base 0.2 + sin déficit = 0.2
    // raw = -0.3*50 + 0.5*2 + 0.3*0.2 + 25 = -15 + 1 + 0.06 + 25 = 11.06
    const poverty = calculatePoverty(state);
    expect(poverty).toBeCloseTo(11.06, 1);
  });

  it("eficiencia alta reduce la pobreza", () => {
    const stateBase = crearEstadoBase();
    const stateAlta = crearEstadoBase({
      ministries: [
        { id: "min-desarrollo", key: "desarrollo_social", budgetPercent: 7, efficiency: 90, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
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
    // economyEff = 50
    // raw = -0.4 * 50 + 8 = -20 + 8 = -12 → clamp [2, 50] → 2
    expect(calculateUnemployment(state)).toBe(2);
  });

  it("devuelve al menos 2 aunque la eficiencia sea muy alta", () => {
    const state = crearEstadoBase({
      ministries: [
        { id: "min-economia", key: "economia", budgetPercent: 10, efficiency: 100, internalCorruption: 0, subDecisions: {}, ministerOfficialId: null },
      ],
    });
    expect(calculateUnemployment(state)).toBe(2);
  });
});

describe("calculateHealth", () => {
  it("calcula salud con valores conocidos", () => {
    const state = crearEstadoBase();
    // healthEff = 50
    // raw = -0.5 * 50 + 5 = -25 + 5 = -20 → clamp [0, 50] → 0
    expect(calculateHealth(state)).toBe(0);
  });

  it("usa eficiencia 50 por defecto si no existe ministerio de salud", () => {
    const state = crearEstadoBase({ ministries: [] });
    expect(calculateHealth(state)).toBe(0);
  });
});

describe("calculateFoodSecurity", () => {
  it("calcula seguridad alimentaria con valores conocidos", () => {
    const state = crearEstadoBase();
    // agricultureEff = 50
    // raw = 0.4 * 50 + 75 = 20 + 75 = 95 → clamp [0, 100] → 95
    expect(calculateFoodSecurity(state)).toBe(95);
  });
});

describe("calculateCrime", () => {
  it("calcula crimen con valores conocidos", () => {
    const state = crearEstadoBase();
    // securityEff=50, poverty≈11.06, unemployment=2
    // raw = -0.6*50 + 0.3*11.06 + 0.4*2 + 10 = -30 + 3.318 + 0.8 + 10 = -15.882 → clamp → 0
    expect(calculateCrime(state)).toBe(0);
  });
});

describe("calculateEducation", () => {
  it("calcula educación con valores conocidos", () => {
    const state = crearEstadoBase();
    // educationEff = 50
    // raw = 0.5 * 50 + 50 = 25 + 50 = 75
    expect(calculateEducation(state)).toBe(75);
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
