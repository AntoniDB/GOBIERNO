// ─── Efecto de las sub-decisiones sobre la simulación ─────────────────────────
// SPEC 4.1: cada cambio en una sub-decisión modifica los indicadores. La tabla
// de coeficientes vive en balance.ts (SUB_DECISION_EFFECTS); aquí solo se aplica.
//
// Fórmula (por sub-decisión, siempre relativa al valor sembrado `neutral`):
//   numérica: efecto = coeficiente × (clamp(valor, range) − neutral)
//   booleana: efecto = coeficiente si valor ≠ neutral, 0 si no
//   grupo:    valor = valor_i / Σ valores del grupo × 100   (suma 100, como pide el SPEC)
// Justificación: con el valor inicial el efecto es 0, así que una partida nueva no
// cambia; el efecto es lineal y acotado al `range`, así que un valor extremo (o uno
// manipulado) no puede disparar un indicador.

import { BALANCE, SUB_DECISION_EFFECTS } from "../balance";
import type { SubDecisionTarget, SubDecisionClass, SubDecisionEffect } from "../balance";
import { scaleCost } from "./cost-scale";

export type SubDecisionDeltas = {
  indicators: Record<SubDecisionTarget, number>;
  approval: Record<SubDecisionClass, number>;
  /** Gasto mensual adicional en USD, ya escalado a la población (negativo = ahorro) */
  cost: number;
};

type MinistryLike = { key: string; subDecisions: Record<string, number | boolean> };

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
 */
export function subDecisionDeltas(ministries: readonly MinistryLike[], population: number): SubDecisionDeltas {
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

      for (const [target, coef] of Object.entries(spec.indicators ?? {})) {
        deltas.indicators[target as SubDecisionTarget] += coef * units * BALANCE.SUBDECISION_EFFECT_SCALE;
      }
      for (const [cls, coef] of Object.entries(spec.approval ?? {})) {
        deltas.approval[cls as SubDecisionClass] += coef * units * BALANCE.SUBDECISION_EFFECT_SCALE;
      }
      rawCost += (spec.cost ?? 0) * units;
    }
  }

  deltas.cost = scaleCost(rawCost, population);
  return deltas;
}

/** Atajo para las fórmulas de indicadores: efecto de las sub-decisiones del estado sobre un indicador. */
export function subDecisionIndicator(
  state: { ministries: readonly MinistryLike[]; population: number },
  target: SubDecisionTarget,
): number {
  return subDecisionDeltas(state.ministries, state.population).indicators[target];
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
