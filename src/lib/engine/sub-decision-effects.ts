// ─── Efecto de las sub-decisiones sobre la simulación ─────────────────────────
// SPEC 4.1: cada cambio en una sub-decisión modifica los indicadores. La tabla
// de coeficientes vive en balance.ts (SUB_DECISION_EFFECTS); aquí solo se aplica.
//
// Fórmula (por sub-decisión, siempre relativa al valor sembrado `neutral`):
//   numérica: efecto = coeficiente × (clamp(valor, range) − neutral)
//   booleana: efecto = coeficiente si valor ≠ neutral, 0 si no
//   grupo:    valor = valor_i / Σ valores del grupo × 100   (suma 100, como pide el SPEC)
//   solape:   si hay un programa/ley equivalente activo (SUB_DECISION_OVERLAPS), la
//             sub-decisión no aplica los canales indicados (evita contar dos veces)
// Justificación: con el valor inicial el efecto es 0, así que una partida nueva no
// cambia; el efecto es lineal y acotado al `range`, así que un valor extremo (o uno
// manipulado) no puede disparar un indicador.

import { BALANCE, SUB_DECISION_EFFECTS, SUB_DECISION_OVERLAPS } from "../balance";
import type { SubDecisionTarget, SubDecisionClass, SubDecisionEffect, SubDecisionOverlap } from "../balance";
import { scaleCost } from "./cost-scale";

export type SubDecisionDeltas = {
  indicators: Record<SubDecisionTarget, number>;
  approval: Record<SubDecisionClass, number>;
  /** Gasto mensual adicional en USD, ya escalado a la población (negativo = ahorro) */
  cost: number;
};

type MinistryLike = { key: string; subDecisions: Record<string, number | boolean> };

/** Programas y leyes vigentes: lo único que hace falta para detectar solapes. */
export type SubDecisionContext = {
  programs?: readonly { type: string; status: string }[];
  activeLaws?: readonly { lawKey: string }[];
};

/** Solape vigente de una sub-decisión (el reemplazo está activo), o undefined. */
export function activeOverlap(
  ministryKey: string,
  subKey: string,
  context: SubDecisionContext | undefined,
): SubDecisionOverlap | undefined {
  if (!context || !has(SUB_DECISION_OVERLAPS, ministryKey) || !has(SUB_DECISION_OVERLAPS[ministryKey], subKey)) return undefined;
  const overlap = SUB_DECISION_OVERLAPS[ministryKey][subKey];
  const programActive = overlap.program !== undefined &&
    (context.programs ?? []).some((p) => p.status === "ACTIVE" && p.type === overlap.program);
  const lawActive = overlap.law !== undefined &&
    (context.activeLaws ?? []).some((l) => l.lawKey === overlap.law);
  return programActive || lawActive ? overlap : undefined;
}

/** Contexto de solapes a partir del estado del juego. */
export function subDecisionContext(state: SubDecisionContext): SubDecisionContext {
  return { programs: state.programs, activeLaws: state.activeLaws };
}

const TARGETS: SubDecisionTarget[] = [
  "povertyRate", "unemploymentRate", "sickRate", "foodSecurity", "crimeRate",
  "educationLevel", "gini", "inflation", "gdpPct", "corruptionReduction",
];
const CLASSES: SubDecisionClass[] = ["EXTREME_POVERTY", "POVERTY", "MIDDLE", "ELITE"];

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

function emptyDeltas(): SubDecisionDeltas {
  return {
    indicators: Object.fromEntries(TARGETS.map((t) => [t, 0])) as Record<SubDecisionTarget, number>,
    approval: Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<SubDecisionClass, number>,
    cost: 0,
  };
}

/** Valor guardado si tiene el tipo esperado; si falta o es basura, el neutral (efecto 0). */
function storedValue(ministry: MinistryLike, key: string, spec: SubDecisionEffect): number | boolean {
  const v = ministry.subDecisions?.[key];
  if (typeof spec.neutral === "boolean") return typeof v === "boolean" ? v : spec.neutral;
  return typeof v === "number" && Number.isFinite(v) ? v : spec.neutral;
}

/**
 * Efecto total de las sub-decisiones de los ministerios dados.
 * @param population - para escalar el costo mensual (COST_REFERENCE_POPULATION)
 * @param context - programas y leyes vigentes, para anular los canales que solapan
 */
