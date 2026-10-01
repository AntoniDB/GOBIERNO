import { describe, it, expect, afterEach } from "vitest";
import type { GameState, OfficialState, SocialClassState } from "@/lib/engine/types";
import { BALANCE, SUB_DECISION_EFFECTS } from "@/lib/balance";
import { SUB_DECISION_SPECS } from "@/lib/engine/sub-decisions";
import { subDecisionDeltas, describeSubDecisionEffects } from "@/lib/engine/sub-decision-effects";
import { generateMinistries } from "@/lib/game-factory";
import { scaleCost } from "@/lib/engine/cost-scale";
import {
  calculatePoverty, calculateUnemployment, calculateHealth, calculateHealthRegional,
  calculateFoodSecurity, calculateCrime, calculateEducation, calculateGini, calculateInflationSimple,
} from "@/lib/engine/indicators";
import { calculateGDP, calculateExpenses } from "@/lib/engine/economy";
import { calculateApprovalByClass } from "@/lib/engine/approval";
import { updateOfficialCorruption } from "@/lib/engine/corruption";

const POP = 10_000_000;
type Subs = Record<string, number | boolean>;

/** Ministerios con los valores sembrados (el punto neutro). */
const ministeriosSembrados = () =>
  generateMinistries().map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 50, internalCorruption: 10,
    subDecisions: { ...m.subDecisions } as Subs, ministerOfficialId: null,
    producedResources: {}, consumedResources: {}, healthBudgetSplit: {},
  }));

/** Estado mínimo con las sub-decisiones cambiadas (por ministerio). */
function estado(cambios: Record<string, Subs> = {}, overrides: Partial<GameState> = {}): GameState {
  const ministries = ministeriosSembrados().map((m) => ({ ...m, subDecisions: { ...m.subDecisions, ...(cambios[m.key] ?? {}) } }));
  return {
    population: POP, ministries, officials: [], organisms: [], activeLaws: [], judicialCases: [],
    regions: [], diseases: [], diseasePrevalences: [], socialClasses: [], ...overrides,
  } as unknown as GameState;
}
const sembrado = () => estado();

afterEach(() => { (BALANCE as { SUBDECISION_EFFECT_SCALE: number }).SUBDECISION_EFFECT_SCALE = 1; });

// ──────────────────────────────────────────────────────────────────────────────
//  Integridad de la tabla
// ──────────────────────────────────────────────────────────────────────────────

