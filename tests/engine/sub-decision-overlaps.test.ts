import { describe, it, expect } from "vitest";
import type { GameState, SocialClassState } from "@/lib/engine/types";
import { SUB_DECISION_EFFECTS, SUB_DECISION_OVERLAPS } from "@/lib/balance";
import {
  subDecisionDeltas, subDecisionContext, activeOverlap, suppressedSubDecisions, type SubDecisionContext,
} from "@/lib/engine/sub-decision-effects";
import { generateMinistries, LAW_CATALOG } from "@/lib/game-factory";
import { calculateHealthRegional, calculateEducation, calculateUnemployment, calculateCrime } from "@/lib/engine/indicators";
import { calculateExpenses } from "@/lib/engine/economy";
import { calculateApprovalByClass } from "@/lib/engine/approval";

const POP = 10_000_000;
type Subs = Record<string, number | boolean>;

const ministerios = (cambios: Record<string, Subs> = {}) =>
  generateMinistries().map((m, i) => ({
    id: `m${i}`, key: m.key, budgetPercent: m.budgetPercent, efficiency: 50, internalCorruption: 10,
    subDecisions: { ...m.subDecisions, ...(cambios[m.key] ?? {}) } as Subs, ministerOfficialId: null,
    producedResources: {}, consumedResources: {}, healthBudgetSplit: {},
  }));

const programa = (type: string, status = "ACTIVE") => ({ type, status });
const ley = (lawKey: string) => ({ lawKey, id: lawKey, activatedAt: "", effectsJson: {} });

function estado(cambios: Record<string, Subs> = {}, contexto: SubDecisionContext = {}, overrides: Partial<GameState> = {}): GameState {
  return {
    population: POP, ministries: ministerios(cambios), officials: [], organisms: [], judicialCases: [],
    regions: [], diseases: [], diseasePrevalences: [], socialClasses: [],
    programs: [], activeLaws: [], ...contexto, ...overrides,
  } as unknown as GameState;
}

const deltas = (cambios: Record<string, Subs>, contexto?: SubDecisionContext) =>
  subDecisionDeltas(ministerios(cambios), POP, contexto);

describe("SUB_DECISION_OVERLAPS: integridad de la tabla", () => {
  const entradas = Object.entries(SUB_DECISION_OVERLAPS).flatMap(([m, t]) => Object.entries(t).map(([k, o]) => [m, k, o] as const));

  it("cada solape apunta a una sub-decisión que existe y tiene el reemplazo definido", () => {
    expect(entradas.length).toBeGreaterThan(0);
    for (const [m, k, o] of entradas) {
      expect(SUB_DECISION_EFFECTS[m]?.[k], `${m}.${k}`).toBeDefined();
      expect(Boolean(o.program) !== Boolean(o.law), `${m}.${k}: programa XOR ley`).toBe(true);
      expect(o.suppress.length, `${m}.${k}`).toBeGreaterThan(0);
      expect(o.notice.length, `${m}.${k}`).toBeGreaterThan(0);
    }
  });

  it("las leyes referidas existen en el catálogo", () => {
    const claves = new Set(LAW_CATALOG.map((l) => l.key));
    for (const [m, k, o] of entradas) if (o.law) expect(claves.has(o.law), `${m}.${k} → ${o.law}`).toBe(true);
  });

  it("solo anula canales que la sub-decisión realmente tiene", () => {
    for (const [m, k, o] of entradas) {
      const e = SUB_DECISION_EFFECTS[m][k];
      const tiene = { indicators: Object.keys(e.indicators ?? {}).length > 0, approval: Object.keys(e.approval ?? {}).length > 0, cost: (e.cost ?? 0) !== 0 };
      for (const canal of o.suppress) expect(tiene[canal], `${m}.${k} no tiene canal ${canal}`).toBe(true);
    }
  });
});

describe("activeOverlap", () => {
  it("un programa ACTIVE activa el solape; CANCELLED o de otro tipo no", () => {
    expect(activeOverlap("HEALTH", "saludMental", { programs: [programa("MENTAL_HEALTH_PROGRAM")] })).toBeDefined();
    expect(activeOverlap("HEALTH", "saludMental", { programs: [programa("MENTAL_HEALTH_PROGRAM", "CANCELLED")] })).toBeUndefined();
    expect(activeOverlap("HEALTH", "saludMental", { programs: [programa("VACCINATION_CAMPAIGN")] })).toBeUndefined();
  });

  it("una ley vigente activa el solape; otra ley no", () => {
    expect(activeOverlap("DEFENSE", "servicioMilitar", { activeLaws: [ley("servicio-militar-obligatorio")] })).toBeDefined();
    expect(activeOverlap("DEFENSE", "servicioMilitar", { activeLaws: [ley("becas-merito")] })).toBeUndefined();
  });

  it("sin contexto, o para una sub-decisión sin solape, no hay nada", () => {
    expect(activeOverlap("HEALTH", "saludMental", undefined)).toBeUndefined();
    expect(activeOverlap("HEALTH", "hospitalesPublicos", { programs: [programa("MENTAL_HEALTH_PROGRAM")] })).toBeUndefined();
    expect(activeOverlap("constructor", "x", { programs: [] })).toBeUndefined();
  });
});

