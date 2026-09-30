import { describe, it, expect } from "vitest";
import { getPresetConfig, PRESET_KEYS } from "@/lib/game-factory";
import { initialEconomy, DEFAULT_POPULATION, DEFAULT_TREASURY } from "@/lib/initial-economy";

describe("initialEconomy", () => {
  it.each(PRESET_KEYS)("preset %s devuelve los valores de su configuración", (preset) => {
    const cfg = getPresetConfig(preset, "normal");
    expect(initialEconomy(preset, "normal")).toEqual({
      treasury: cfg.treasury,
      population: cfg.population,
      gdp: cfg.gdpBase,
      povertyRate: cfg.povertyRate,
      unemploymentRate: cfg.unemploymentRate,
      inflation: cfg.inflation,
    });
  });

  it("los presets difieren entre sí en población y tesoro", () => {
    const poblaciones = new Set(PRESET_KEYS.map((p) => initialEconomy(p, "normal").population));
    const tesoros = new Set(PRESET_KEYS.map((p) => initialEconomy(p, "normal").treasury));
    expect(poblaciones.size).toBe(PRESET_KEYS.length);
    expect(tesoros.size).toBe(PRESET_KEYS.length);
  });

  it("la dificultad no cambia la economía inicial", () => {
    for (const preset of PRESET_KEYS) {
      expect(initialEconomy(preset, "facil")).toEqual(initialEconomy(preset, "dificil"));
    }
  });

  it("un preset desconocido o vacío usa los valores por defecto sin lanzar", () => {
    for (const preset of ["no-existe", "", null, undefined]) {
      const e = initialEconomy(preset, "normal");
      expect(e.population).toBe(DEFAULT_POPULATION);
      expect(e.treasury).toBe(DEFAULT_TREASURY);
    }
  });
});