describe("SUB_DECISION_EFFECTS: integridad de la tabla", () => {
  it("tiene exactamente las mismas sub-decisiones que los specs de validación", () => {
    const efectos = Object.entries(SUB_DECISION_EFFECTS).flatMap(([m, t]) => Object.keys(t).map((k) => `${m}.${k}`)).sort();
    const specs = Object.entries(SUB_DECISION_SPECS).flatMap(([m, t]) => Object.keys(t).map((k) => `${m}.${k}`)).sort();
    expect(efectos).toEqual(specs);
  });

  it("el neutral tiene el tipo del spec y cae dentro de su rango", () => {
    for (const [m, table] of Object.entries(SUB_DECISION_EFFECTS)) {
      for (const [k, e] of Object.entries(table)) {
        const spec = SUB_DECISION_SPECS[m][k];
        expect(typeof e.neutral, `${m}.${k}`).toBe(spec.type === "boolean" ? "boolean" : "number");
        if (spec.type === "number") {
          expect(e.neutral as number, `${m}.${k} neutral`).toBeGreaterThanOrEqual(spec.min);
          expect(e.neutral as number, `${m}.${k} neutral`).toBeLessThanOrEqual(spec.max);
          if (e.range) {
            expect(e.range[0], `${m}.${k} range`).toBeGreaterThanOrEqual(spec.min);
            expect(e.range[1], `${m}.${k} range`).toBeLessThanOrEqual(spec.max);
            expect(e.neutral as number, `${m}.${k} neutral en range`).toBeGreaterThanOrEqual(e.range[0]);
            expect(e.neutral as number, `${m}.${k} neutral en range`).toBeLessThanOrEqual(e.range[1]);
          } else {
            expect(e.group, `${m}.${k} necesita range o group`).toBeDefined();
          }
        }
      }
    }
  });

  it("el neutral es el valor que siembra generateMinistries (al empezar no cambia nada)", () => {
    for (const m of generateMinistries()) {
      for (const [k, v] of Object.entries(m.subDecisions)) {
        expect(SUB_DECISION_EFFECTS[m.key][k].neutral, `${m.key}.${k}`).toBe(v);
      }
    }
  });

  it("los grupos de normalización suman 100 en su valor neutral", () => {
    for (const [m, table] of Object.entries(SUB_DECISION_EFFECTS)) {
      const sums: Record<string, number> = {};
      for (const e of Object.values(table)) if (e.group) sums[e.group] = (sums[e.group] ?? 0) + (e.neutral as number);
      for (const [g, sum] of Object.entries(sums)) expect(sum, `${m}/${g}`).toBe(100);
    }
  });

  it("toda sub-decisión tiene algún efecto y los coeficientes son finitos y no nulos", () => {
    for (const [m, table] of Object.entries(SUB_DECISION_EFFECTS)) {
      for (const [k, e] of Object.entries(table)) {
        const coefs = [...Object.values(e.indicators ?? {}), ...Object.values(e.approval ?? {}), e.cost ?? 0].filter((c) => c !== 0);
        expect(coefs.length, `${m}.${k}`).toBeGreaterThan(0);
        for (const c of coefs) expect(Number.isFinite(c), `${m}.${k}`).toBe(true);
      }
    }
  });

  it("ninguna sub-decisión, en su extremo, mueve algo desmesurado (guarda contra erratas)", () => {
    for (const [m, table] of Object.entries(SUB_DECISION_EFFECTS)) {
      for (const [k, e] of Object.entries(table)) {
        const extremos = typeof e.neutral === "boolean" ? [!e.neutral] : e.group ? [0, 100] : [e.range![0], e.range![1]];
        for (const v of extremos) {
          const d = subDecisionDeltas([{ key: m, subDecisions: { [k]: v } }], POP);
          for (const [t, x] of Object.entries(d.indicators)) expect(Math.abs(x), `${m}.${k}=${v} ${t}`).toBeLessThanOrEqual(6);
          for (const [c, x] of Object.entries(d.approval)) expect(Math.abs(x), `${m}.${k}=${v} ${c}`).toBeLessThanOrEqual(3);
          // Un costo extremo no pasa del 10% del ingreso mensual (45 × población)
          expect(Math.abs(d.cost), `${m}.${k}=${v} costo`).toBeLessThanOrEqual(0.1 * 45 * POP);
        }
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  subDecisionDeltas
// ──────────────────────────────────────────────────────────────────────────────

describe("subDecisionDeltas", () => {
  const deltas = (cambios: Record<string, Subs>, pop = POP) => subDecisionDeltas(estado(cambios).ministries, pop);

  it("con los valores sembrados todos los efectos son exactamente 0", () => {
    const d = subDecisionDeltas(sembrado().ministries, POP);
    expect(Object.values(d.indicators).every((x) => x === 0)).toBe(true);
    expect(Object.values(d.approval).every((x) => x === 0)).toBe(true);
    expect(d.cost).toBe(0);
  });

  it("una sub-decisión ausente o con basura cuenta como neutral", () => {
    const ms = [{ key: "ECONOMY", subDecisions: { salarioMinimo: "mucho", tasaInteres: NaN } as never }, { key: "HEALTH", subDecisions: {} }];
    const d = subDecisionDeltas(ms, POP);
    expect(Object.values(d.indicators).every((x) => x === 0)).toBe(true);
  });

  it("numéricas: el efecto es lineal respecto del valor sembrado", () => {
    expect(deltas({ ECONOMY: { salarioMinimo: 700 } }).indicators.povertyRate).toBeCloseTo(-0.005 * 350, 10);
    expect(deltas({ ECONOMY: { salarioMinimo: 525 } }).indicators.povertyRate).toBeCloseTo(-0.005 * 175, 10);
    expect(deltas({ ECONOMY: { salarioMinimo: 200 } }).indicators.povertyRate).toBeCloseTo(0.005 * 150, 10);
  });

  it("numéricas: el valor se acota al rango del efecto", () => {
    const enTope = deltas({ ECONOMY: { salarioMinimo: 1000 } }).indicators.povertyRate;
    expect(deltas({ ECONOMY: { salarioMinimo: 10_000 } }).indicators.povertyRate).toBe(enTope);
    expect(deltas({ DEFENSE: { tropasActivas: 2_000_000 } }).cost).toBe(deltas({ DEFENSE: { tropasActivas: 200_000 } }).cost);
  });

  it("booleanas: el efecto completo al cambiar de estado y ninguno al volver", () => {
    expect(deltas({ HEALTH: { vacunacion: false } }).indicators.sickRate).toBeCloseTo(1.5, 10);
    expect(deltas({ HEALTH: { vacunacion: true } }).indicators.sickRate).toBe(0);
    expect(deltas({ HEALTH: { saludMental: true } }).indicators.sickRate).toBeCloseTo(-1, 10);
  });

  it("los costos se escalan por población y pueden ser ahorros", () => {
    expect(deltas({ HEALTH: { saludMental: true } }, POP).cost).toBe(1_000_000);
    expect(deltas({ HEALTH: { saludMental: true } }, 4 * POP).cost).toBe(4_000_000);
    expect(deltas({ HEALTH: { vacunacion: false } }).cost).toBe(-1_000_000);
    expect(deltas({ DEFENSE: { tropasActivas: 100_000 } }).cost).toBe(scaleCost(150 * 50_000, POP));
  });

  it("grupos: los valores se normalizan a suma 100 (subir todo por igual no cambia nada)", () => {
    const d = deltas({ EDUCATION: { primaria: 80, secundaria: 70, superior: 50 } });
    expect(d.indicators.educationLevel).toBeCloseTo(0, 10);
    expect(d.indicators.gdpPct).toBeCloseTo(0, 10);
  });

  it("grupos: subir una etapa a costa de otra mueve los indicadores en el sentido esperado", () => {
    // 10 puntos de superior (25→15) pasan a primaria (40→50)
    const d = deltas({ EDUCATION: { primaria: 50, secundaria: 35, superior: 15 } });
    expect(d.indicators.educationLevel).toBeCloseTo(0.05 * 10 - 0.02 * 10, 10);
    expect(d.indicators.povertyRate).toBeCloseTo(-0.02 * 10, 10);
    expect(d.indicators.gdpPct).toBeCloseTo(-0.08 * 10, 10);
  });

  it("grupos: si todo el grupo está en 0 no hay efecto (sin dividir por cero)", () => {
    const d = deltas({ EDUCATION: { primaria: 0, secundaria: 0, superior: 0 } });
    expect(Number.isFinite(d.indicators.educationLevel)).toBe(true);
    expect(d.indicators.educationLevel).toBe(0);
  });

  it("direcciones: salario mínimo alto baja la pobreza y sube el desempleo; tasa alta lo contrario en PIB", () => {
    const sal = deltas({ ECONOMY: { salarioMinimo: 800 } });
    expect(sal.indicators.povertyRate).toBeLessThan(0);
    expect(sal.indicators.unemploymentRate).toBeGreaterThan(0);
    expect(sal.approval.POVERTY).toBeGreaterThan(0);
    expect(sal.approval.ELITE).toBeLessThan(0);
    const tasa = deltas({ ECONOMY: { tasaInteres: 15 } });
    expect(tasa.indicators.gdpPct).toBeLessThan(0);
    expect(tasa.indicators.inflation).toBeLessThan(0);
    expect(tasa.indicators.unemploymentRate).toBeGreaterThan(0);
  });

  it("ministerios que no existen o no tienen tabla se ignoran", () => {
    const d = subDecisionDeltas([{ key: "FOREIGN_AFFAIRS", subDecisions: { x: 9 } }, { key: "constructor", subDecisions: {} }], POP);
    expect(d.cost).toBe(0);
  });

  it("sumas entre ministerios: los efectos de cada uno se acumulan", () => {
    const solo = (c: Record<string, Subs>) => deltas(c).indicators.crimeRate;
    const juntos = solo({ SECURITY: { inversionCarceles: 80 }, JUSTICE: { durezaPenal: 90 } });
    expect(juntos).toBeCloseTo(solo({ SECURITY: { inversionCarceles: 80 } }) + solo({ JUSTICE: { durezaPenal: 90 } }), 10);
  });

  it("SUBDECISION_EFFECT_SCALE escala indicadores y aprobación pero no el costo; 0 los desactiva", () => {
    const base = deltas({ ECONOMY: { salarioMinimo: 700 }, HEALTH: { saludMental: true } });
    (BALANCE as { SUBDECISION_EFFECT_SCALE: number }).SUBDECISION_EFFECT_SCALE = 0.5;
    const mitad = deltas({ ECONOMY: { salarioMinimo: 700 }, HEALTH: { saludMental: true } });
    expect(mitad.indicators.povertyRate).toBeCloseTo(base.indicators.povertyRate / 2, 10);
    expect(mitad.approval.POVERTY).toBeCloseTo(base.approval.POVERTY / 2, 10);
    expect(mitad.cost).toBe(base.cost);
    (BALANCE as { SUBDECISION_EFFECT_SCALE: number }).SUBDECISION_EFFECT_SCALE = 0;
    expect(deltas({ ECONOMY: { salarioMinimo: 700 } }).indicators.povertyRate).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  Enganches en las fórmulas del motor
// ──────────────────────────────────────────────────────────────────────────────

describe("las sub-decisiones llegan a las fórmulas del motor", () => {
  const base = sembrado();

  it("pobreza y desempleo (salario mínimo)", () => {
    const e = estado({ ECONOMY: { salarioMinimo: 700 } });
    const dU = calculateUnemployment(e) - calculateUnemployment(base);
    expect(dU).toBeCloseTo(0.004 * 350, 8);
    // La pobreza recibe el efecto directo y el de segundo orden: más desempleo e inflación la suben
    const dI = calculateInflationSimple(e) - calculateInflationSimple(base);
    expect(dI).toBeCloseTo(0.0003 * 350, 8);
    const dP = calculatePoverty(e) - calculatePoverty(base);
    expect(dP).toBeCloseTo(-0.005 * 350 + BALANCE.POVERTY_UNEMPLOYMENT_FACTOR * dU + BALANCE.POVERTY_INFLATION_FACTOR * dI, 8);
  });

  it("seguridad alimentaria, educación y desigualdad", () => {
    expect(calculateFoodSecurity(estado({ AGRICULTURE: { infraestructuraRural: 90 } })) - calculateFoodSecurity(base)).toBeCloseTo(0.03 * 50, 8);
    expect(calculateEducation(estado({ EDUCATION: { becas: false } })) - calculateEducation(base)).toBeCloseTo(-1, 8);
    expect(calculateGini(estado({ ECONOMY: { politicaIndustrial: 100 } }), []) - calculateGini(base, [])).toBeCloseTo(0.03 * 50, 8);
  });

  it("crimen (jueces): efecto directo, con el pequeño rebote del costo (más déficit → inflación → pobreza → crimen)", () => {
    const e = estado({ JUSTICE: { juecesContratados: 700 } });
    const delta = calculateCrime(e) - calculateCrime(base);
    expect(delta).toBeLessThan(-0.9);
    expect(delta).toBeCloseTo(-0.002 * 500, 1);
  });

  it("enfermos: modo fallback sin enfermedades ni regiones (calculateHealth y regional)", () => {
    const e = estado({ HEALTH: { saludMental: true } });
    expect(calculateHealth(e) - calculateHealth(base)).toBeCloseTo(-1, 8);
    expect(calculateHealthRegional(e) - calculateHealthRegional(base)).toBeCloseTo(-1, 8);
  });

  it("enfermos: modo con catálogo de enfermedades", () => {
    const enfermedad = { id: "d1", name: "Gripe", category: "TRANSMISSIBLE", contagionRate: 0.1, mortalityRate: 0.01, prevalence: 0,
      prevalenceBase: 10, hasVaccine: true, preventionSensitivity: 0.5, monthlyCostPerPatient: 100, classAffinity: {} };
    const conEnfermedades = (cambios: Record<string, Subs>) => estado(cambios, {
      diseases: [enfermedad], diseasePrevalences: [{ id: "p", diseaseId: "d1", currentPrevalence: 10 }],
    } as never);
    const delta = calculateHealthRegional(conEnfermedades({ HEALTH: { vacunacion: false } })) - calculateHealthRegional(conEnfermedades({}));
    expect(delta).toBeCloseTo(1.5, 8);
  });

  it("inflación nunca baja de 0 aunque la tasa de interés sea alta", () => {
    expect(calculateInflationSimple(estado({ ECONOMY: { tasaInteres: 20 } }))).toBeGreaterThanOrEqual(0);
  });

  it("PIB: modificador en %", () => {
    const e = estado({ EDUCATION: { enfoqueSTEM: 100 } });
    expect(calculateGDP(e) / calculateGDP(base)).toBeCloseTo(1 + (0.04 * 40) / 100, 8);
  });

  it("gasto: el costo de las sub-decisiones se suma al gasto del mes", () => {
    const delta = calculateExpenses(estado({ HEALTH: { saludMental: true }, DEFENSE: { tropasActivas: 100_000 } })) - calculateExpenses(base);
    expect(delta).toBe(1_000_000 + scaleCost(150 * 50_000, POP));
  });

  it("aprobación por clase", () => {
    const clase = (key: string) => ({ id: "c", key, populationPercent: 25, averageIncome: 0, approval: 50, demands: [], educationLevel: 50, healthAccess: 50 } as SocialClassState);
    const e = estado({ ECONOMY: { salarioMinimo: 700 } });
    const dPobreza = calculateApprovalByClass(clase("POVERTY"), e, []) - calculateApprovalByClass(clase("POVERTY"), base, []);
    const dElite = calculateApprovalByClass(clase("ELITE"), e, []) - calculateApprovalByClass(clase("ELITE"), base, []);
    expect(dPobreza).toBeGreaterThan(0);
    expect(dElite).toBeLessThan(0);
  });

  it("aprobación: una clase que no está en la tabla no se rompe (no NaN)", () => {
    const rica = { id: "c", key: "RICH", populationPercent: 10, averageIncome: 0, approval: 50, demands: [], educationLevel: 50, healthAccess: 50 } as SocialClassState;
    expect(Number.isFinite(calculateApprovalByClass(rica, estado({ ECONOMY: { salarioMinimo: 700 } }), []))).toBe(true);
  });

  it("corrupción: prioridad a la corrupción y más jueces reducen la corrupción de los funcionarios", () => {
    const oficial = { id: "o", name: "X", role: "MINISTER", specialty: null, ministryId: null, partyId: null, loyalty: 50, ambition: 30, wealth: 1, ideology: { economic: 0, social: 0, authority: 0 }, corruption: 50, skill: 50, reputation: 50, status: "ACTIVE" } as OfficialState;
    const antes = updateOfficialCorruption(oficial, base);
    const despues = updateOfficialCorruption(oficial, estado({ JUSTICE: { prioridadCorrupcion: 100, juecesContratados: 700 } }));
    expect(antes - despues).toBeCloseTo(0.01 * 40 + 0.0005 * 500, 8);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  Resumen para la UI
// ──────────────────────────────────────────────────────────────────────────────

describe("describeSubDecisionEffects", () => {
  it("sin cambios no hay nada que mostrar", () => {
    expect(describeSubDecisionEffects(subDecisionDeltas(sembrado().ministries, POP))).toEqual([]);
  });

  it("lista los efectos no nulos con su etiqueta, aprobación y costo", () => {
    const e = describeSubDecisionEffects(subDecisionDeltas(estado({ HEALTH: { saludMental: true } }).ministries, POP));
    expect(e).toContainEqual({ label: "Enfermos", value: -1, kind: "indicator" });
    expect(e).toContainEqual({ label: "Aprobación: Clase media", value: 1, kind: "approval" });
    expect(e).toContainEqual({ label: "Costo mensual (USD)", value: 1_000_000, kind: "cost" });
  });

  it("omite lo insignificante", () => {
    const e = describeSubDecisionEffects(subDecisionDeltas(estado({ HEALTH: { hospitalesPublicos: 51 } }).ministries, POP));
    expect(e.some((x) => x.kind === "indicator")).toBe(false);
  });
});