describe("subDecisionDeltas con solapes", () => {
  it("salud mental: con el programa activo no suma indicador, aprobación ni costo", () => {
    const solo = deltas({ HEALTH: { saludMental: true } });
    expect(solo.indicators.sickRate).toBe(-1);
    expect(solo.cost).toBe(1_000_000);
    const conPrograma = deltas({ HEALTH: { saludMental: true } }, { programs: [programa("MENTAL_HEALTH_PROGRAM")] });
    expect(conPrograma.indicators.sickRate).toBe(0);
    expect(conPrograma.approval.MIDDLE).toBe(0);
    expect(conPrograma.cost).toBe(0);
  });

  it("vacunación: apagarla castiga, salvo que una campaña esté activa", () => {
    expect(deltas({ HEALTH: { vacunacion: false } }).indicators.sickRate).toBe(1.5);
    expect(deltas({ HEALTH: { vacunacion: false } }, { programs: [programa("VACCINATION_CAMPAIGN")] }).indicators.sickRate).toBe(0);
    expect(deltas({ HEALTH: { vacunacion: false } }, { programs: [programa("VACCINATION_CAMPAIGN", "CANCELLED")] }).indicators.sickRate).toBe(1.5);
  });

  it("becas: con la ley vigente, apagar las becas generales no resta educación, aprobación ni ahorra", () => {
    const sola = deltas({ EDUCATION: { becas: false } });
    expect(sola.indicators.educationLevel).toBe(-1);
    expect(sola.cost).toBeLessThan(0);
    const conLey = deltas({ EDUCATION: { becas: false } }, { activeLaws: [ley("becas-merito")] });
    expect(conLey.indicators.educationLevel).toBe(0);
    expect(conLey.approval.POVERTY).toBe(0);
    expect(conLey.cost).toBe(0);
  });

  it("servicio militar: con la ley solo se anula la aprobación; empleo, crimen y costo siguen", () => {
    const solo = deltas({ DEFENSE: { servicioMilitar: true } });
    const conLey = deltas({ DEFENSE: { servicioMilitar: true } }, { activeLaws: [ley("servicio-militar-obligatorio")] });
    expect(solo.approval.POVERTY).toBeLessThan(0);
    expect(conLey.approval.POVERTY).toBe(0);
    expect(conLey.approval.ELITE).toBe(0);
    expect(conLey.indicators.unemploymentRate).toBe(solo.indicators.unemploymentRate);
    expect(conLey.indicators.crimeRate).toBe(solo.indicators.crimeRate);
    expect(conLey.cost).toBe(solo.cost);
  });

  it("un solape no toca a las demás sub-decisiones del mismo ministerio", () => {
    const cambios = { HEALTH: { saludMental: true, hospitalesPublicos: 90 } };
    const sinSolape = deltas(cambios);
    const conSolape = deltas(cambios, { programs: [programa("MENTAL_HEALTH_PROGRAM")] });
    // Solo desaparece la parte de saludMental (-1 enfermos, 1,0 de aprobación, 1M de costo)
    expect(conSolape.indicators.sickRate).toBeCloseTo(sinSolape.indicators.sickRate + 1, 10);
    expect(conSolape.cost).toBe(sinSolape.cost - 1_000_000);
  });

  it("con el valor sembrado nada cambia, haya o no solape (no hay efecto que anular)", () => {
    const contexto = { programs: [programa("MENTAL_HEALTH_PROGRAM"), programa("VACCINATION_CAMPAIGN")], activeLaws: [ley("becas-merito"), ley("servicio-militar-obligatorio")] };
    expect(deltas({}, contexto)).toEqual(deltas({}));
  });
});

