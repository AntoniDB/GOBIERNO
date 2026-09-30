import { describe, it, expect } from "vitest";
import type { GameState, TradeGoodState, TradeFlowState } from "@/lib/engine/types";
import {
  createDefaultTradeGoods,
  calculateDemand,
  treasuryImportFactor,
  applySanctions,
  processTradeFlows,
  calculateImportCoverage,
  isMedicationShortage,
} from "@/lib/engine/trade";
import { BALANCE } from "@/lib/balance";

function crearTradeGood(category: "MEDICAMENTS_GENERIC" | "MEDICAMENTS_BRAND"): TradeGoodState {
  return {
    id: `tg-${category.toLowerCase()}`,
    gameId: "test-game",
    key: category === "MEDICAMENTS_GENERIC" ? "medicamentos_genericos" : "medicamentos_marca",
    category,
    name: category === "MEDICAMENTS_GENERIC" ? "Medicamentos genéricos" : "Medicamentos de marca",
    description: "test",
    baseCostPerUnit: category === "MEDICAMENTS_GENERIC" ? 50 : 200,
    unitDescription: "Tratamiento mensual para 100 personas",
    demandPerCapita: 0.00001,
  };
}

function crearTradeFlow(overrides?: Partial<TradeFlowState>): TradeFlowState {
  return {
    id: "tf-test",
    gameId: "test-game",
    tradeGoodId: "tg-medicaments_generic",
    direction: "IMPORT",
    monthlyVolume: 100,
    targetVolume: 100,
    unitCost: 50,
    sanctionsMultiplier: 1.0,
    monthlyCost: 5000,
    isActive: true,
    ...overrides,
  };
}

