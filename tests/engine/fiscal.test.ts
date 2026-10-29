import { describe, it, expect } from "vitest";
import type { GameState, OfficialState, OrganismState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { generateMinistries, initialMinistryBudgetTotal } from "@/lib/game-factory";
import { processTurn } from "@/lib/engine/turn";
import { createRNG } from "@/lib/rng";
import {
  baseMonthlyIncome, calculateCommittedSpending, calculateGDP, calculateIncome, calculateTaxRevenue,
} from "@/lib/engine/economy";
import {
  collectibleBase, debtAnnualRate, debtToGdp, economyFactor, evasionRate, monthlyDebtInterest,
  neutralTaxRate, settlePublicDebt, taxAgencyReduction, taxMixFactor, taxRate, taxYield,
} from "@/lib/engine/fiscal";

const funcionario = (corruption: number, role = "MINISTER"): OfficialState => ({
  id: `o-${role}-${corruption}`, name: "F", role, specialty: null, ministryId: null, partyId: null, loyalty: 50,
  ambition: 30, wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption, skill: 50, reputation: 50,
  status: "ACTIVE",
});

const agencia = (effectiveness: number, autonomyLevel: number): OrganismState => ({
  id: "ta", type: "TAX_AGENCY", name: "Agencia Tributaria", monthlyBudget: 0, staff: 0, effectiveness, autonomyLevel,
  headOfficialId: null,
});

const economia = (subDecisions: Record<string, number>) => [{ key: "ECONOMY", subDecisions }];
const SEMBRADAS = generateMinistries().find((m) => m.key === "ECONOMY")!.subDecisions as Record<string, number>;

/** Estado como lo deja la siembra de una partida nueva (sin referencia fiscal todavía). */
function estadoInicial(overrides: Partial<GameState> = {}): GameState {
  const population = 10_000_000;
  const ministries = generateMinistries(initialMinistryBudgetTotal(population, 3)).map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 55, internalCorruption: 5,
    subDecisions: { ...m.subDecisions }, ministerOfficialId: null, producedResources: {}, consumedResources: {},
    healthBudgetSplit: {},
  }));
  return {
    countryName: "Prueba", currentYear: 1, currentMonth: 1, treasury: 50_000_000, population, seed: "fiscal",
    gdp: 0, povertyRate: 25, unemploymentRate: 8, sickRate: 5, crimeRate: 15, foodSecurity: 60, educationLevel: 50,
    inflation: 5, lifeExpectancy: 68, ministries,
    officials: [funcionario(20), funcionario(10, "JUDGE"), funcionario(10, "PROSECUTOR")],
    parties: [], senators: [], activeLaws: [], judicialCases: [], organisms: [],
    socialClasses: [
      { id: "s1", key: "MIDDLE", populationPercent: 60, averageIncome: 2000, approval: 50, demands: [], educationLevel: 60, healthAccess: 70 },
      { id: "s2", key: "POVERTY", populationPercent: 40, averageIncome: 500, approval: 50, demands: [], educationLevel: 30, healthAccess: 40 },
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

/** El mismo estado con la referencia fiscal fijada en su economía actual (factor de economía = 1). */
function conReferencia(state: GameState): GameState {
  state.fiscalBaseReference = collectibleBase(calculateGDP(state), evasionRate(state.officials, state.organisms));
  return state;
}

describe("impuestos: tasas y mezcla", () => {
  it("las tasas sembradas son las neutrales y la mezcla vale exactamente 1", () => {
    for (const key of ["iva", "impuestoRenta", "impuestoSociedades"] as const) {
      expect(SEMBRADAS[key]).toBe(neutralTaxRate(key));
    }
    expect(taxMixFactor(economia(SEMBRADAS))).toBe(1);
    expect(taxMixFactor([])).toBe(1); // sin Economía: tasas iniciales
  });

  it("taxRate acota al rango del motor y descarta valores no numéricos", () => {
    expect(taxRate(economia({ iva: 99 }), "iva")).toBe(30);
    expect(taxRate(economia({ iva: -5 }), "iva")).toBe(0);
    expect(taxRate(economia({ iva: Number.NaN }), "iva")).toBe(16);
  });

  it("rendimiento: 1 → 1, 0 → 0, y cada punto adicional rinde menos (Laffer)", () => {
    expect(taxYield(1)).toBe(1);
    expect(taxYield(0)).toBe(0);
    expect(taxYield(1.5) - taxYield(1)).toBeLessThan(taxYield(1) - taxYield(0.5));
    // Máximo en (1 + L) / (2L): más allá, subir la tasa recauda menos
    const pico = (1 + BALANCE.TAX_LAFFER) / (2 * BALANCE.TAX_LAFFER);
    expect(taxYield(pico + 0.2)).toBeLessThan(taxYield(pico));
    expect(taxYield(100)).toBe(0);
  });

  it("subir el IVA sube la recaudación menos que proporcionalmente; bajar todo la reduce", () => {
    const masIva = taxMixFactor(economia({ ...SEMBRADAS, iva: 24 }));
    expect(masIva).toBeGreaterThan(1);
    expect(masIva).toBeLessThan(1 + BALANCE.TAX_MIX_SHARES.iva * 0.5);
    expect(taxMixFactor(economia({ iva: 0, impuestoRenta: 0, impuestoSociedades: 0 }))).toBe(0);
  });
});

describe("evasión fiscal", () => {
  it("sin corrupción ni agencia es la base; la corrupción la sube", () => {
    expect(evasionRate([funcionario(0)], [])).toBeCloseTo(BALANCE.TAX_EVASION_BASE, 10);
    expect(evasionRate([funcionario(50)], [])).toBeCloseTo(BALANCE.TAX_EVASION_BASE + BALANCE.TAX_EVASION_CORRUPTION_FACTOR * 0.5, 10);
  });

  it("una Agencia Tributaria efectiva y autónoma la reduce; disuelta (efectividad 0) no", () => {
    const sin = evasionRate([funcionario(30)], []);
    expect(evasionRate([funcionario(30)], [agencia(80, 90)])).toBeLessThan(sin);
    expect(evasionRate([funcionario(30)], [agencia(0, 90)])).toBe(sin);
    expect(taxAgencyReduction([agencia(100, 100)])).toBeCloseTo(BALANCE.TAX_AGENCY_MAX_EVASION_REDUCTION, 10);
    expect(taxAgencyReduction([agencia(100, 0)])).toBeCloseTo(BALANCE.TAX_AGENCY_MAX_EVASION_REDUCTION / 2, 10);
  });

  it("se mantiene dentro de [mín, máx]", () => {
    expect(evasionRate([funcionario(100)], [])).toBeLessThanOrEqual(BALANCE.TAX_EVASION_MAX);
    expect(evasionRate([funcionario(0)], [agencia(100, 100)])).toBe(BALANCE.TAX_EVASION_MIN);
  });
});

describe("factor de economía", () => {
  it("sin referencia vale 1; igual a la referencia vale 1; proporcional a la base", () => {
    expect(economyFactor(123, null)).toBe(1);
    expect(economyFactor(123, undefined)).toBe(1);
    expect(economyFactor(500, 500)).toBe(1);
    expect(economyFactor(250, 500)).toBeCloseTo(0.5 ** BALANCE.TAX_BASE_ELASTICITY, 10);
    expect(economyFactor(0, 500)).toBe(0);
  });

  it("la base imponible es el PIB neto de evasión y nunca negativa", () => {
    expect(collectibleBase(1000, 0.2)).toBe(800);
    expect(collectibleBase(-5, 0.2)).toBe(0);
  });
});

describe("calculateTaxRevenue", () => {
  it("una partida nueva recauda lo mismo que antes de la Fase 1 (sin referencia y con ella)", () => {
    const state = estadoInicial();
    expect(calculateIncome(state)).toBe(baseMonthlyIncome(state.population));
    expect(calculateIncome(conReferencia(state))).toBeCloseTo(baseMonthlyIncome(state.population), 4);
  });

  it("un PIB más bajo (peor gestión de Economía) recauda menos", () => {
    const state = conReferencia(estadoInicial());
    const antes = calculateIncome(state);
    state.ministries.find((m) => m.key === "ECONOMY")!.efficiency = 44; // 20% menos de PIB
    expect(calculateIncome(state) / antes).toBeCloseTo(0.8 ** BALANCE.TAX_BASE_ELASTICITY, 6);
  });

  it("más corrupción → más evasión → menos recaudación", () => {
    const state = conReferencia(estadoInicial());
    const antes = calculateTaxRevenue(state);
    state.officials[0].corruption = 80;
    const despues = calculateTaxRevenue(state);
    expect(despues.evasion).toBeGreaterThan(antes.evasion);
    expect(despues.revenue).toBeLessThan(antes.revenue);
  });

  it("subir el IVA sube la recaudación del mes", () => {
    const state = conReferencia(estadoInicial());
    const antes = calculateIncome(state);
    state.ministries.find((m) => m.key === "ECONOMY")!.subDecisions.iva = 20;
    expect(calculateIncome(state)).toBeGreaterThan(antes);
  });

  it("los modificadores de leyes se suman a la tasa efectiva", () => {
    const state = estadoInicial({
      activeLaws: [{ id: "l", lawKey: "x", activatedAt: "", effectsJson: { taxRateModifier: 0.05 } }] as GameState["activeLaws"],
    });
    expect(calculateTaxRevenue(state).taxRate).toBeCloseTo(BALANCE.TAX_RATE_BASE + 0.05, 10);
  });
});

describe("deuda pública", () => {
  const conTasa = (tasaInteres: number, publicDebt: number, gdp: number) =>
    ({ ministries: economia({ tasaInteres }), gdp, publicDebt }) as unknown as GameState;

  it("tasa anual: base con la tasa de referencia inicial; sube con la tasa y con la deuda sobre el umbral", () => {
    expect(debtAnnualRate(conTasa(4.5, 0, 1000))).toBeCloseTo(BALANCE.DEBT_BASE_ANNUAL_RATE, 10);
    expect(debtAnnualRate(conTasa(10.5, 0, 1000))).toBeCloseTo(
      BALANCE.DEBT_BASE_ANNUAL_RATE + BALANCE.DEBT_POLICY_RATE_PASSTHROUGH * 0.06, 10);
    expect(debtAnnualRate(conTasa(4.5, 1000, 1000))).toBeCloseTo(
      BALANCE.DEBT_BASE_ANNUAL_RATE + BALANCE.DEBT_RISK_PREMIUM * (1 - BALANCE.DEBT_SAFE_GDP_RATIO), 10);
    expect(debtAnnualRate(conTasa(-100, 0, 1000))).toBe(BALANCE.DEBT_MIN_ANNUAL_RATE);
  });

  it("intereses mensuales = deuda × tasa anual / 12; sin deuda, 0", () => {
    expect(monthlyDebtInterest(conTasa(4.5, 0, 1000))).toBe(0);
    expect(monthlyDebtInterest(conTasa(4.5, 120, 1000))).toBeCloseTo((120 * BALANCE.DEBT_BASE_ANNUAL_RATE) / 12, 10);
    expect(debtToGdp(50, 0)).toBe(0);
  });

  it("los intereses entran en el gasto comprometido", () => {
    const state = estadoInicial();
    const sinDeuda = calculateCommittedSpending(state);
    state.publicDebt = 1_200_000_000;
    state.gdp = calculateGDP(state);
    expect(calculateCommittedSpending(state) - sinDeuda).toBeCloseTo(monthlyDebtInterest(state), 4);
  });

  it("settlePublicDebt: el faltante se emite como deuda y el tesoro queda en 0", () => {
    const s = { treasury: -300, publicDebt: 100 };
    expect(settlePublicDebt(s, 1000)).toEqual({ issued: 300, amortized: 0 });
    expect(s).toEqual({ treasury: 0, publicDebt: 400 });
  });

  it("settlePublicDebt: amortiza solo lo que excede la reserva de caja, y no más que la deuda", () => {
    const reserva = 1000 * BALANCE.DEBT_CASH_RESERVE_MONTHS;
    const s = { treasury: reserva + 500, publicDebt: 200 };
    expect(settlePublicDebt(s, 1000)).toEqual({ issued: 0, amortized: 200 });
    expect(s).toEqual({ treasury: reserva + 300, publicDebt: 0 });

    const t = { treasury: reserva - 1, publicDebt: 200 };
    expect(settlePublicDebt(t, 1000).amortized).toBe(0);
  });

  it("settlePublicDebt sin amortizar solo cubre faltantes; un tesoro no finito no se toca", () => {
    const s = { treasury: 1e9, publicDebt: 200 };
    expect(settlePublicDebt(s, 0, false)).toEqual({ issued: 0, amortized: 0 });
    expect(s.publicDebt).toBe(200);
    const n = { treasury: Number.NaN, publicDebt: 5 };
    expect(settlePublicDebt(n, 0)).toEqual({ issued: 0, amortized: 0 });
    expect(n.publicDebt).toBe(5);
  });
});

describe("processTurn y la política fiscal", () => {
  it("el primer turno fija la base imponible de referencia y no la cambia después", () => {
    const out = processTurn(estadoInicial(), {}, createRNG("fiscal-1"));
    const ref = out.newState.fiscalBaseReference;
    expect(ref).toBeGreaterThan(0);
    expect(ref).toBeCloseTo(collectibleBase(out.newState.gdp, evasionRate(out.newState.officials, out.newState.organisms)), 4);

    const out2 = processTurn(out.newState, {}, createRNG("fiscal-2"));
    expect(out2.newState.fiscalBaseReference).toBe(ref);
  });

  it("un déficit que vacía el tesoro se cubre con deuda (tesoro 0, aviso y snapshot)", () => {
    const out = processTurn(estadoInicial({ treasury: -5_000_000_000 }), {}, createRNG("fiscal-deficit"));
    expect(out.newState.treasury).toBe(0);
    expect(out.newState.publicDebt).toBeGreaterThan(4_900_000_000); // el mes cierra casi en equilibrio
    expect(out.monthSnapshot.publicDebt).toBe(out.newState.publicDebt);
    expect(out.notifications.some((n) => n.title === "Emisión de deuda pública")).toBe(true);
  });

  it("con deuda, la caja sobrante la amortiza", () => {
    const out = processTurn(estadoInicial({ treasury: 50_000_000_000, publicDebt: 1_000_000 }), {}, createRNG("fiscal-amort"));
    expect(out.newState.publicDebt).toBe(0);
    expect(out.notifications.some((n) => n.title === "Amortización de deuda")).toBe(true);
  });

  it("es determinista con la misma semilla", () => {
    const a = processTurn(estadoInicial({ treasury: -1e9 }), {}, createRNG("fiscal-det"));
    const b = processTurn(estadoInicial({ treasury: -1e9 }), {}, createRNG("fiscal-det"));
    expect(a.newState.publicDebt).toBe(b.newState.publicDebt);
    expect(a.newState.fiscalBaseReference).toBe(b.newState.fiscalBaseReference);
  });
});
