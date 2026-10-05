import { describe, it, expect } from "vitest";
import type { GameState, RegionState, LongRunningDecisionState } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";
import { regionBeds, regionBedDemand, regionSaturation } from "@/lib/engine/hospital-capacity";
import { generateRegions, scaleHealthNetwork, getPresetConfig, PRESET_KEYS, type PresetKey } from "@/lib/game-factory";
import { detectHospitalCollapse } from "@/lib/engine/health-crises";
import { calculateNationalSaturationMortality } from "@/lib/engine/indicators";
import { applyDecisionEffects } from "@/lib/engine/long-running-decisions";
import { createRNG } from "@/lib/rng";

const SICK_BASE = 41; // sickRate típico con el catálogo de enfermedades (Salud-2)

/** Regiones sembradas como las deja createInitialGame, con id para el estado. */
function regiones(preset: PresetKey, population: number): RegionState[] {
  return generateRegions(preset, population).map((r, i) => ({ id: `r${i}`, ...r })) as unknown as RegionState[];
}
const estado = (preset: PresetKey, population = getPresetConfig(preset, "normal").population, sickRate = SICK_BASE): GameState =>
  ({
    population, sickRate, currentYear: 1, currentMonth: 1, regions: regiones(preset, population),
    socialClasses: [], consecutiveSaturationMonths: {},
  }) as unknown as GameState;
const saturaciones = (s: GameState) => s.regions.map((r) => regionSaturation(s.population, s.sickRate, r));

describe("hospital-capacity", () => {
  const region = (pct: number, p = 0, s = 0, t = 0) =>
    ({ id: "r", name: "R", populationPercent: pct,
      healthCoverage: { primary: { facilities: 1, beds: p, operationalCost: 0 }, secondary: { facilities: 1, beds: s, operationalCost: 0 }, tertiary: { facilities: 1, beds: t, operationalCost: 0 } } }) as unknown as RegionState;

  it("regionBeds suma los tres niveles (y tolera datos faltantes)", () => {
    expect(regionBeds(region(10, 5, 3, 2))).toBe(10);
    expect(regionBeds({ id: "x", populationPercent: 10 } as unknown as RegionState)).toBe(0);
  });

  it("la demanda de camas es población región × sickRate × fracción de hospitalización", () => {
    expect(regionBedDemand(10_000_000, 40, { populationPercent: 25 })).toBeCloseTo(2_500_000 * 0.4 * BALANCE.HOSPITALIZATION_SHARE, 8);
  });

  it("la demanda escala linealmente con población y enfermos", () => {
    const base = regionBedDemand(10_000_000, 20, { populationPercent: 30 });
    expect(regionBedDemand(20_000_000, 20, { populationPercent: 30 })).toBeCloseTo(2 * base, 8);
    expect(regionBedDemand(10_000_000, 40, { populationPercent: 30 })).toBeCloseTo(2 * base, 8);
  });

  it("saturación = demanda / camas; sin camas es Infinity si hay demanda y 0 si no", () => {
    const r = region(25, 100, 0, 0);
    expect(regionSaturation(10_000_000, 40, r)).toBeCloseTo(regionBedDemand(10_000_000, 40, r) / 100, 8);
    expect(regionSaturation(10_000_000, 40, region(25))).toBe(Infinity);
    expect(regionSaturation(10_000_000, 0, region(25))).toBe(0);
  });
});

describe("la red de camas sembrada escala con la población", () => {
  it("con la población de referencia (10M) las plantillas no cambian", () => {
    for (const p of PRESET_KEYS) {
      expect(generateRegions(p)).toEqual(generateRegions(p, BALANCE.HEALTH_NETWORK_REFERENCE_POPULATION));
    }
    const total = generateRegions("estable_democratico").reduce((s, r) => s + regionBeds(r as unknown as RegionState), 0);
    expect(total).toBe(3800);
  });

  it("las camas son proporcionales a la población", () => {
    const base = generateRegions("pobre_con_potencial");
    const x5 = generateRegions("pobre_con_potencial", 5 * BALANCE.HEALTH_NETWORK_REFERENCE_POPULATION);
    base.forEach((r, i) => {
      for (const level of ["primary", "secondary", "tertiary"] as const) {
        expect(x5[i].healthCoverage[level].beds).toBe(Math.round(5 * r.healthCoverage[level].beds));
      }
    });
  });

  it("un nivel sin establecimientos sigue en 0 y uno existente nunca baja de 1", () => {
    const small = scaleHealthNetwork(generateRegions("post_conflicto"), 100_000); // 1% de la referencia
    for (const r of small) {
      for (const level of ["primary", "secondary", "tertiary"] as const) {
        const orig = generateRegions("post_conflicto").find((o) => o.name === r.name)!.healthCoverage[level];
        expect(r.healthCoverage[level].facilities).toBe(orig.facilities > 0 ? Math.max(1, Math.round(orig.facilities * 0.01)) : 0);
      }
    }
  });

  it("la saturación inicial no depende de la población del país (red y demanda crecen juntas)", () => {
    for (const p of PRESET_KEYS) {
      const aRef = saturaciones(estado(p, BALANCE.HEALTH_NETWORK_REFERENCE_POPULATION));
      const aPreset = saturaciones(estado(p));
      aRef.forEach((x, i) => expect(aPreset[i]).toBeCloseTo(x, 1));
    }
  });
});

