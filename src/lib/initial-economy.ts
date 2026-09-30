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
