// ─── Integridad de siembra de partidas existentes ────────────────────────────
// Cada sesión que agrega entidades por partida (enfermedades, bienes de
// comercio, ...) deja las partidas anteriores sin esos registros. Este módulo
// las repone al cargar la partida, reemplazando los scripts de backfill
// manuales. Para agregar una entidad nueva: sumar un paso a SEED_STEPS y su
// catálogo en seed-catalogs.ts (el mismo que usa la creación de partidas).
//
// Además hay migraciones de DATOS (corregir valores sembrados con reglas antiguas), que
// no se pueden detectar por conteos: se versionan con Game.seedVersion. Las partidas
// nuevas nacen con SEED_VERSION; a las anteriores se les aplica cada paso una sola vez.
// Para añadir una: subir SEED_VERSION, sumar un paso con `isMissing: c.seedVersion < N`.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DISEASE_CATALOG, TRADE_GOOD_CATALOG } from "./seed-catalogs";
import { defaultTradeFlowParams } from "./engine/trade";
import { initialEconomy } from "./initial-economy";
import { costScaleFactor } from "./engine/cost-scale";
import { diseaseTargetPrevalence, migratedDiseasePrevalence } from "./engine/diseases";
import { isDiseaseCovered } from "./engine/programs";
import { generateRegions, scaleHealthCoverage } from "./game-factory";
import type { PresetKey, RegionData } from "./game-factory";
import { BALANCE } from "./balance";

/**
 * Versión actual de las migraciones de datos de siembra.
 *  1 — red hospitalaria escalada por población (Issue 5) y prevalencias en equilibrio (Issue 11)
 */
export const SEED_VERSION = 1;
import { initialDiseasePrevalence } from "./engine/diseases";

type Tx = Prisma.TransactionClient;

export interface SeedCounts {
  diseases: number;
  tradeGoods: number;
  tradeFlows: number;
  seedVersion: number;
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

type Coverage = RegionData["healthCoverage"];
const totalBeds = (hc: Coverage) => hc.primary.beds + hc.secondary.beds + hc.tertiary.beds;

/** v1 (Issue 5): las camas de los presets no escalaban con la población del país. */
const healthNetworkStep: SeedStep = {
  name: "red hospitalaria escalada",
  isMissing: (c) => c.seedVersion < 1,
  async fill(tx, gameId) {
    const game = await tx.game.findUniqueOrThrow({
      where: { id: gameId },
      select: { preset: true, difficulty: true },
    });
    const population = initialEconomy(game.preset, game.difficulty).population;
    const factor = costScaleFactor(population, BALANCE.HEALTH_NETWORK_REFERENCE_POPULATION);
    if (factor === 1) return;

    const regions = await tx.region.findMany({ where: { gameId }, select: { id: true, healthCoverage: true } });
    // Defensa: una partida creada con el código del Issue 5 pero sin versión ya tiene la red escalada
    // (≈ factor × plantilla): no se escala dos veces. Una sin escalar solo suma las camas construidas.
    const template = generateRegions(game.preset as PresetKey).reduce((sum, r) => sum + totalBeds(r.healthCoverage), 0);
    const current = regions.reduce((sum, r) => sum + totalBeds(r.healthCoverage as Coverage), 0);
    if (current >= template * (1 + factor) / 2) return;

    for (const region of regions) {
      await tx.region.update({
        where: { id: region.id },
        data: { healthCoverage: scaleHealthCoverage(region.healthCoverage as Coverage, factor) },
      });
    }
  },
};

/** v1 (Issue 11): las prevalencias se sembraban en 0 y subían durante años hacia su equilibrio. */
const diseasePrevalenceStep: SeedStep = {
  name: "prevalencias en equilibrio",
  isMissing: (c) => c.seedVersion < 1,
  async fill(tx, gameId) {
    const [diseases, prevalences, health, programs] = await Promise.all([
      tx.disease.findMany({
        where: { gameId },
        select: { id: true, category: true, contagionRate: true, prevalenceBase: true, preventionSensitivity: true, hasVaccine: true },
      }),
      tx.diseasePrevalence.findMany({ where: { gameId }, select: { id: true, diseaseId: true, currentPrevalence: true } }),
      tx.ministry.findFirst({ where: { gameId, key: "HEALTH" }, select: { efficiency: true } }),
      tx.ministryProgram.findMany({ where: { gameId, status: "ACTIVE" }, select: { type: true, parameters: true } }),
    ]);
    const efficiency = health?.efficiency ?? BALANCE.DISEASE_SEED_HEALTH_EFFICIENCY;
    const activePrograms = programs.map((p) => ({
      type: p.type,
      parameters: (p.parameters ?? {}) as Record<string, unknown>,
    }));
    const byId = new Map(diseases.map((d) => [d.id, d]));

    for (const prevalence of prevalences) {
      const disease = byId.get(prevalence.diseaseId);
      if (!disease) continue;
      const target = diseaseTargetPrevalence(disease, efficiency);
      const covered = isDiseaseCovered(disease, activePrograms);
      const next = migratedDiseasePrevalence(prevalence.currentPrevalence, target, covered);
      if (next !== prevalence.currentPrevalence) {
        await tx.diseasePrevalence.update({ where: { id: prevalence.id }, data: { currentPrevalence: next } });
      }
    }
  },
};

/** Siempre el último: marca la partida como migrada a SEED_VERSION. */
const seedVersionStep: SeedStep = {
  name: "versión de siembra",
  isMissing: (c) => c.seedVersion < SEED_VERSION,
  async fill(tx, gameId) {
    await tx.game.update({ where: { id: gameId }, data: { seedVersion: SEED_VERSION } });
  },
};

export const SEED_STEPS: readonly SeedStep[] = [
  diseasesStep,
  tradeStep,
  healthNetworkStep,
  diseasePrevalenceStep,
  seedVersionStep,
];

async function findMissingSteps(
  db: Pick<Tx, "game">,
  gameId: string,
): Promise<SeedStep[]> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: {
      seedVersion: true,
      _count: { select: { diseases: true, tradeGoods: true, tradeFlows: true } },
    },
  });
  if (!game) return [];
  return SEED_STEPS.filter((step) => step.isMissing({ ...game._count, seedVersion: game.seedVersion }));
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
