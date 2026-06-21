// @ts-nocheck — Capa de persistencia: crea partida completa.
"use server";

import type { PrismaClient } from "@/generated/prisma/client";
import type { PresetKey, Difficulty } from "@/lib/game-factory";
import {
  generateSeed,
  getPresetConfig,
  generateParties,
  generateOfficials,
  generateMinistries,
  generateSocialClasses,
  generateMedia,
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

  // ── Snapshot inicial ──────────────────────────────────────────────────
  const approvalAvg = socialClassData.reduce(
    (sum, sc) => sum + sc.approval * (sc.populationPercent / 100), 0
  );
  await prismaClient.monthSnapshot.create({
    data: {
      gameId, year: 1, month: 0,
      treasury: cfg.treasury,
      gdp: cfg.gdpBase,
      population: cfg.population,
      approval: approvalAvg,
      corruption: cfg.initialCorruption,
      povertyRate: cfg.povertyRate,
      unemploymentRate: cfg.unemploymentRate,
      sickRate: 3,
      crimeRate: cfg.regimeMetrics.militarySubordination < 40 ? 12 : 7,
      foodSecurity: cfg.povertyRate < 20 ? 85 : 60,
      educationLevel: cfg.regimeMetrics.civilLiberties > 60 ? 62 : 45,
      inflation: cfg.inflation,
      gini: cfg.gini,
      regimeType: cfg.regimeMetrics.pressFreedom > 70 && cfg.regimeMetrics.judicialIndependence > 60 ? "Democracia plena" : cfg.regimeMetrics.powerConcentration > 50 ? "Autoritarismo electoral" : "Democracia defectuosa",
      regimeMetrics: cfg.regimeMetrics,
    },
  });

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
