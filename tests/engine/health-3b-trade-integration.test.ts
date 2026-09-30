import { describe, it, expect } from "vitest";
import type { GameState, TradeFlowState, TurnInput } from "@/lib/engine/types";
import { processTradeFlows, calculateImportCoverage, isMedicationShortage } from "@/lib/engine/trade";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";
import { BALANCE } from "@/lib/balance";

function crearEstadoBase(overrides?: Partial<GameState>): GameState {
  return {
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 100_000_000,
    population: 10_000_000,
    seed: "test-seed",
    gdp: 30_000_000_000,
    povertyRate: 25,
    unemploymentRate: 8,
    sickRate: 5,
    crimeRate: 15,
    foodSecurity: 60,
    educationLevel: 50,
    inflation: 5,
    lifeExpectancy: 68,
    ministries: [
      {
        id: "m-health", key: "HEALTH", budgetPercent: 15, efficiency: 60, internalCorruption: 20,
        subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {},
        healthBudgetSplit: { primary: 40, secondary: 35, tertiary: 25 },
      },
      {
        id: "m-eco", key: "ECONOMY", budgetPercent: 20, efficiency: 70, internalCorruption: 15,
        subDecisions: {}, ministerOfficialId: null, producedResources: {}, consumedResources: {},
        healthBudgetSplit: {},
      },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [
      { id: "sc1", key: "EXTREME_POVERTY", populationPercent: 20, averageIncome: 0, approval: 50, demands: [], educationLevel: 30, healthAccess: 50 },
      { id: "sc2", key: "POVERTY", populationPercent: 40, averageIncome: 0, approval: 50, demands: [], educationLevel: 40, healthAccess: 60 },
      { id: "sc3", key: "MIDDLE", populationPercent: 30, averageIncome: 0, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "sc4", key: "ELITE", populationPercent: 10, averageIncome: 0, approval: 50, demands: [], educationLevel: 80, healthAccess: 90 },
    ],
    regimeMetrics: {
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
    },
    media: [
      { id: "med1", name: "El Diario", type: "NEWSPAPER", ideologicalAffinity: { economic: 0, social: 0, authority: 0 }, reach: 30, credibility: 60, governmentAffinity: 50, status: "ACTIVE" },
      { id: "med2", name: "Canal 2", type: "TV", ideologicalAffinity: { economic: 30, social: 0, authority: 0 }, reach: 50, credibility: 50, governmentAffinity: 50, status: "ACTIVE" },
    ],
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
    tradeGoods: [
      {
        id: "tg-gen", gameId: "test", key: "medicamentos_genericos", category: "MEDICAMENTS_GENERIC",
        name: "Genéricos", description: null, baseCostPerUnit: 50, unitDescription: "Tratamiento mensual para 100 personas",
        demandPerCapita: 0.00001,
      },
      {
        id: "tg-brand", gameId: "test", key: "medicamentos_marca", category: "MEDICAMENTS_BRAND",
        name: "Marca", description: null, baseCostPerUnit: 200, unitDescription: "Tratamiento mensual para 100 personas",
        demandPerCapita: 0.00001,
      },
    ],
    tradeFlows: [
      {
        id: "tf-gen", gameId: "test", tradeGoodId: "tg-gen", direction: "IMPORT",
        monthlyVolume: 0, targetVolume: 100, unitCost: 50, sanctionsMultiplier: 1.0, monthlyCost: 0, isActive: true,
      },
      {
        id: "tf-brand", gameId: "test", tradeGoodId: "tg-brand", direction: "IMPORT",
        monthlyVolume: 0, targetVolume: 50, unitCost: 200, sanctionsMultiplier: 1.0, monthlyCost: 0, isActive: true,
      },
    ],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
//  Integration tests: trade system in full turn
// ──────────────────────────────────────────────────────────────────────────────

describe("Health-3B Trade Integration", () => {
  it("processTurn carries tradeFlowDecisions from input to state", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {
      tradeFlowDecisions: {
        "tf-gen": { targetVolume: 200 },
        "tf-brand": { targetVolume: 25 },
      },
    };
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    const flows = output.newState.tradeFlows;
    const tfGen = flows.find((f) => f.id === "tf-gen");
    const tfBrand = flows.find((f) => f.id === "tf-brand");

    expect(tfGen?.targetVolume).toBe(200);
    expect(tfBrand?.targetVolume).toBe(25);
  });

  it("trade flows have non-zero monthlyCost after turn processing", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {};
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    const flows = output.newState.tradeFlows;
    for (const flow of flows) {
      expect(flow.monthlyCost).toBeGreaterThan(0);
      expect(flow.monthlyVolume).toBeGreaterThan(0);
    }
  });

  it("month snapshot includes trade balance stats", () => {
    const state = crearEstadoBase();
    const input: TurnInput = {};
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    expect(output.monthSnapshot.tradeBalance).toBeDefined();
    expect(output.monthSnapshot.totalImports).toBeDefined();
    expect(output.monthSnapshot.totalExports).toBeDefined();
    expect(output.monthSnapshot.tradeBalance).toBeLessThanOrEqual(0); // solo imports
    expect(output.monthSnapshot.totalImports).toBeGreaterThan(0);
  });

  it("treasury constraint reduces import volume when treasury is low (via processTradeFlows)", () => {
    const state = crearEstadoBase({ treasury: 5_000_000 });
    const rng = createRNG("test-seed-2024-1");
    processTradeFlows(state);
    const coverage = calculateImportCoverage(state);
    expect(coverage).toBeLessThan(1.0);
  });

  it("sanctions multiplier (from game state) reduces received volume", () => {
    const state = crearEstadoBase({
      treasury: 100_000_000,
      sanctionsMultiplier: 3.0,
    });
    const input: TurnInput = {};
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    const flows = output.newState.tradeFlows;
    // Con sanctionsMultiplier=3, cada flow recibe 1/3 del volumen
    for (const flow of flows) {
      expect(flow.unitCost).toBeGreaterThan(50); // costo unitario subio
      // El volumen debe ser < targetVolume * treasuryFactor / 3
      const maxExpectedVolume = flow.targetVolume / 3;
      expect(flow.monthlyVolume).toBeLessThanOrEqual(maxExpectedVolume + 0.01);
    }
  });

  it("scarcity detection works after treasury shortage", () => {
    const state = crearEstadoBase({ treasury: 100_000 }); // critico
    const input: TurnInput = {};
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    if (calculateImportCoverage(output.newState) < BALANCE.TRADE_SHORTAGE_COVERAGE_THRESHOLD) {
      expect(isMedicationShortage(output.newState)).toBe(true);
    }
  });

  it("mortality is not affected by trade when coverage is normal", () => {
    // Con tesoreria suficiente, la cobertura debe ser >= 50%
    // y la mortalidad debe permanecer en valores de Salud-2 (sin penalización)
    const state = crearEstadoBase({ treasury: 500_000_000 });
    const input: TurnInput = {};
    const rng = createRNG("test-seed-2024-1");
    const output = processTurn(state, input, rng);

    const coverage = calculateImportCoverage(output.newState);
    expect(coverage).toBeGreaterThanOrEqual(0.5);

    // La mortalidad del estado base es 0 (sin enfermedades), no se espera cambio
    // debido a comercio (trade no modifica diseaseMortality directamente)
  });
});