describe("calibración del colapso hospitalario por preset (sickRate ≈ 41%)", () => {
  const T = BALANCE.COLLAPSE_SATURATION_THRESHOLD;

  it("estable_democratico empieza sin ninguna región en colapso", () => {
    expect(Math.max(...saturaciones(estado("estable_democratico")))).toBeLessThan(T);
  });

  it.each(["pobre_con_potencial", "crisis_economica", "post_conflicto"] as const)("%s tiene regiones pobres por encima del umbral", (preset) => {
    expect(Math.max(...saturaciones(estado(preset)))).toBeGreaterThan(T);
  });

  it("las regiones capitales están holgadas en todos los presets", () => {
    for (const p of PRESET_KEYS) {
      const s = estado(p);
      const cap = s.regions.findIndex((r) => r.type === "CAPITAL");
      expect(saturaciones(s)[cap]).toBeLessThan(1);
    }
  });

  it("el orden de dificultad se respeta: más camas por habitante → menos saturación máxima", () => {
    const max = (p: PresetKey) => Math.max(...saturaciones(estado(p)));
    expect(max("estable_democratico")).toBeLessThan(max("crisis_economica"));
    expect(max("crisis_economica")).toBeLessThan(max("post_conflicto"));
  });

  it("detectHospitalCollapse: estable no dispara nada en 12 meses; post_conflicto sí tras 3 meses seguidos", () => {
    const corre = (preset: PresetKey, meses: number) => {
      const s = estado(preset);
      const rng = createRNG("colapso");
      const eventos: string[] = [];
      for (let m = 1; m <= meses; m++) { s.currentMonth = m; eventos.push(...detectHospitalCollapse(s, rng).map((e) => e.type)); }
      return eventos;
    };
    expect(corre("estable_democratico", 12)).toEqual([]);
    expect(corre("post_conflicto", 2)).toEqual([]);          // aún no pasaron 3 meses seguidos
    expect(corre("post_conflicto", 3)).toContain("HOSPITAL_COLLAPSE");
  });

  it("la mortalidad por saturación inicial es casi nula en estable y alta en post_conflicto (ya no está siempre al tope)", () => {
    const m = (p: PresetKey) => calculateNationalSaturationMortality(estado(p));
    expect(m("estable_democratico")).toBeLessThan(0.05);
    expect(m("post_conflicto")).toBeGreaterThan(0.5);
    expect(m("post_conflicto")).toBeLessThan(2); // y por debajo del tope absoluto
  });

  it("construir hospitales alivia la saturación (el jugador tiene una palanca)", () => {
    const s = estado("pobre_con_potencial");
    const rural = s.regions.findIndex((r) => r.type === "RURAL");
    const antes = saturaciones(s)[rural];
    const obra = { type: "HOSPITAL_CONSTRUCTION", parameters: { regionId: s.regions[rural].id, level: "tertiary" } } as unknown as LongRunningDecisionState;
    applyDecisionEffects([obra], s);
    applyDecisionEffects([obra], s);
    expect(saturaciones(s)[rural]).toBeLessThan(antes);
  });
});

describe("las camas de un hospital nuevo escalan con la población", () => {
  const obra = (regionId: string) => ({ type: "HOSPITAL_CONSTRUCTION", parameters: { regionId, level: "primary" } }) as unknown as LongRunningDecisionState;
  const camasTras = (population: number) => {
    const s = estado("estable_democratico", population);
    const antes = regionBeds(s.regions[0]);
    applyDecisionEffects([obra(s.regions[0].id)], s);
    return regionBeds(s.regions[0]) - antes;
  };

  it("a 10M añade exactamente HOSPITAL_BEDS_ADDED", () => {
    expect(camasTras(10_000_000)).toBe(BALANCE.HOSPITAL_BEDS_ADDED.primary);
  });

  it("a 40M añade 4 veces más (como su costo)", () => {
    expect(camasTras(40_000_000)).toBe(BALANCE.HOSPITAL_BEDS_ADDED.primary * 4);
  });
});
