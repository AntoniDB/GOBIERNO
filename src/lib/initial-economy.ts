// ─── Valores económicos iniciales de una partida (desde su preset) ───────────
// Una partida recién creada no tiene MonthSnapshot (el del mes 0 rompía la
// idempotencia de advanceMonth, ver ISSUES.md #2), así que los valores que el
// preset define para tesoro, población, PIB, pobreza, desempleo e inflación se
// derivan de Game.preset/difficulty mientras no exista un snapshot. Con el
// primer snapshot, este módulo deja de usarse.

import { getPresetConfig, PRESET_KEYS, type PresetKey, type Difficulty } from "./game-factory";

/** Valores de respaldo para partidas con un preset desconocido. */
export const DEFAULT_TREASURY = 1_000_000_000;
export const DEFAULT_POPULATION = 10_000_000;

export interface InitialEconomy {
  treasury: number;
  population: number;
  gdp: number;
  povertyRate: number;
  unemploymentRate: number;
  inflation: number;
}

const FALLBACK: InitialEconomy = {
  treasury: DEFAULT_TREASURY,
  population: DEFAULT_POPULATION,
  gdp: 0,
  povertyRate: 0,
  unemploymentRate: 0,
  inflation: 0,
};

export function initialEconomy(
  preset: string | null | undefined,
  difficulty: string | null | undefined,
): InitialEconomy {
  if (!preset || !(PRESET_KEYS as readonly string[]).includes(preset)) return FALLBACK;
  const cfg = getPresetConfig(preset as PresetKey, (difficulty ?? "normal") as Difficulty);
  return {
    treasury: cfg.treasury,
    population: cfg.population,
    gdp: cfg.gdpBase,
    povertyRate: cfg.povertyRate,
    unemploymentRate: cfg.unemploymentRate,
    inflation: cfg.inflation,
  };
}

/** Indicadores nacionales del último snapshot (o del preset si aún no hay ninguno). */
export interface SnapshotIndicators {
  gdp: number;
  povertyRate: number;
  unemploymentRate: number;
  sickRate: number;
  crimeRate: number;
  foodSecurity: number;
  educationLevel: number;
  inflation: number;
  lifeExpectancy: number;
}

type SnapshotLike = Partial<Record<keyof SnapshotIndicators, number | null>> | null | undefined;

/**
 * Indicadores con los que arranca un turno: los del último snapshot o, sin él, los del preset.
 * Los indicadores se recalculan desde cero a mitad del turno, pero lo que corre antes (p. ej. los
 * candidatos, que dependen de la educación) lee estos valores. `advanceMonth` no los cargaba:
 * llegaban `undefined`, y cada candidato nacía con `skill = NaN` (y nunca salían 2-3 a la vez).
 * `getGameState` y `advanceMonth` usan esta misma función para no volver a divergir.
 */
export function snapshotIndicators(snapshot: SnapshotLike, initial: InitialEconomy): SnapshotIndicators {
  return {
    gdp: snapshot?.gdp ?? initial.gdp,
    povertyRate: snapshot?.povertyRate ?? initial.povertyRate,
    unemploymentRate: snapshot?.unemploymentRate ?? initial.unemploymentRate,
    sickRate: snapshot?.sickRate ?? 0,
    crimeRate: snapshot?.crimeRate ?? 0,
    foodSecurity: snapshot?.foodSecurity ?? 0,
    educationLevel: snapshot?.educationLevel ?? 0,
    inflation: snapshot?.inflation ?? initial.inflation,
    lifeExpectancy: snapshot?.lifeExpectancy ?? 68,
  };
}