function crearEstado(overrides?: Partial<GameState>): GameState {
  return {
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 100_000_000,
    population: 10_000_000,
    seed: "test",
    gdp: 30_000_000_000,
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
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    consecutiveLowApprovalMonths: 0,
    sanctionsMultiplier: 1.0,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
//  1. createDefaultTradeGoods
// ──────────────────────────────────────────────────────────────────────────────

describe("createDefaultTradeGoods", () => {
  it("creates 2 goods (generic + brand) for a game", () => {
    const goods = createDefaultTradeGoods(1, "game-1");
    expect(goods).toHaveLength(2);
    expect(goods[0].category).toBe("MEDICAMENTS_GENERIC");
    expect(goods[1].category).toBe("MEDICAMENTS_BRAND");
    expect(goods[0].gameId).toBe("game-1");
    expect(goods[1].gameId).toBe("game-1");
  });

  it("uses different IDs for different idx values", () => {
    const g1 = createDefaultTradeGoods(1, "game-1");
    const g2 = createDefaultTradeGoods(2, "game-1");
    expect(g1[0].id).not.toBe(g2[0].id);
  });

  it("sets correct baseCostPerUnit for each category", () => {
    const goods = createDefaultTradeGoods(1, "game-1");
    expect(goods[0].baseCostPerUnit).toBe(50);
    expect(goods[1].baseCostPerUnit).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  2. calculateDemand
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateDemand", () => {
  it("returns ceil of pop*demandPerCapita", () => {
    // 10_000_000 * 0.00001 = 100 (pero posible floating-point > 100, ceil = 101)
    expect(calculateDemand(10_000_000, 0.00001)).toBeGreaterThanOrEqual(100);
    expect(calculateDemand(10_001, 0.00001)).toBe(1);
    expect(calculateDemand(9_999, 0.00001)).toBe(1);
  });

  it("returns 0 for 0 population", () => {
    expect(calculateDemand(0, 0.00001)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  3. treasuryImportFactor
// ──────────────────────────────────────────────────────────────────────────────

describe("treasuryImportFactor", () => {
  it("returns 1.0 when treasury >= CRITICAL_THRESHOLD", () => {
    expect(treasuryImportFactor(BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD)).toBe(1.0);
    expect(treasuryImportFactor(BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD * 2)).toBe(1.0);
  });

  it("clamps to MIN_FACTOR when treasury is 0", () => {
    expect(treasuryImportFactor(0)).toBe(BALANCE.TRADE_IMPORT_MIN_FACTOR);
  });

  it("returns proportional factor at intermediate values", () => {
    const half = BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD / 2;
    const expected = Math.max(BALANCE.TRADE_IMPORT_MIN_FACTOR, half / BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD);
    expect(treasuryImportFactor(half)).toBe(expected);
  });

  it("is continuous (no discrete steps)", () => {
    // Usar valores por encima del MIN_FACTOR para evitar clamping
    const factors = [0.4, 0.6, 0.8, 1.0].map(
      (pct) => treasuryImportFactor(pct * BALANCE.TRADE_TREASURY_CRITICAL_THRESHOLD),
    );
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThan(factors[i - 1]);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  4. applySanctions
// ──────────────────────────────────────────────────────────────────────────────

describe("applySanctions", () => {
  it("reduces volume by multiplier, increases unit cost proportionally", () => {
    const result = applySanctions(100, 50, 2.0);
    expect(result.volume).toBeCloseTo(50, 5);
    expect(result.unitCost).toBe(100);
  });

  it("keeps total cost unchanged: volume * unitCost = original target * baseCost", () => {
    const result = applySanctions(80, 50, 2.5);
    const totalCost = result.volume * result.unitCost;
    const originalCost = 80 * 50;
    expect(totalCost).toBeCloseTo(originalCost, 0);
  });

  it("returns original values when sanctionsMultiplier is 1.0", () => {
    const result = applySanctions(100, 50, 1.0);
    expect(result.volume).toBe(100);
    expect(result.unitCost).toBe(50);
  });

  it("increases volume when sanctionsMultiplier < 1 (trade bonus)", () => {
    const result = applySanctions(100, 50, 0.5);
    expect(result.volume).toBe(200);
    expect(result.unitCost).toBe(25);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  5. processTradeFlows
// ──────────────────────────────────────────────────────────────────────────────

describe("processTradeFlows", () => {
  it("deducts import cost from treasury", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      targetVolume: 100,
      monthlyVolume: 0,
      monthlyCost: 0,
    });
    const state = crearEstado({
      treasury: 100_000_000,
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    processTradeFlows(state);

    expect(state.treasury).toBeLessThan(100_000_000);
    expect(state.treasury).toBeGreaterThanOrEqual(0);
  });

  it("calculates totalImports, totalExports, tradeBalance", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      targetVolume: 100,
    });
    const state = crearEstado({
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    const result = processTradeFlows(state);

    expect(result.totalImports).toBeGreaterThan(0);
    expect(result.totalExports).toBe(0);
    expect(result.tradeBalance).toBeLessThan(0);
    expect(result.tradeBalance).toBe(-result.totalImports);
  });

  it("applies sanctionsMultiplier from state", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      targetVolume: 100,
    });
    const state = crearEstado({
      sanctionsMultiplier: 2.0,
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    processTradeFlows(state);

    const updatedFlow = state.tradeFlows[0];
    expect(updatedFlow.unitCost).toBe(100); // 50 * 2
    expect(updatedFlow.monthlyVolume).toBeLessThan(100); // reduced by sanctions
  });

  it("skips inactive flows", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      isActive: false,
    });
    const state = crearEstado({
      treasury: 100_000_000,
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    const result = processTradeFlows(state);

    expect(result.totalImports).toBe(0);
    expect(state.treasury).toBe(100_000_000); // unchanged
  });

  it("handles multiple import flows", () => {
    const good1 = crearTradeGood("MEDICAMENTS_GENERIC");
    const good2 = crearTradeGood("MEDICAMENTS_BRAND");
    const flow1 = crearTradeFlow({
      id: "tf-gen",
      tradeGoodId: good1.id,
      targetVolume: 100,
    });
    const flow2Fixed: TradeFlowState = {
      id: "tf-brand",
      gameId: "test-game",
      tradeGoodId: good2.id,
      direction: "IMPORT",
      monthlyVolume: 0,
      targetVolume: 50,
      unitCost: 200,
      sanctionsMultiplier: 1.0,
      monthlyCost: 0,
      isActive: true,
    };
    const state = crearEstado({
      treasury: 100_000_000,
      tradeGoods: [good1, good2],
      tradeFlows: [flow1, flow2Fixed],
    });

    const result = processTradeFlows(state);

    expect(result.totalImports).toBeGreaterThan(0);
    expect(state.tradeFlows).toHaveLength(2);
    state.tradeFlows.forEach((f) => {
      expect(f.monthlyVolume).toBeGreaterThan(0);
      expect(f.monthlyCost).toBeGreaterThan(0);
    });
  });

  it("treasury constraint reduces volume when treasury is low", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      targetVolume: 100,
    });
    const state = crearEstado({
      treasury: 1_000_000, // muy bajo
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    processTradeFlows(state);

    const updatedFlow = state.tradeFlows[0];
    expect(updatedFlow.monthlyVolume).toBeLessThan(100);
  });

  it("does not go below 0 treasury", () => {
    const good = crearTradeGood("MEDICAMENTS_GENERIC");
    const flow = crearTradeFlow({
      id: "tf-1",
      tradeGoodId: good.id,
      targetVolume: 1_000_000,
    });
    const state = crearEstado({
      treasury: 100,
      tradeGoods: [good],
      tradeFlows: [flow],
    });

    processTradeFlows(state);

    expect(state.treasury).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  6. calculateImportCoverage
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateImportCoverage", () => {
  it("returns 1.0 when monthlyVolume >= targetVolume", () => {
    const flow = crearTradeFlow({ monthlyVolume: 100, targetVolume: 100 });
    const state = crearEstado({ tradeFlows: [flow] });
    expect(calculateImportCoverage(state)).toBe(1.0);
  });

  it("returns ratio when volume < target", () => {
    const flow = crearTradeFlow({ monthlyVolume: 50, targetVolume: 100 });
    const state = crearEstado({ tradeFlows: [flow] });
    expect(calculateImportCoverage(state)).toBe(0.5);
  });

  it("returns 1.0 when no flows exist", () => {
    const state = crearEstado();
    expect(calculateImportCoverage(state)).toBe(1.0);
  });

  it("ignores EXPORT flows", () => {
    const importFlow = crearTradeFlow({ direction: "IMPORT", monthlyVolume: 10, targetVolume: 100 });
    const exportFlow: TradeFlowState = {
      ...crearTradeFlow({ id: "tf-export", direction: "EXPORT", monthlyVolume: 50, targetVolume: 100 }),
    };
    const state = crearEstado({ tradeFlows: [importFlow, exportFlow] });
    expect(calculateImportCoverage(state)).toBe(0.1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  7. isMedicationShortage
// ──────────────────────────────────────────────────────────────────────────────

describe("isMedicationShortage", () => {
  it("returns false when coverage >= TRADE_SHORTAGE_COVERAGE_THRESHOLD", () => {
    const threshold = BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD;
    const flow = crearTradeFlow({
      monthlyVolume: Math.ceil(threshold * 100),
      targetVolume: 100,
    });
    const state = crearEstado({ tradeFlows: [flow] });
    expect(isMedicationShortage(state)).toBe(false);
  });

  it("returns true when coverage < TRADE_SHORTAGE_COVERAGE_THRESHOLD", () => {
    const threshold = BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD;
    const flow = crearTradeFlow({
      monthlyVolume: Math.floor(threshold * 100) - 1,
      targetVolume: 100,
    });
    const state = crearEstado({ tradeFlows: [flow] });
    expect(isMedicationShortage(state)).toBe(true);
  });

  it("returns false when all flows are EXPORT", () => {
    const flow: TradeFlowState = {
      ...crearTradeFlow({ direction: "EXPORT", monthlyVolume: 10, targetVolume: 100 }),
    };
    const state = crearEstado({ tradeFlows: [flow] });
    expect(isMedicationShortage(state)).toBe(false);
  });
});
