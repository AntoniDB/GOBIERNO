import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DISEASE_CATALOG, TRADE_GOOD_CATALOG } from "@/lib/seed-catalogs";
import { ensureSeedIntegrity, SEED_VERSION } from "@/lib/seed-integrity";
import { generateRegions, getPresetConfig } from "@/lib/game-factory";
import { diseaseTargetPrevalence } from "@/lib/engine/diseases";

// Migraciones de datos versionadas (Game.seedVersion): red hospitalaria escalada (Issue 5) y
// prevalencias en equilibrio (Issue 11) para partidas creadas con las reglas antiguas.

const PRESET = "estable_democratico" as const;
const POP = getPresetConfig(PRESET, "normal").population; // 50M → factor 5
const FACTOR = POP / 10_000_000;

type Cov = ReturnType<typeof generateRegions>[number]["healthCoverage"];
interface RegionRow { id: string; healthCoverage: Cov }
interface PrevRow { id: string; diseaseId: string; currentPrevalence: number }

interface Opts {
  seedVersion?: number;
  /** Camas de las regiones en la BD (por defecto, la plantilla sin escalar) */
  regions?: RegionRow[];
  prevalence?: (diseaseName: string) => number;
  healthEfficiency?: number | null;
  programs?: { type: string; parameters: Record<string, unknown> }[];
}

function fake(opts: Opts = {}) {
  const seedVersion = opts.seedVersion ?? 0;
  const regions: RegionRow[] = opts.regions ?? generateRegions(PRESET).map((r, i) => ({ id: `r${i}`, healthCoverage: r.healthCoverage }));
  const diseases = DISEASE_CATALOG.map((d, i) => ({ id: `d${i}`, ...d }));
  const prevalences: PrevRow[] = diseases.map((d, i) => ({
    id: `p${i}`, diseaseId: d.id, currentPrevalence: opts.prevalence ? opts.prevalence(d.name) : 0,
  }));
  const counts = { diseases: DISEASE_CATALOG.length, tradeGoods: TRADE_GOOD_CATALOG.length, tradeFlows: TRADE_GOOD_CATALOG.length };

  const tx = {
    game: {
      findUnique: vi.fn(async () => ({ seedVersion, _count: counts })),
      findUniqueOrThrow: vi.fn(async () => ({ preset: PRESET, difficulty: "normal" })),
      update: vi.fn(async () => ({})),
    },
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => 0),
    region: {
      findMany: vi.fn(async () => regions),
      update: vi.fn(async (args: { where: { id: string }; data: { healthCoverage: Cov } }) => {
        regions.find((r) => r.id === args.where.id)!.healthCoverage = args.data.healthCoverage;
      }),
    },
    disease: { findMany: vi.fn(async () => diseases) },
    diseasePrevalence: {
      findMany: vi.fn(async () => prevalences),
      update: vi.fn(async (args: { where: { id: string }; data: { currentPrevalence: number } }) => {
        prevalences.find((p) => p.id === args.where.id)!.currentPrevalence = args.data.currentPrevalence;
      }),
    },
    ministry: {
      findFirst: vi.fn(async () => (opts.healthEfficiency === null ? null : { efficiency: opts.healthEfficiency ?? 70 })),
    },
    ministryProgram: { findMany: vi.fn(async () => opts.programs ?? []) },
  };
  const prisma = {
    game: { findUnique: vi.fn(async () => ({ seedVersion, _count: counts })) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma: prisma as never, tx, regions, prevalences, diseases };
}

const beds = (hc: Cov) => hc.primary.beds + hc.secondary.beds + hc.tertiary.beds;