describe("suppressedSubDecisions (aviso en la UI)", () => {
  const salud = (valores: Subs) => ({ key: "HEALTH", subDecisions: { vacunacion: true, saludMental: false, hospitalesPublicos: 50, ...valores } });
  const contexto = { programs: [programa("MENTAL_HEALTH_PROGRAM")] };

  it("avisa solo si la sub-decisión se aparta de su valor sembrado y el reemplazo está activo", () => {
    expect(suppressedSubDecisions(salud({ saludMental: true }), contexto).map((s) => s.key)).toEqual(["saludMental"]);
    expect(suppressedSubDecisions(salud({ saludMental: false }), contexto)).toEqual([]);
    expect(suppressedSubDecisions(salud({ saludMental: true }), {})).toEqual([]);
  });

  it("el aviso es el texto de la tabla", () => {
    const [aviso] = suppressedSubDecisions(salud({ saludMental: true }), contexto);
    expect(aviso.notice).toBe(SUB_DECISION_OVERLAPS.HEALTH.saludMental.notice);
  });

  it("ministerios sin tabla no fallan", () => {
    expect(suppressedSubDecisions({ key: "FOREIGN_AFFAIRS", subDecisions: {} }, contexto)).toEqual([]);
  });
});

describe("el motor aplica los solapes en sus fórmulas", () => {
  const clase = (key: string) => ({ id: "c", key, populationPercent: 25, averageIncome: 0, approval: 50, demands: [], educationLevel: 50, healthAccess: 50 } as SocialClassState);

  it("subDecisionContext toma programas y leyes del estado", () => {
    const c = subDecisionContext(estado({}, { programs: [programa("MENTAL_HEALTH_PROGRAM")], activeLaws: [ley("becas-merito")] }));
    expect(c.programs).toHaveLength(1);
    expect(c.activeLaws).toHaveLength(1);
  });

  it("enfermos: el programa de salud mental quita el efecto del interruptor", () => {
    const base = calculateHealthRegional(estado({}));
    expect(calculateHealthRegional(estado({ HEALTH: { saludMental: true } })) - base).toBeCloseTo(-1, 8);
    const conPrograma = estado({ HEALTH: { saludMental: true } }, { programs: [programa("MENTAL_HEALTH_PROGRAM")] });
    expect(calculateHealthRegional(conPrograma) - base).toBeCloseTo(0, 8);
  });

  it("educación: con la ley de becas el interruptor apagado no resta", () => {
    const base = calculateEducation(estado({}));
    expect(calculateEducation(estado({ EDUCATION: { becas: false } })) - base).toBeCloseTo(-1, 8);
    expect(calculateEducation(estado({ EDUCATION: { becas: false } }, { activeLaws: [ley("becas-merito")] })) - base).toBeCloseTo(0, 8);
  });

  it("empleo y crimen del servicio militar siguen con la ley vigente", () => {
    const leyMilitar = { activeLaws: [ley("servicio-militar-obligatorio")] };
    expect(calculateUnemployment(estado({ DEFENSE: { servicioMilitar: true } }, leyMilitar))).toBeLessThan(calculateUnemployment(estado({}, leyMilitar)));
    expect(calculateCrime(estado({ DEFENSE: { servicioMilitar: true } }, leyMilitar))).toBeLessThan(calculateCrime(estado({}, leyMilitar)));
  });

  it("gasto: el costo de la sub-decisión solapada no se cobra dos veces", () => {
    const base = calculateExpenses(estado({}));
    const sola = calculateExpenses(estado({ HEALTH: { saludMental: true } })) - base;
    expect(sola).toBe(1_000_000);
    const conPrograma = estado({ HEALTH: { saludMental: true } }, { programs: [programa("MENTAL_HEALTH_PROGRAM")] });
    expect(calculateExpenses(conPrograma) - calculateExpenses(estado({}, { programs: [programa("MENTAL_HEALTH_PROGRAM")] }))).toBe(0);
  });

  it("aprobación: el servicio militar no suma su golpe encima del de la ley", () => {
    const leyMilitar = { activeLaws: [ley("servicio-militar-obligatorio")] };
    const conInterruptor = estado({ DEFENSE: { servicioMilitar: true } }, leyMilitar);
    const sinInterruptor = estado({}, leyMilitar);
    for (const k of ["EXTREME_POVERTY", "POVERTY", "MIDDLE", "ELITE"]) {
      // Sin el golpe directo (-1,5 a -2 puntos) solo queda el rebote de segundo orden
      // (menos desempleo y crimen → algo más de aprobación): nunca menos que con la ley sola
      const diferencia = calculateApprovalByClass(clase(k), conInterruptor, []) - calculateApprovalByClass(clase(k), sinInterruptor, []);
      expect(diferencia, k).toBeGreaterThanOrEqual(0);
      expect(diferencia, k).toBeLessThan(0.5);
    }
    // Sin la ley el interruptor sí pesa
    expect(calculateApprovalByClass(clase("POVERTY"), estado({ DEFENSE: { servicioMilitar: true } }), []))
      .toBeLessThan(calculateApprovalByClass(clase("POVERTY"), estado({}), []));
  });
});
