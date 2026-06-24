import { describe, it, expect } from "vitest";
import type { GameState, MinistryState, ResourceStockState } from "@/lib/engine/types";
import {
  calculateResourceFlows,
  calculateResourceEfficiency,
  updateResourceStocks,
  applyResourceDecay,
  processResourceBalance,
  RESOURCE_TYPES,
} from "@/lib/engine/resource-balance";
import { BALANCE } from "@/lib/balance";

function crearMinisterio(overrides?: Partial<MinistryState>): MinistryState {
  return {
    id: "min-test",
    key: "HEALTH",
    budgetPercent: 10,
    efficiency: 50,
    internalCorruption: 5,
    subDecisions: {},
    ministerOfficialId: null,
    producedResources: {},
    consumedResources: {},
    ...overrides,
  };
}

function crearStock(resourceType: string, quantity: number): ResourceStockState {
  return { id: `rs-${resourceType}`, resourceType, quantity };
}

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "test",
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
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
    },
    media: [],
    events: [],
    longRunningDecisions: [],
    resourceStocks: [],
    consecutiveLowApprovalMonths: 0,
    ...overrides,
  };
}

describe("calculateResourceFlows", () => {
  it("calcula produccion desde los ministerios con eficiencia", () => {
    const ministries: MinistryState[] = [
      crearMinisterio({
        key: "HEALTH",
        efficiency: 80,
        producedResources: { medical_professionals: 10 },
      }),
    ];
    const { production } = calculateResourceFlows(ministries);
    // 10 * (80/100) = 8
    expect(production["medical_professionals"]).toBeCloseTo(8, 0);
  });

  it("calcula consumo desde los ministerios", () => {
    const ministries: MinistryState[] = [
      crearMinisterio({
        key: "HEALTH",
        consumedResources: { medical_professionals: 15, infrastructure_capacity: 5 },
      }),
    ];
    const { consumption } = calculateResourceFlows(ministries);
    expect(consumption["medical_professionals"]).toBe(15);
    expect(consumption["infrastructure_capacity"]).toBe(5);
  });

  it("suma produccion de multiples ministerios", () => {
    const ministries: MinistryState[] = [
      crearMinisterio({
        id: "min-edu",
        key: "EDUCATION",
        efficiency: 100,
        producedResources: { teachers: 20 },
      }),
      crearMinisterio({
        id: "min-hea",
        key: "HEALTH",
        efficiency: 50,
        producedResources: { medical_professionals: 10 },
      }),
    ];
    const { production } = calculateResourceFlows(ministries);
    expect(production["teachers"]).toBeCloseTo(20, 0);
    expect(production["medical_professionals"]).toBeCloseTo(5, 0);
  });
});

describe("updateResourceStocks", () => {
  it("produccion sin consumo acumula stock", () => {
    const stocks: ResourceStockState[] = [];
    const production = { medical_professionals: 10 };
    const consumption = {};
    const result = updateResourceStocks(stocks, production, consumption);
    expect(result.find((s) => s.resourceType === "medical_professionals")?.quantity).toBe(10);
  });

  it("consumo sin produccion reduce stock con floor 0", () => {
    const stocks: ResourceStockState[] = [crearStock("soldiers", 5)];
    const production = {};
    const consumption = { soldiers: 10 };
    const result = updateResourceStocks(stocks, production, consumption);
    const soldiers = result.find((s) => s.resourceType === "soldiers");
    expect(soldiers?.quantity).toBe(0);
  });

  it("produccion y consumo combinados", () => {
    const stocks: ResourceStockState[] = [crearStock("engineers", 100)];
    const production = { engineers: 20 };
    const consumption = { engineers: 15 };
    const result = updateResourceStocks(stocks, production, consumption);
    const eng = result.find((s) => s.resourceType === "engineers");
    expect(eng?.quantity).toBe(105);
  });
});