describe("migración de datos de siembra (Game.seedVersion)", () => {
  beforeEach(() => { vi.spyOn(console, "info").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("una partida sin migrar ejecuta los pasos y queda marcada con SEED_VERSION", async () => {
    const { prisma, tx } = fake();
    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual([
      "red hospitalaria escalada", "prevalencias en equilibrio", "habilidad de funcionarios", "versión de siembra",
    ]);
    expect(tx.game.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { seedVersion: SEED_VERSION } });
  });

  it("una partida en v1 solo ejecuta la migración nueva (no vuelve a escalar ni a mover prevalencias)", async () => {
    const { prisma, tx } = fake({ seedVersion: 1 });
    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual(["habilidad de funcionarios", "versión de siembra"]);
    expect(tx.region.update).not.toHaveBeenCalled();
    expect(tx.diseasePrevalence.update).not.toHaveBeenCalled();
    const repair = tx.$executeRaw.mock.calls.map(([strings]) => Array.from(strings).join("?")).find((t) => t.includes('"Official"'));
    expect(repair).toContain(`"skill" = 50`);
    expect(repair).toContain(`"skill" = 'NaN'::float8`); // solo toca los NaN
  });

  it("una partida ya migrada no escribe nada (idempotente)", async () => {
    const { prisma, tx } = fake({ seedVersion: SEED_VERSION });
    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual([]);
    expect(tx.region.update).not.toHaveBeenCalled();
    expect(tx.diseasePrevalence.update).not.toHaveBeenCalled();
    expect(tx.game.update).not.toHaveBeenCalled();
  });

  describe("red hospitalaria", () => {
    it("escala camas, establecimientos y costo por población / referencia", async () => {
      const { prisma, regions } = fake();
      await ensureSeedIntegrity(prisma, "g1");
      const esperado = generateRegions(PRESET, POP);
      regions.forEach((r, i) => expect(r.healthCoverage).toEqual(esperado[i].healthCoverage));
      expect(beds(regions[0].healthCoverage)).toBe(beds(generateRegions(PRESET)[0].healthCoverage) * FACTOR);
    });

    it("conserva las camas construidas antes de migrar (también se escalan)", async () => {
      const base = generateRegions(PRESET).map((r, i) => ({ id: `r${i}`, healthCoverage: structuredClone(r.healthCoverage) }));
      base[0].healthCoverage.primary.beds += 100; // un hospital construido sin escalar
      const { prisma, regions } = fake({ regions: base });
      await ensureSeedIntegrity(prisma, "g1");
      expect(regions[0].healthCoverage.primary.beds).toBe(Math.round((generateRegions(PRESET)[0].healthCoverage.primary.beds + 100) * FACTOR));
    });

    it("no vuelve a escalar una red que ya está escalada (partida creada con el Issue 5 pero sin versión)", async () => {
      const yaEscalada = generateRegions(PRESET, POP).map((r, i) => ({ id: `r${i}`, healthCoverage: structuredClone(r.healthCoverage) }));
      const antes = structuredClone(yaEscalada);
      const { prisma, tx, regions } = fake({ regions: yaEscalada });
      await ensureSeedIntegrity(prisma, "g1");
      expect(tx.region.update).not.toHaveBeenCalled();
      expect(regions).toEqual(antes);
    });
  });

  describe("prevalencias", () => {
    it("las sembradas en 0 suben a su equilibrio con la eficiencia actual de Salud", async () => {
      const { prisma, prevalences, diseases } = fake({ healthEfficiency: 70 });
      await ensureSeedIntegrity(prisma, "g1");
      diseases.forEach((d, i) => {
        expect(prevalences[i].currentPrevalence).toBeCloseTo(diseaseTargetPrevalence(d, 70), 2);
        expect(prevalences[i].currentPrevalence).toBeGreaterThan(0);
      });
    });

    it("usa la eficiencia sembrada si no hay ministerio de Salud", async () => {
      const { prisma, prevalences, diseases } = fake({ healthEfficiency: null });
      await ensureSeedIntegrity(prisma, "g1");
      expect(prevalences[0].currentPrevalence).toBeCloseTo(diseaseTargetPrevalence(diseases[0], 55), 2);
    });

    it("las que ya están por encima del equilibrio no se tocan (bajan solas con el tiempo)", async () => {
      const { prisma, prevalences, tx } = fake({ prevalence: (n) => (n === "Hipertension" ? 14 : 0) });
      await ensureSeedIntegrity(prisma, "g1");
      const i = DISEASE_CATALOG.findIndex((d) => d.name === "Hipertension");
      expect(prevalences[i].currentPrevalence).toBe(14);
      expect(tx.diseasePrevalence.update).toHaveBeenCalledTimes(DISEASE_CATALOG.length - 1);
    });

    it("las cubiertas por un programa activo conservan el efecto de la campaña", async () => {
      const gripeIdx = DISEASE_CATALOG.findIndex((d) => d.name === "Gripe estacional");
      const { prisma, prevalences, diseases } = fake({
        prevalence: (n) => (n === "Gripe estacional" ? 0.5 : 0),
        programs: [
          { type: "VACCINATION_CAMPAIGN", parameters: { diseaseId: `d${gripeIdx}` } },
          { type: "MENTAL_HEALTH_PROGRAM", parameters: {} },
        ],
      });
      await ensureSeedIntegrity(prisma, "g1");
      expect(prevalences[gripeIdx].currentPrevalence).toBe(0.5); // campaña activa: no se sube
      diseases.forEach((d, i) => {
        if (d.category === "MENTAL_HEALTH") expect(prevalences[i].currentPrevalence).toBe(0); // programa mental
        else if (i !== gripeIdx) expect(prevalences[i].currentPrevalence).toBeGreaterThan(0);
      });
    });

    it("un programa de prevención cubre transmisibles y crónicas, no las mentales", async () => {
      const { prisma, prevalences, diseases } = fake({ programs: [{ type: "PREVENTION_EDUCATION", parameters: {} }] });
      await ensureSeedIntegrity(prisma, "g1");
      diseases.forEach((d, i) => {
        if (d.category === "MENTAL_HEALTH") expect(prevalences[i].currentPrevalence).toBeGreaterThan(0);
        else expect(prevalences[i].currentPrevalence).toBe(0);
      });
    });
  });

  it("toma el lock y re-chequea dentro: si otra carga ya migró no hace nada", async () => {
    const inner = fake({ seedVersion: SEED_VERSION });
    const outerPrisma = {
      game: { findUnique: vi.fn(async () => ({ seedVersion: 0, _count: { diseases: 14, tradeGoods: TRADE_GOOD_CATALOG.length, tradeFlows: TRADE_GOOD_CATALOG.length } })) },
      $transaction: vi.fn(async (fn: (t: typeof inner.tx) => unknown) => fn(inner.tx)),
    };
    expect(await ensureSeedIntegrity(outerPrisma as never, "g1")).toEqual([]);
    expect(inner.tx.$executeRaw).toHaveBeenCalled();
    expect(inner.tx.region.update).not.toHaveBeenCalled();
  });
});
