// ─── Integridad de siembra de partidas existentes ────────────────────────────
// Cada sesión que agrega entidades por partida (enfermedades, bienes de
// comercio, ...) deja las partidas anteriores sin esos registros. Este módulo
// las repone al cargar la partida, reemplazando los scripts de backfill
// manuales. Para agregar una entidad nueva: sumar un paso a SEED_STEPS y su
// catálogo en seed-catalogs.ts (el mismo que usa la creación de partidas).

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DISEASE_CATALOG, TRADE_GOOD_CATALOG } from "./seed-catalogs";
import { defaultTradeFlowParams } from "./engine/trade";
import { initialEconomy } from "./initial-economy";
import { initialDiseasePrevalence } from "./engine/diseases";

type Tx = Prisma.TransactionClient;

export interface SeedCounts {
  diseases: number;
  tradeGoods: number;
  tradeFlows: number;
}

export interface SeedStep {
  name: string;
  /** Chequeo barato (solo conteos): ¿falta algo de este paso? */
  isMissing(counts: SeedCounts): boolean;
  /** Repone lo faltante. Debe ser idempotente: solo crea lo que no existe. */
  fill(tx: Tx, gameId: string): Promise<void>;
}

async function currentPopulation(tx: Tx, gameId: string): Promise<number> {
  const snapshot = await tx.monthSnapshot.findFirst({
    where: { gameId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { population: true },
  });
  if (snapshot) return snapshot.population;
  const game = await tx.game.findUniqueOrThrow({
    where: { id: gameId },
    select: { preset: true, difficulty: true },
  });
  return initialEconomy(game.preset, game.difficulty).population;
}

const diseasesStep: SeedStep = {
  name: "enfermedades",
  isMissing: (c) => c.diseases < DISEASE_CATALOG.length,
  async fill(tx, gameId) {
    const existing = await tx.disease.findMany({
      where: { gameId },
      select: { name: true },
    });
    const have = new Set(existing.map((d) => d.name));

    await tx.disease.createMany({
      data: DISEASE_CATALOG.filter((d) => !have.has(d.name)).map((d) => ({
        gameId,
        name: d.name,
        category: d.category,
        contagionRate: d.contagionRate,
        mortalityRate: d.mortalityRate,
        prevalence: initialDiseasePrevalence(d),
        prevalenceBase: d.prevalenceBase,
        hasVaccine: d.hasVaccine,
        preventionSensitivity: d.preventionSensitivity,
        monthlyCostPerPatient: d.monthlyCostPerPatient,
        classAffinity: d.classAffinity,
      })),
    });

    const withoutPrevalence = await tx.disease.findMany({
      where: { gameId, prevalences: { none: {} } },
      select: { id: true, category: true, contagionRate: true, prevalenceBase: true, preventionSensitivity: true },
    });
    await tx.diseasePrevalence.createMany({
      data: withoutPrevalence.map((d) => ({
        gameId,
        diseaseId: d.id,
        currentPrevalence: initialDiseasePrevalence(d),
      })),
      skipDuplicates: true,
    });
  },
};

const tradeStep: SeedStep = {
  name: "comercio exterior",
  isMissing: (c) =>
    c.tradeGoods < TRADE_GOOD_CATALOG.length ||
    c.tradeFlows < TRADE_GOOD_CATALOG.length,
  async fill(tx, gameId) {
    await tx.tradeGood.createMany({
      data: TRADE_GOOD_CATALOG.map((good) => ({
        gameId,
        key: good.key,
        category: good.category,
        name: good.name,
        description: good.description,
        baseCostPerUnit: good.baseCostPerUnit,
        unitDescription: good.unitDescription,
        demandPerCapita: good.demandPerCapita,
      })),
      skipDuplicates: true,
    });

    const goodsWithoutFlow = await tx.tradeGood.findMany({
      where: { gameId, flows: { none: {} } },
    });
    if (goodsWithoutFlow.length === 0) return;

    const population = await currentPopulation(tx, gameId);
    const shareByKey = new Map(
      TRADE_GOOD_CATALOG.map((g) => [g.key, g.defaultFlowShare]),
    );
    const flows = goodsWithoutFlow.flatMap((good) => {
      const defaultFlowShare = shareByKey.get(good.key);
      if (defaultFlowShare === undefined) return [];
      const flow = defaultTradeFlowParams(population, { ...good, defaultFlowShare });
      return [
        {
          gameId,
          tradeGoodId: good.id,
          direction: "IMPORT" as const,
          monthlyVolume: flow.volume,
          targetVolume: flow.volume,
          unitCost: flow.unitCost,
          sanctionsMultiplier: 1.0,
          monthlyCost: flow.monthlyCost,
          isActive: true,
        },
      ];
    });
    await tx.tradeFlow.createMany({ data: flows });
  },
};

export const SEED_STEPS: readonly SeedStep[] = [diseasesStep, tradeStep];

async function findMissingSteps(
  db: Pick<Tx, "game">,
  gameId: string,
): Promise<SeedStep[]> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: {
      _count: { select: { diseases: true, tradeGoods: true, tradeFlows: true } },
    },
  });
  if (!game) return [];
  return SEED_STEPS.filter((step) => step.isMissing(game._count));
}

/**
 * Repone las entidades de siembra que falten en una partida existente.
 * Idempotente y seguro ante cargas concurrentes (advisory lock por partida).
 * Nunca lanza: si la reparación falla se registra el error y la partida
 * sigue cargando (el motor tiene fallbacks para datos faltantes).
 *
 * @returns nombres de los pasos que repuso (vacío si estaba íntegra)
 */
export async function ensureSeedIntegrity(
  prisma: PrismaClient,
  gameId: string,
): Promise<string[]> {
  try {
    if ((await findMissingSteps(prisma, gameId)).length === 0) return [];

    const repaired = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${gameId}))`;
        // Re-chequear dentro del lock: otra carga concurrente pudo repararla.
        const steps = await findMissingSteps(tx, gameId);
        for (const step of steps) await step.fill(tx, gameId);
        return steps.map((s) => s.name);
      },
      { timeout: 30_000 },
    );

    if (repaired.length > 0) {
      console.info(
        `[seed-integrity] partida ${gameId}: repuesto ${repaired.join(", ")}`,
      );
    }
    return repaired;
  } catch (error) {
    console.error(`[seed-integrity] no se pudo reparar la partida ${gameId}:`, error);
    return [];
  }
}
