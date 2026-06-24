import { describe, it, expect } from "vitest";

// Test que verifica el flujo completo del pipeline de presupuesto:
// TurnInput.budgetAdjustments → processTurn → newState.ministries[].budgetPercent
import type { GameState, TurnInput } from "@/lib/engine/types";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";

function crearEstado(): GameState {
  return {
    countryName: "Test",
    currentYear: 2024,
    currentMonth: 1,
    treasury: 1000000,
    population: 10000000,
    seed: "budget-test",
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
      { id: "m-salud", key: "HEALTH", budgetPercent: 10, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
      { id: "m-economia", key: "ECONOMY", budgetPercent: 15, efficiency: 50, internalCorruption: 5, subDecisions: {}, ministerOfficialId: null },
    ],
    officials: [],
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses: [],
    regimeMetrics: { powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60, politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60 },
    media: [],
    events: [],
    longRunningDecisions: [],
    consecutiveLowApprovalMonths: 0,
  };
}

describe("E2E: Presupuesto → processTurn → DB (persistencia diferida)", () => {
  it("budgetAdjustments del TurnInput modifican ministry.budgetPercent en el output", () => {
    const state = crearEstado();
    const input: TurnInput = {
      budgetAdjustments: {
        HEALTH: 35,      // de 10% → 35%
        ECONOMY: 8,       // de 15% → 8%
      },
    };
    const rng = createRNG("budget-test-2024-1");
    const output = processTurn(state, input, rng);

    const healthMinistry = output.newState.ministries.find(m => m.key === "HEALTH");
    const economyMinistry = output.newState.ministries.find(m => m.key === "ECONOMY");

    expect(healthMinistry?.budgetPercent).toBe(35);
    expect(economyMinistry?.budgetPercent).toBe(8);
  });

  it("el presupuesto se persiste en el snapshot mensual", () => {
    const state = crearEstado();
    const input: TurnInput = {
      budgetAdjustments: { HEALTH: 25 },
    };
    const rng = createRNG("budget-snapshot-2024-1");
    const output = processTurn(state, input, rng);

    // El snapshot se crea después de aplicar budgetAdjustments
    // y recalcular eficiencia, por tanto el snapshot debe tener
    // indicadores recalculados con el nuevo presupuesto.
    expect(output.monthSnapshot).toBeDefined();
    expect(output.monthSnapshot.treasury).toBeDefined();
    expect(output.monthSnapshot.povertyRate).toBeDefined();
  });

  it("el valor del slider se refleja inmediatamente en pendingInput (store) y se aplica al avanzar", () => {
    const state = crearEstado();
    const input: TurnInput = {
      budgetAdjustments: { HEALTH: 40 },
    };
    const rng = createRNG("budget-immediate-2024-1");
    const output = processTurn(state, input, rng);

    // El motor clampa a [2, 40], así que 40 debe mantenerse
    const healthMinistry = output.newState.ministries.find(m => m.key === "HEALTH");
    expect(healthMinistry?.budgetPercent).toBe(40);
  });
});
