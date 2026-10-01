// ─── Sub-decisiones de ministerio: claves válidas, tipos y rangos ─────────────
// El cliente envía `subDecisionChanges`; el motor solo acepta claves conocidas del
// ministerio con el tipo correcto y acota los números a su rango. Los rangos son
// los que ofrece la UI (components/game/sub-decisions.tsx); un test garantiza que
// coinciden. Los tres numéricos sin tope en la UI (salario mínimo, tropas, jueces)
// tienen un techo holgado, muy por encima de los valores iniciales (350 / 50.000 / 200).
//
// Nota: hoy ninguna fórmula del motor lee estas decisiones (solo la UI); la
// validación protege el JSON persistido y a las fórmulas futuras que las usen.

export type SubDecisionSpec =
  | { type: "boolean" }
  | { type: "number"; min: number; max: number; step?: number };

const bool: SubDecisionSpec = { type: "boolean" };
const pct: SubDecisionSpec = { type: "number", min: 0, max: 100 };

export const SUB_DECISION_SPECS: Record<string, Record<string, SubDecisionSpec>> = {
  HEALTH: { hospitalesPublicos: pct, vacunacion: bool, saludMental: bool },
  EDUCATION: { primaria: pct, secundaria: pct, superior: pct, enfoqueSTEM: pct, becas: bool },
  ECONOMY: {
    tasaInteres: { type: "number", min: 1, max: 20, step: 0.5 },
    salarioMinimo: { type: "number", min: 1, max: 10_000, step: 10 },
    politicaIndustrial: pct,
  },
  DEFENSE: {
    tropasActivas: { type: "number", min: 0, max: 2_000_000, step: 1000 },
    gastoEquipamiento: pct,
    servicioMilitar: bool,
  },
  SECURITY: { patrullajeUrbano: pct, politicaDrogas: pct, inversionCarceles: pct },
  JUSTICE: {
    juecesContratados: { type: "number", min: 0, max: 50_000, step: 10 },
    prioridadCorrupcion: pct,
    durezaPenal: pct,
  },
  AGRICULTURE: { subsidioPequenoProductor: pct, infraestructuraRural: pct },
  SOCIAL_DEVELOPMENT: {
    focalizacion: pct,
    prioridadNinos: pct,
    prioridadAdultosMayores: pct,
    prioridadMujeres: pct,
  },
};

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

/** Rango de una sub-decisión numérica (para la UI). Lanza si no existe o no es numérica. */
export function numberRange(ministryKey: string, subKey: string): { min: number; max: number; step?: number } {
  const spec = has(SUB_DECISION_SPECS, ministryKey) && has(SUB_DECISION_SPECS[ministryKey], subKey)
    ? SUB_DECISION_SPECS[ministryKey][subKey]
    : undefined;
  if (!spec || spec.type !== "number") throw new Error(`${ministryKey}.${subKey} no es una sub-decisión numérica`);
  return { min: spec.min, max: spec.max, step: spec.step };
}

export type SubDecisionCheck =
  | { ok: true; value: number | boolean }
  | { ok: false; reason: string };

/**
 * Valida un cambio de sub-decisión. Los números válidos se acotan al rango;
 * claves desconocidas, tipos incorrectos y números no finitos se rechazan.
 */
export function validateSubDecision(ministryKey: string, subKey: string, value: unknown): SubDecisionCheck {
  if (!has(SUB_DECISION_SPECS, ministryKey)) {
    return { ok: false, reason: `ministerio desconocido "${ministryKey}"` };
  }
  const specs = SUB_DECISION_SPECS[ministryKey];
  if (!has(specs, subKey)) {
    return { ok: false, reason: `"${subKey}" no es una decisión de ${ministryKey}` };
  }
  const spec = specs[subKey];
  if (spec.type === "boolean") {
    return typeof value === "boolean"
      ? { ok: true, value }
      : { ok: false, reason: `"${subKey}" debe ser sí o no` };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: `"${subKey}" debe ser un número` };
  }
  return { ok: true, value: Math.min(spec.max, Math.max(spec.min, value)) };
}

/**
 * Aplica los cambios válidos sobre los ministerios (muta `subDecisions`) y
 * devuelve el motivo de cada cambio rechazado. Un cambio válido para un
 * ministerio que no existe en la partida se ignora sin error.
 */
export function applySubDecisionChanges(
  ministries: Array<{ key: string; subDecisions: Record<string, number | boolean> }>,
  changes: Record<string, Record<string, unknown>> | undefined,
): string[] {
  const rejections: string[] = [];
  for (const [ministryKey, perMinistry] of Object.entries(changes ?? {})) {
    const ministry = ministries.find((m) => m.key === ministryKey);
    for (const [subKey, value] of Object.entries(perMinistry ?? {})) {
      const check = validateSubDecision(ministryKey, subKey, value);
      if (!check.ok) {
        rejections.push(check.reason);
        continue;
      }
      if (ministry) ministry.subDecisions[subKey] = check.value;
    }
  }
  return rejections;
}