export function subDecisionDeltas(
  ministries: readonly MinistryLike[],
  population: number,
  context?: SubDecisionContext,
): SubDecisionDeltas {
  const deltas = emptyDeltas();
  let rawCost = 0;

  for (const ministry of ministries) {
    if (!has(SUB_DECISION_EFFECTS, ministry.key)) continue;
    const table = SUB_DECISION_EFFECTS[ministry.key];

    // Suma de cada grupo (para normalizar a 100)
    const groupSum: Record<string, number> = {};
    for (const [key, spec] of Object.entries(table)) {
      if (spec.group) groupSum[spec.group] = (groupSum[spec.group] ?? 0) + (storedValue(ministry, key, spec) as number);
    }

    for (const [key, spec] of Object.entries(table)) {
      let units: number; // cuánto se aparta del valor sembrado (booleanas: 0 o 1)
      const value = storedValue(ministry, key, spec);
      if (typeof spec.neutral === "boolean") {
        units = value !== spec.neutral ? 1 : 0;
      } else if (spec.group) {
        const sum = groupSum[spec.group];
        units = sum > 0 ? ((value as number) / sum) * 100 - spec.neutral : 0;
      } else {
        const [lo, hi] = spec.range ?? [-Infinity, Infinity];
        units = Math.min(hi, Math.max(lo, value as number)) - spec.neutral;
      }
      if (units === 0) continue;

      const suppressed = activeOverlap(ministry.key, key, context)?.suppress ?? [];
      if (!suppressed.includes("indicators")) {
        for (const [target, coef] of Object.entries(spec.indicators ?? {})) {
          deltas.indicators[target as SubDecisionTarget] += coef * units * BALANCE.SUBDECISION_EFFECT_SCALE;
        }
      }
      if (!suppressed.includes("approval")) {
        for (const [cls, coef] of Object.entries(spec.approval ?? {})) {
          deltas.approval[cls as SubDecisionClass] += coef * units * BALANCE.SUBDECISION_EFFECT_SCALE;
        }
      }
      if (!suppressed.includes("cost")) rawCost += (spec.cost ?? 0) * units;
    }
  }

  deltas.cost = scaleCost(rawCost, population);
  return deltas;
}

/** Atajo para las fórmulas de indicadores: efecto de las sub-decisiones del estado sobre un indicador. */
export function subDecisionIndicator(
  state: { ministries: readonly MinistryLike[]; population: number } & SubDecisionContext,
  target: SubDecisionTarget,
): number {
  return subDecisionDeltas(state.ministries, state.population, subDecisionContext(state)).indicators[target];
}

/**
 * Sub-decisiones de un ministerio cuyo efecto está anulado ahora por un solape,
 * con su aviso, para informar al jugador en la UI. Solo las que se apartan de su
 * valor sembrado (las que no tienen efecto no se anulan de nada).
 */
export function suppressedSubDecisions(
  ministry: MinistryLike,
  context: SubDecisionContext | undefined,
): Array<{ key: string; notice: string }> {
  if (!has(SUB_DECISION_EFFECTS, ministry.key)) return [];
  const out: Array<{ key: string; notice: string }> = [];
  for (const [key, spec] of Object.entries(SUB_DECISION_EFFECTS[ministry.key])) {
    const overlap = activeOverlap(ministry.key, key, context);
    if (overlap && storedValue(ministry, key, spec) !== spec.neutral) out.push({ key, notice: overlap.notice });
  }
  return out;
}

// ─── Resumen para la UI ───────────────────────────────────────────────────────

const INDICATOR_LABEL: Record<SubDecisionTarget, string> = {
  povertyRate: "Pobreza", unemploymentRate: "Desempleo", sickRate: "Enfermos",
  foodSecurity: "Seguridad alimentaria", crimeRate: "Crimen", educationLevel: "Educación",
  gini: "Desigualdad (Gini)", inflation: "Inflación", gdpPct: "PIB (%)",
  corruptionReduction: "Reducción de corrupción (pts/mes)",
};
const CLASS_LABEL: Record<SubDecisionClass, string> = {
  EXTREME_POVERTY: "Pobreza extrema", POVERTY: "Pobreza", MIDDLE: "Clase media", ELITE: "Élite",
};

/** Efectos no nulos, ya formateados con etiqueta en español, para mostrarlos al jugador. */
export function describeSubDecisionEffects(
  deltas: SubDecisionDeltas,
  minAbs = 0.05,
): Array<{ label: string; value: number; kind: "indicator" | "approval" | "cost" }> {
  const out: Array<{ label: string; value: number; kind: "indicator" | "approval" | "cost" }> = [];
  for (const t of TARGETS) {
    // corruptionReduction trae coeficientes diminutos (por mes): umbral propio
    const threshold = t === "corruptionReduction" ? 0.005 : minAbs;
    if (Math.abs(deltas.indicators[t]) >= threshold) out.push({ label: INDICATOR_LABEL[t], value: deltas.indicators[t], kind: "indicator" });
  }
  for (const c of CLASSES) {
    if (Math.abs(deltas.approval[c]) >= minAbs) out.push({ label: `Aprobación: ${CLASS_LABEL[c]}`, value: deltas.approval[c], kind: "approval" });
  }
  if (Math.abs(deltas.cost) >= 1) out.push({ label: "Costo mensual (USD)", value: deltas.cost, kind: "cost" });
  return out;
}
