import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DISEASE_CATALOG, TRADE_GOOD_CATALOG } from "@/lib/seed-catalogs";
import { defaultTradeFlowParams, createDefaultTradeGoods } from "@/lib/engine/trade";
import { ensureSeedIntegrity, type SeedCounts } from "@/lib/seed-integrity";

// ──────────────────────────────────────────────────────────────────────────────
//  Catálogos y helper puro
// ──────────────────────────────────────────────────────────────────────────────

describe("catálogos de siembra", () => {
  it("tiene 14 enfermedades con nombres únicos", () => {
    expect(DISEASE_CATALOG).toHaveLength(14);
    expect(new Set(DISEASE_CATALOG.map((d) => d.name)).size).toBe(14);
  });

  it("los bienes tienen claves únicas y el mix de flujos suma 100%", () => {
    expect(new Set(TRADE_GOOD_CATALOG.map((g) => g.key)).size).toBe(
      TRADE_GOOD_CATALOG.length,
    );
    const total = TRADE_GOOD_CATALOG.reduce((s, g) => s + g.defaultFlowShare, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("createDefaultTradeGoods deriva del catálogo", () => {
    const goods = createDefaultTradeGoods(1, "g");
    expect(goods.map((g) => g.key)).toEqual(TRADE_GOOD_CATALOG.map((g) => g.key));
  });
});

describe("defaultTradeFlowParams", () => {
  it("reproduce la fórmula de la siembra original (ceil(ceil(pop*dpc)*share))", () => {
    const pop = 10_000_000;
    const demandBase = Math.ceil(pop * 0.00001);
    const [generic, brand] = TRADE_GOOD_CATALOG;

    const g = defaultTradeFlowParams(pop, generic);
    expect(g.volume).toBe(Math.ceil(demandBase * 0.7));
    expect(g.unitCost).toBe(50);
    expect(g.monthlyCost).toBe(g.volume * 50);

    const b = defaultTradeFlowParams(pop, brand);
    expect(b.volume).toBe(Math.ceil(demandBase * 0.3));
    expect(b.unitCost).toBe(200);
    expect(b.monthlyCost).toBe(b.volume * 200);
  });

  it("escala con la población", () => {
    const [generic] = TRADE_GOOD_CATALOG;
    expect(defaultTradeFlowParams(80_000_000, generic).volume).toBeGreaterThan(
      defaultTradeFlowParams(10_000_000, generic).volume,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
//  ensureSeedIntegrity (Prisma simulado)
// ──────────────────────────────────────────────────────────────────────────────

const FULL: SeedCounts = {
  diseases: DISEASE_CATALOG.length,
  tradeGoods: TRADE_GOOD_CATALOG.length,
  tradeFlows: TRADE_GOOD_CATALOG.length,
};
const EMPTY: SeedCounts = { diseases: 0, tradeGoods: 0, tradeFlows: 0 };

type Rows = Record<string, unknown>[];
const createManyMock = () =>
  vi.fn<(args: { data: Rows; skipDuplicates?: boolean }) => Promise<{ count: number }>>(
    async () => ({ count: 0 }),
  );

interface FakeOpts {
  outer: SeedCounts;
  inner?: SeedCounts;
  existingDiseaseNames?: string[];
  population?: number;
}

function fakePrisma(opts: FakeOpts) {
  const existing = (opts.existingDiseaseNames ?? []).map((name) => ({ name }));
  const goods = TRADE_GOOD_CATALOG.map((g, i) => ({
    id: `good-${i}`,
    gameId: "g1",
    ...g,
  }));

  const tx = {
    game: {
      findUnique: vi.fn(async () => ({ _count: opts.inner ?? opts.outer })),
      findUniqueOrThrow: vi.fn(async () => ({ population: 10_000_000 })),
    },
    $executeRaw: vi.fn(async () => 0),
    disease: {
      findMany: vi.fn(async (args: { where: { prevalences?: unknown } }) =>
        args.where.prevalences ? [{ id: "d-1" }, { id: "d-2" }] : existing,
      ),
      createMany: createManyMock(),
    },
    diseasePrevalence: { createMany: createManyMock() },
    tradeGood: {
      createMany: createManyMock(),
      findMany: vi.fn(async () => goods),
    },
    tradeFlow: { createMany: createManyMock() },
    monthSnapshot: {
      findFirst: vi.fn(async () =>
        opts.population ? { population: opts.population } : null,
      ),
    },
  };

  const prisma = {
    game: {
      findUnique: vi.fn(async () => ({ _count: opts.outer })),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };

  return { prisma: prisma as never, rawPrisma: prisma, tx };
}

describe("ensureSeedIntegrity", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no hace nada (ni abre transacción) si la partida está íntegra", async () => {
    const { prisma, rawPrisma } = fakePrisma({ outer: FULL });
    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual([]);
    expect(rawPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("repone enfermedades y comercio en una partida vacía", async () => {
    const { prisma, tx } = fakePrisma({ outer: EMPTY, population: 20_000_000 });

    const repaired = await ensureSeedIntegrity(prisma, "g1");

    expect(repaired).toEqual(["enfermedades", "comercio exterior"]);
    expect(tx.disease.createMany.mock.calls[0][0].data).toHaveLength(14);
    expect(tx.diseasePrevalence.createMany.mock.calls[0][0].data).toEqual([
      { gameId: "g1", diseaseId: "d-1", currentPrevalence: 0 },
      { gameId: "g1", diseaseId: "d-2", currentPrevalence: 0 },
    ]);

    const flows = tx.tradeFlow.createMany.mock.calls[0][0].data;
    expect(flows).toHaveLength(TRADE_GOOD_CATALOG.length);
    expect(flows[0].monthlyVolume).toBe(
      defaultTradeFlowParams(20_000_000, TRADE_GOOD_CATALOG[0]).volume,
    );
    expect(flows.every((f) => f.direction === "IMPORT")).toBe(true);
  });

  it("solo crea las enfermedades que faltan por nombre", async () => {
    const have = DISEASE_CATALOG.slice(0, 10).map((d) => d.name);
    const { prisma, tx } = fakePrisma({
      outer: { ...FULL, diseases: 10 },
      existingDiseaseNames: have,
    });

    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual(["enfermedades"]);

    const created = tx.disease.createMany.mock.calls[0][0].data.map((d) => d.name);
    expect(created).toEqual(DISEASE_CATALOG.slice(10).map((d) => d.name));
    expect(tx.tradeGood.createMany).not.toHaveBeenCalled();
  });

  it("toma el lock antes de escribir", async () => {
    const { prisma, tx } = fakePrisma({ outer: EMPTY });
    await ensureSeedIntegrity(prisma, "g1");
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.disease.createMany.mock.invocationCallOrder[0],
    );
  });

  it("re-chequea dentro del lock y no duplica si otra carga ya reparó", async () => {
    const { prisma, tx } = fakePrisma({ outer: EMPTY, inner: FULL });
    expect(await ensureSeedIntegrity(prisma, "g1")).toEqual([]);
    expect(tx.disease.createMany).not.toHaveBeenCalled();
    expect(tx.tradeFlow.createMany).not.toHaveBeenCalled();
  });

  it("no lanza si la reparación falla: registra el error y devuelve []", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { prisma, rawPrisma } = fakePrisma({ outer: EMPTY });
    rawPrisma.$transaction.mockRejectedValueOnce(new Error("db caída"));

    await expect(ensureSeedIntegrity(prisma, "g1")).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });
});