describe("calculateResourceEfficiency", () => {
  it("sin recursos consumidos, eficiencia nominal (1.0)", () => {
    const ministry = crearMinisterio({ consumedResources: {} });
    const stocks: ResourceStockState[] = [];
    const eff = calculateResourceEfficiency(ministry, stocks);
    expect(eff).toBe(1.0);
  });

  it("con deficit, factor de eficiencia < 1.0", () => {
    const ministry = crearMinisterio({
      consumedResources: { medical_professionals: 100 },
    });
    const stocks: ResourceStockState[] = [crearStock("medical_professionals", 40)];
    const eff = calculateResourceEfficiency(ministry, stocks);
    // deficit factor = 40/100 = 0.4
    expect(eff).toBe(0.4);
  });

  it("con stock suficiente, factor de eficiencia >= 1.0", () => {
    const ministry = crearMinisterio({
      consumedResources: { medical_professionals: 100 },
    });
    const stocks: ResourceStockState[] = [crearStock("medical_professionals", 150)];
    const eff = calculateResourceEfficiency(ministry, stocks);
    // surplus = 50, bonus = 1 - exp(-50/20) ≈ 0.92, capped at 0.2 → 1 + 0.2*0.92 ≈ 1.18
    expect(eff).toBeGreaterThanOrEqual(1.0);
  });

  it("bonus por excedente no supera el cap", () => {
    const ministry = crearMinisterio({
      consumedResources: { teachers: 10 },
    });
    const stocks: ResourceStockState[] = [crearStock("teachers", 10000)];
    const eff = calculateResourceEfficiency(ministry, stocks);
    // Max bonus = 1 + SURPLUS_BONUS_CAP = 1.2
    expect(eff).toBeLessThanOrEqual(1 + BALANCE.RESOURCE_SURPLUS_BONUS_CAP + 0.01);
  });

  it("respeta el floor de eficiencia", () => {
    const ministry = crearMinisterio({
      consumedResources: { soldiers: 100 },
    });
    const stocks: ResourceStockState[] = [crearStock("soldiers", 0)];
    const eff = calculateResourceEfficiency(ministry, stocks);
    expect(eff).toBe(BALANCE.RESOURCE_EFFICIENCY_FLOOR);
  });

  it("combina factores de multiples recursos", () => {
    const ministry = crearMinisterio({
      consumedResources: {
        medical_professionals: 50,
        engineers: 20,
      },
    });
    const stocks: ResourceStockState[] = [
      crearStock("medical_professionals", 25),  // deficit 0.5
      crearStock("engineers", 10),                // deficit 0.5
    ];
    const eff = calculateResourceEfficiency(ministry, stocks);
    // 0.5 * 0.5 = 0.25, clamped to floor
    expect(eff).toBe(BALANCE.RESOURCE_EFFICIENCY_FLOOR);
  });
});

describe("applyResourceDecay", () => {
  it("aplica decaimiento solo al excedente", () => {
    const stocks: ResourceStockState[] = [crearStock("engineers", 200)];
    const consumption = { engineers: 100 }; // surplus = 100
    const result = applyResourceDecay(stocks, consumption);
    // decay = 100 * 0.015 = 1.5 → new qty = 200 - 1.5 = 198.5
    expect(result[0].quantity).toBeCloseTo(198.5, 1);
  });

  it("no aplica decaimiento si no hay excedente", () => {
    const stocks: ResourceStockState[] = [crearStock("soldiers", 50)];
    const consumption = { soldiers: 60 }; // no surplus
    const result = applyResourceDecay(stocks, consumption);
    expect(result[0].quantity).toBe(50);
  });
});

describe("processResourceBalance", () => {
  it("orquesta el flujo completo: produce → consume → actualiza stock → ajusta eficiencia", () => {
    const state = crearEstadoBase({
      ministries: [
        crearMinisterio({
          id: "min-edu",
          key: "EDUCATION",
          efficiency: 100,
          producedResources: { teachers: 50 },
        }),
        crearMinisterio({
          id: "min-hea",
          key: "HEALTH",
          efficiency: 50,
          consumedResources: { teachers: 30 },
        }),
      ],
      resourceStocks: [],
    });

    processResourceBalance(state);

    // Stock de teachers: prod=50, cons=30 → 20 en stock
    const teacherStock = state.resourceStocks.find((s) => s.resourceType === "teachers");
    expect(teacherStock?.quantity).toBeGreaterThanOrEqual(19); // con decaimiento

    // Eficiencia de HEALTH ajustada: consume 30 teachers, stock 20 → deficit 0.667
    // eff = 50 * 0.667 = 33.3
    const healthMin = state.ministries.find((m) => m.key === "HEALTH");
    expect(healthMin?.efficiency).toBeCloseTo(33.3, 0);
  });

  it("ministerio sin dependencias no se ve afectado", () => {
    const state = crearEstadoBase({
      ministries: [
        crearMinisterio({
          id: "min-econ",
          key: "ECONOMY",
          efficiency: 60,
          producedResources: {},
          consumedResources: {},
        }),
      ],
      resourceStocks: [],
    });

    const effBefore = state.ministries[0].efficiency;
    processResourceBalance(state);
    const effAfter = state.ministries[0].efficiency;
    // Sin consumir nada, eficiencia no cambia
    expect(effAfter).toBe(effBefore);
  });
});
