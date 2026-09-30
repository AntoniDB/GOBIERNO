// @ts-nocheck — Capa de persistencia: crea partida completa.
"use server";

import type { PrismaClient } from "@/generated/prisma/client";
import type { PresetKey, Difficulty } from "@/lib/game-factory";
import { DISEASE_CATALOG, TRADE_GOOD_CATALOG } from "@/lib/seed-catalogs";
import { defaultTradeFlowParams } from "@/lib/engine/trade";
import {
  generateSeed,
  getPresetConfig,
  generateParties,
  generateOfficials,
  generateMinistries,
  generateSocialClasses,
  generateMedia,
  generateRegions,
  nombreAleatorio,
  LAW_CATALOG,
} from "@/lib/game-factory";

export async function createInitialGame(
  prismaClient: PrismaClient,
  params: {
    countryName: string;
    preset: PresetKey;
    difficulty: Difficulty;
    userId: string;
  },
  crypto: typeof import("crypto")
) {
  const cfg = getPresetConfig(params.preset, params.difficulty);
  const seed = generateSeed();

  // ── Crear partida ──────────────────────────────────────────────────────
  const game = await prismaClient.game.create({
    data: {
      userId: params.userId,
      countryName: params.countryName,
      currentYear: 1,
      currentMonth: 0,
      status: "ACTIVE",
      seed,
      preset: params.preset,
      difficulty: params.difficulty,
      treasury: cfg.treasury,
      population: cfg.population,
    },
  });

  const gameId = game.id;

  // ── Partidos ───────────────────────────────────────────────────────────
  const partyData = generateParties();
  const parties = [];
  for (const p of partyData) {
    const party = await prismaClient.party.create({
      data: { gameId, name: p.name, ideology: p.ideology, popularity: p.popularity, seatsLower: p.seatsLower, seatsUpper: p.seatsUpper },
    });
    parties.push(party);
  }

  // ── Funcionarios ──────────────────────────────────────────────────────
  const officialData = generateOfficials(cfg.initialCorruption);
  const officials = [];
  for (const o of officialData) {
    const off = await prismaClient.official.create({
      data: {
        gameId, name: o.name, role: o.role,
        ideology: o.ideology,
        loyalty: o.loyalty, ambition: o.ambition, wealth: o.wealth,
        corruption: o.corruption, skill: o.skill, reputation: o.reputation,
        partyId: o.partyId !== undefined ? parties[o.partyId]?.id : null,
        specialty: (o as Record<string, unknown>).specialty as string ?? null,
      },
    });
    officials.push(off);
  }

  // ── Lideres de partido ────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const lider = await prismaClient.official.create({
      data: {
        gameId, name: nombreAleatorio(20 + i), role: "POLITICAL_LEADER", partyId: parties[i].id,
        ideology: partyData[i].ideology,
        loyalty: 75 + Math.floor(Math.random() * 20),
        ambition: 35 + Math.floor(Math.random() * 30),
        wealth: 120000 + Math.floor(Math.random() * 200000),
        corruption: Math.min(100, Math.max(1, Math.round(cfg.initialCorruption * 0.7))),
        skill: 60 + Math.floor(Math.random() * 20),
        reputation: 50 + Math.floor(Math.random() * 20),
      },
    });
    await prismaClient.party.update({
      where: { id: parties[i].id },
      data: { leaderOfficialId: lider.id },
    });
  }

  // ── Ministerios ───────────────────────────────────────────────────────
  const ministryData = generateMinistries();
  for (let i = 0; i < ministryData.length; i++) {
    const m = ministryData[i];
    await prismaClient.ministry.create({
      data: {
        gameId, key: m.key, budgetPercent: m.budgetPercent,
        ministerOfficialId: officials[i].id,
        subDecisions: m.subDecisions,
        efficiency: 55, internalCorruption: Math.round(cfg.initialCorruption * 0.8),
      },
    });
  }

  // Vincular directores del Ministerio de Salud (MINISTRY_DIRECTOR, indices 15-17)
  const healthMinistry = await prismaClient.ministry.findFirst({
    where: { gameId, key: "HEALTH" },
  });
  if (healthMinistry) {
    for (let d = 15; d <= 17; d++) {
      if (officials[d]) {
        await prismaClient.official.update({
          where: { id: officials[d].id },
          data: { ministryId: healthMinistry.id },
        });
      }
    }
  }

  // ── Regiones ──────────────────────────────────────────────────────────
  const regionData = generateRegions(params.preset);
  for (const r of regionData) {
    await prismaClient.region.create({
      data: {
        gameId,
        name: r.name,
        type: r.type,
        populationPercent: r.populationPercent,
        povertyRate: r.povertyRate,
        infrastructureLevel: r.infrastructureLevel,
        accessModifier: r.accessModifier,
        povertyModifier: r.povertyModifier,
        healthCoverage: r.healthCoverage as Record<string, unknown>,
      },
    });
  }

  // ── Contraloria General ───────────────────────────────────────────────
  const contralor = await prismaClient.official.create({
    data: {
      gameId, name: nombreAleatorio(25), role: "COMPTROLLER",
      ideology: { economic: 0, social: 20, authority: 0 },
      loyalty: 60, ambition: 20, wealth: 60000,
      corruption: Math.min(100, Math.max(1, Math.round(cfg.initialCorruption * 0.3))),
      skill: 75, reputation: 70,
    },
  });
  await prismaClient.organism.create({
    data: {
      gameId, type: "COMPTROLLER",
      name: "Contraloria General de la Republica",
      monthlyBudget: 150000000, staff: 30, effectiveness: 40,
      autonomyLevel: cfg.regimeMetrics.transparency > 50 ? 70 : 40,
      headOfficialId: contralor.id,
    },
  });

  // ── Senadores ─────────────────────────────────────────────────────────
  const distEscaños = [5, 6, 3, 2, 2];
  const distAlta = [2, 2, 1, 0, 0];
  let senIdx = 0;
  for (let p = 0; p < 5; p++) {
    for (let s = 0; s < distEscaños[p]; s++) {
      await prismaClient.senator.create({
        data: {
          gameId, partyId: parties[p].id, name: nombreAleatorio(30 + senIdx),
          personalIdeology: partyData[p].ideology,
          chamber: "LOWER", loyalty: 50 + Math.floor(Math.random() * 40),
        },
      });
      senIdx++;
    }
    for (let s = 0; s < distAlta[p]; s++) {
      await prismaClient.senator.create({
        data: {
          gameId, partyId: parties[p].id, name: nombreAleatorio(50 + senIdx),
          personalIdeology: partyData[p].ideology,
          chamber: "UPPER", loyalty: 55 + Math.floor(Math.random() * 35),
        },
      });
      senIdx++;
    }
  }

  // ── Catalogo de enfermedades ──────────────────────────────────────────
  for (const d of DISEASE_CATALOG) {
    const disease = await prismaClient.disease.create({
      data: {
        gameId,
        name: d.name,
        category: d.category,
        contagionRate: d.contagionRate,
        mortalityRate: d.mortalityRate,
        prevalence: 0,
        prevalenceBase: d.prevalenceBase,
        hasVaccine: d.hasVaccine,
        preventionSensitivity: d.preventionSensitivity,
        monthlyCostPerPatient: d.monthlyCostPerPatient,
        classAffinity: d.classAffinity as Record<string, unknown>,
      },
    });
    // Crear DiseasePrevalence inicial con 0
    await prismaClient.diseasePrevalence.create({
      data: {
        gameId,
        diseaseId: disease.id,
        currentPrevalence: 0,
      },
    });
  }

  // ── Catalogo de leyes ─────────────────────────────────────────────────
  // Leyes son globales (sin gameId). La seed ya las crea; creamos solo si faltan.
  for (const ley of LAW_CATALOG) {
    try {
      await prismaClient.lawCatalog.create({ data: ley });
    } catch {
      // Ya existe (unique constraint), ignorar
    }
  }

  // ── Clases sociales ───────────────────────────────────────────────────
  const socialClassData = generateSocialClasses(cfg);
  for (const c of socialClassData) {
    await prismaClient.socialClass.create({ data: { gameId, ...c } });
  }

  // ── Medios ────────────────────────────────────────────────────────────
  const mediaData = generateMedia();
  for (const m of mediaData) {
    await prismaClient.media.create({ data: { gameId, ...m } });
  }

  // ── Metricas de regimen iniciales ─────────────────────────────────────
  await prismaClient.regimeMetrics.create({
    data: { gameId, ...cfg.regimeMetrics },
  });

  // Snapshot inicial eliminado intencionalmente (año 1 mes 0 = currentMonth 0 rompía idempotencia).
  // El primer advanceMonth crea el snapshot del mes 0 como parte del flujo normal.

  // ── Bienes comerciables y flujos iniciales (Salud-3B-i) ──────────────
  for (const good of TRADE_GOOD_CATALOG) {
    const tradeGood = await prismaClient.tradeGood.create({
      data: {
        gameId,
        key: good.key,
        category: good.category,
        name: good.name,
        description: good.description,
        baseCostPerUnit: good.baseCostPerUnit,
        unitDescription: good.unitDescription,
        demandPerCapita: good.demandPerCapita,
      },
    });

    // Flujo por defecto: mix de importación del catalogo (70% genericos / 30% marca)
    const flow = defaultTradeFlowParams(cfg.population, good);
    await prismaClient.tradeFlow.create({
      data: {
        gameId,
        tradeGoodId: tradeGood.id,
        direction: "IMPORT",
        monthlyVolume: flow.volume,
        targetVolume: flow.volume,
        unitCost: flow.unitCost,
        sanctionsMultiplier: 1.0,
        monthlyCost: flow.monthlyCost,
        isActive: true,
      },
    });
  }

  return gameId;
}

/**
 * Crea una partida completa usando la fabrica de juegos.
 * Server Action exportada para el wizard de nueva partida.
 */
export async function crearPartidaAction(
  params: {
    countryName: string;
    preset: PresetKey;
    difficulty: Difficulty;
  },
  userId: string
): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const crypto = await import("crypto");
  return createInitialGame(prisma, { ...params, userId }, crypto);
}
