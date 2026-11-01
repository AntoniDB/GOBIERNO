import { describe, it, expect } from "vitest";
import type { GameState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { calculateGDP } from "@/lib/engine/economy";
import { calculateInflation } from "@/lib/engine/monetary";
import { processTradeFlows } from "@/lib/engine/trade";
import {
  exchangeRateOf, exchangeRateTarget, exportCompetitiveness, fxInflationPressure, interventionCost, interventionLevel,
  monthlyExports, monthlyOtherImports, neutralTariff, nextExchangeRate, tariffRate, tariffRevenueDelta,
} from "@/lib/engine/foreign-trade";

const GDP_M = 1_000_000; // PIB mensual de referencia

function estado(economia: Record<string, number> = {}, overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 1)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions, ...(m.key === "ECONOMY" ? economia : {}) }, ministerOfficialId: null,
    producedResources: {}, consumedResources: {}, healthBudgetSplit: {},
  }));
  return {
    gameId: "g", countryName: "Prueba", currentYear: 1, currentMonth: 3, treasury: 50_000_000, population,
    seed: "comercio", gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15, foodSecurity: 60,
    educationLevel: 50, inflation: 3, lifeExpectancy: 68, ministries,
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

describe("estado inicial: todo en su neutro", () => {
  it("competitividad 1, exportaciones = importaciones y sin ingreso arancelario neto", () => {
    const s = estado();
    expect(exportCompetitiveness(s)).toBeCloseTo(1, 10);
    expect(monthlyExports(s, GDP_M)).toBeCloseTo(monthlyOtherImports(s, GDP_M), 6);
    expect(tariffRevenueDelta(s.ministries, monthlyOtherImports(s, GDP_M))).toBeCloseTo(0, 10);
    expect(tariffRate(s.ministries)).toBe(neutralTariff());
    expect(interventionLevel(s.ministries)).toBe(0);
    expect(exchangeRateOf(s)).toBe(BALANCE.FX_BASE);
  });

  it("un estado sin ministerios ni valores (tests, partidas viejas) también es neutro", () => {
    const vacio = { ministries: [], exchangeRate: undefined, sanctionsMultiplier: undefined } as unknown as GameState;
    expect(exportCompetitiveness(vacio)).toBeCloseTo(1, 10);
    expect(tariffRate([])).toBe(10);
  });
});

describe("competitividad y exportaciones", () => {
  it("sube con la apertura, un tipo de cambio depreciado y la productividad", () => {
    const base = exportCompetitiveness(estado());
    expect(exportCompetitiveness(estado({ politicaIndustrial: 100 }))).toBeGreaterThan(base);
    expect(exportCompetitiveness(estado({ politicaIndustrial: 0 }))).toBeLessThan(base);
    expect(exportCompetitiveness(estado({}, { exchangeRate: 130 }))).toBeGreaterThan(base);
    expect(exportCompetitiveness(estado({}, { exchangeRate: 80 }))).toBeLessThan(base);
    const mejor = estado();
    mejor.ministries.find((m) => m.key === "ECONOMY")!.efficiency = 80;
    expect(exportCompetitiveness(mejor)).toBeGreaterThan(base);
  });

  it("los aranceles sobre el inicial provocan represalia; bajarlos no da ventaja", () => {
    const base = exportCompetitiveness(estado());
    expect(exportCompetitiveness(estado({ aranceles: 40 }))).toBeCloseTo(base * (1 - BALANCE.EXPORT_RETALIATION * 0.3), 8);
    expect(exportCompetitiveness(estado({ aranceles: 0 }))).toBeCloseTo(base, 10);
  });

  it("las sanciones del default dividen las exportaciones", () => {
    const base = monthlyExports(estado(), GDP_M);
    expect(monthlyExports(estado({}, { sanctionsMultiplier: BALANCE.DEFAULT_SANCTIONS_MULTIPLIER }), GDP_M))
      .toBeCloseTo(base / BALANCE.DEFAULT_SANCTIONS_MULTIPLIER, 6);
  });

  it("valores fuera de rango o inválidos se acotan; PIB negativo no exporta", () => {
    expect(tariffRate(estado({ aranceles: 999 }).ministries)).toBe(40);
    expect(tariffRate(estado({ aranceles: Number.NaN }).ministries)).toBe(10);
    expect(exchangeRateOf({ exchangeRate: Number.NaN })).toBe(BALANCE.FX_BASE);
    expect(exchangeRateOf({ exchangeRate: 1e9 })).toBe(BALANCE.FX_MAX);
    expect(monthlyExports(estado(), -5)).toBe(0);
  });
});

describe("importaciones y aranceles", () => {
  it("más aranceles → menos importaciones y más ingreso arancelario neto; menos aranceles → pierde ingreso", () => {
    const base = monthlyOtherImports(estado(), GDP_M);
    const alto = estado({ aranceles: 40 });
    const bajo = estado({ aranceles: 0 });
    expect(monthlyOtherImports(alto, GDP_M)).toBeLessThan(base);
    expect(monthlyOtherImports(bajo, GDP_M)).toBeGreaterThan(base);
    expect(tariffRevenueDelta(alto.ministries, monthlyOtherImports(alto, GDP_M))).toBeGreaterThan(0);
    expect(tariffRevenueDelta(bajo.ministries, monthlyOtherImports(bajo, GDP_M))).toBeLessThan(0);
  });

  it("la apertura sube las importaciones y la depreciación las baja", () => {
    const base = monthlyOtherImports(estado(), GDP_M);
    expect(monthlyOtherImports(estado({ politicaIndustrial: 100 }), GDP_M)).toBeGreaterThan(base);
    expect(monthlyOtherImports(estado({}, { exchangeRate: 130 }), GDP_M)).toBeLessThan(base);
  });
});

describe("tipo de cambio", () => {
  const sano = { tradeDeficit: 0, monthlyGdp: GDP_M, inflation: BALANCE.INFLATION_TARGET, creditScore: 70 };

  it("con fundamentos sanos el objetivo es el valor inicial", () => {
    expect(exchangeRateTarget(sano)).toBe(BALANCE.FX_BASE);
  });

  it("el déficit comercial, la inflación y una mala calificación lo deprecian; un superávit lo aprecia", () => {
    expect(exchangeRateTarget({ ...sano, tradeDeficit: 0.05 * GDP_M })).toBeGreaterThan(100);
    expect(exchangeRateTarget({ ...sano, tradeDeficit: -0.05 * GDP_M })).toBeLessThan(100);
    expect(exchangeRateTarget({ ...sano, inflation: 18 })).toBeCloseTo(100 * (1 + BALANCE.FX_INFLATION_WEIGHT * 15), 8);
    expect(exchangeRateTarget({ ...sano, creditScore: 30 })).toBeCloseTo(100 * (1 + BALANCE.FX_RATING_WEIGHT * 30), 8);
    expect(exchangeRateTarget({ ...sano, creditScore: null })).toBe(100);
  });

  it("se acota a [FX_MIN, FX_MAX]", () => {
    expect(exchangeRateTarget({ ...sano, tradeDeficit: 1e12 })).toBe(BALANCE.FX_MAX);
    expect(exchangeRateTarget({ ...sano, tradeDeficit: -1e12 })).toBe(BALANCE.FX_MIN);
  });

  it("se mueve con inercia hacia el objetivo (FX_ADJUST por mes) y converge", () => {
    expect(nextExchangeRate(100, 150, 0).rate).toBeCloseTo(100 + BALANCE.FX_ADJUST * 50, 8);
    let fx = 100;
    for (let i = 0; i < 40; i++) fx = nextExchangeRate(fx, 150, 0).rate;
    expect(fx).toBeCloseTo(150, 1);
  });

  it("la intervención frena el movimiento y lo evitado cuesta tesoro; al 0 % no cuesta nada", () => {
    const libre = nextExchangeRate(100, 150, 0);
    const fijo = nextExchangeRate(100, 150, 100);
    expect(fijo.rate - 100).toBeCloseTo((libre.rate - 100) * (1 - BALANCE.FX_DEFENSE_MAX), 8);
    expect(libre.avoidedMove).toBe(0);
    expect(fijo.avoidedMove).toBeCloseTo((libre.rate - 100) * BALANCE.FX_DEFENSE_MAX, 8);
    expect(interventionCost(libre.avoidedMove, GDP_M)).toBe(0);
    expect(interventionCost(fijo.avoidedMove, GDP_M)).toBeCloseTo(BALANCE.FX_DEFENSE_COST * (fijo.avoidedMove / 100) * GDP_M, 8);
    expect(nextExchangeRate(100, 150, 999).rate).toBe(nextExchangeRate(100, 150, 100).rate);
  });

  it("la depreciación presiona la inflación; la apreciación no la baja de su meta", () => {
    expect(fxInflationPressure({ exchangeRate: 100 })).toBe(0);
    expect(fxInflationPressure({ exchangeRate: 120 })).toBeCloseTo(20 * BALANCE.INFLATION_FX_PASSTHROUGH, 8);
    expect(fxInflationPressure({ exchangeRate: 80 })).toBe(0);
    const sin = calculateInflation(estado(), { taxRevenue: 1000, expenses: 1000, emission: 0 });
    const con = calculateInflation(estado({}, { exchangeRate: 130 }), { taxRevenue: 1000, expenses: 1000, emission: 0 });
    expect(con.fx).toBeCloseTo(30 * BALANCE.INFLATION_FX_PASSTHROUGH, 8);
    expect(con.equilibrium).toBeGreaterThan(sin.equilibrium);
  });
});

describe("integración con el motor", () => {
  it("el PIB sube con la competitividad exportadora (apertura) y baja con la represalia", () => {
    const base = calculateGDP(estado());
    expect(calculateGDP(estado({ politicaIndustrial: 100 }))).toBeGreaterThan(base);
    expect(calculateGDP(estado({ aranceles: 40 }))).toBeLessThan(base);
  });

  it("los medicamentos importados cuestan más con la moneda depreciada (y nada cambia con 100)", () => {
    const good = { id: "g1", gameId: "g", key: "m", category: "MEDICAMENTS_GENERIC", name: "m", description: null, baseCostPerUnit: 50, unitDescription: "u", demandPerCapita: 0.00001 };
    const flow = { id: "f1", gameId: "g", tradeGoodId: "g1", direction: "IMPORT", monthlyVolume: 0, targetVolume: 1000, unitCost: 0, sanctionsMultiplier: 1, monthlyCost: 0, isActive: true };
    const costo = (exchangeRate?: number) => {
      const s = estado({}, { tradeGoods: [good], tradeFlows: [{ ...flow }], exchangeRate, treasury: 1e12 } as never);
      return processTradeFlows(s).totalImports;
    };
    expect(costo(100)).toBe(costo(undefined));
    expect(costo(150)).toBeCloseTo(costo(100) * 1.5, 6);
  });

  it("processTurn llena exportaciones, importaciones, balanza y tipo de cambio del snapshot", () => {
    const out = processTurn(estado(), {}, createRNG("fx-1"));
    const s = out.monthSnapshot;
    expect(s.totalExports).toBeGreaterThan(0);
    expect(s.totalImports).toBeGreaterThan(0);
    expect(s.tradeBalance).toBeCloseTo(s.totalExports - s.totalImports, 4);
    // Arranca casi equilibrada (la eficiencia se recalcula en el paso 5 desde los funcionarios: sin ministros, ~47 en vez de 55)
    expect(Math.abs(s.tradeBalance) / s.totalExports).toBeLessThan(0.25);
    expect(Math.abs(s.exchangeRate! - 100)).toBeLessThan(3);
    expect(out.newState.exchangeRate).toBe(s.exchangeRate);
  });

  it("aranceles altos suben el ingreso del tesoro (neto) y bajan las importaciones", () => {
    const base = processTurn(estado(), {}, createRNG("fx-2"));
    const alto = processTurn(estado(), { subDecisionChanges: { ECONOMY: { aranceles: 40 } } }, createRNG("fx-2"));
    expect(alto.monthSnapshot.totalImports).toBeLessThan(base.monthSnapshot.totalImports);
    expect(alto.monthSnapshot.totalExports).toBeLessThan(base.monthSnapshot.totalExports);
  });

  it("una inflación alta deprecia la moneda mes a mes; la intervención la frena y cuesta tesoro", () => {
    const sin = processTurn(estado({}, { inflation: 25, treasury: 1e12 }), {}, createRNG("fx-3"));
    expect(sin.newState.exchangeRate!).toBeGreaterThan(100);
    const defendida = processTurn(estado({ intervencionCambiaria: 100 }, { inflation: 25, treasury: 1e12 }), {}, createRNG("fx-3"));
    expect(defendida.newState.exchangeRate! - 100).toBeLessThan((sin.newState.exchangeRate! - 100) * 0.3);
    expect(defendida.newState.treasury).toBeLessThan(sin.newState.treasury);
  });

  it("un movimiento fuerte del tipo de cambio avisa al jugador", () => {
    const out = processTurn(estado({}, { exchangeRate: 100, inflation: 99, creditScore: 0 }), {}, createRNG("fx-4"));
    // objetivo ≈ 100×(1 + 0,96 + 0,24 + déficit) → movimiento de FX_ADJUST de la brecha: supera el umbral
    expect(out.notifications.some((n) => n.title === "Depreciación fuerte de la moneda")).toBe(true);
  });

  it("es determinista", () => {
    const a = processTurn(estado({}, { inflation: 25 }), {}, createRNG("fx-5")).newState.exchangeRate;
    const b = processTurn(estado({}, { inflation: 25 }), {}, createRNG("fx-5")).newState.exchangeRate;
    expect(a).toBe(b);
  });
});
