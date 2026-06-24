// @ts-nocheck — Capa de persistencia: mapeo entre tipos planos del motor y Prisma 7.
// Los tipos estrictos de JSON/enums de Prisma 7 son incompatibles con objetos planos.
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type {
  GameState,
  RegimeMetricsState,
  MonthSnapshotData,
  LawCatalogEntry,
  Ideology,
} from "@/lib/engine/types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_TREASURY = 1_000_000_000;
const DEFAULT_POPULATION = 10_000_000;

// ─── Utilidades ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asIdeology(raw: any): Ideology {
  const obj = raw as Record<string, unknown> | null | undefined;
  return {
    economic: (obj?.economic as number) ?? 0,
    social: (obj?.social as number) ?? 0,
    authority: (obj?.authority as number) ?? 0,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchGameData(gameId: string) {
  return prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      ministries: true,
      officials: true,
      parties: true,
      senators: true,
      activeLaws: true,
      judicialCases: true,
      organisms: true,
      socialClasses: true,
      media: true,
      events: true,
    },
  });
}

// ─── Mapeo: DB → GameState ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGameState(
  game: any,
  latestMetrics: RegimeMetricsState | null,
  latestSnapshot: MonthSnapshotData | null,
  lawCatalogMap: Map<string, LawCatalogEntry>,
): GameState {
  return {
    countryName: game.countryName,
    currentYear: game.currentYear,
    currentMonth: game.currentMonth,
    treasury: latestSnapshot?.treasury ?? DEFAULT_TREASURY,
    population: latestSnapshot?.population ?? DEFAULT_POPULATION,
    gdp: latestSnapshot?.gdp ?? 0,
    povertyRate: latestSnapshot?.povertyRate ?? 0,
    unemploymentRate: latestSnapshot?.unemploymentRate ?? 0,
    sickRate: latestSnapshot?.sickRate ?? 0,
    crimeRate: latestSnapshot?.crimeRate ?? 0,
    foodSecurity: latestSnapshot?.foodSecurity ?? 0,
    educationLevel: latestSnapshot?.educationLevel ?? 0,
    inflation: latestSnapshot?.inflation ?? 0,
    lifeExpectancy: latestSnapshot?.lifeExpectancy ?? 68,
    seed: game.seed,
    consecutiveLowApprovalMonths: (game as Record<string, unknown>).consecutiveLowApprovalMonths as number ?? 0,
    ministries: game.ministries.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      key: m.key as string,
      budgetPercent: m.budgetPercent as number,
      efficiency: m.efficiency as number,
      internalCorruption: m.internalCorruption as number,
      subDecisions: (m.subDecisions ?? {}) as Record<string, number | boolean>,
      ministerOfficialId: m.ministerOfficialId as string | null,
    })),
    officials: game.officials.map((o: Record<string, unknown>) => ({
      id: o.id as string,
      name: o.name as string,
      role: o.role as string,
      ministryId: o.ministryId as string | null,
      partyId: o.partyId as string | null,
      loyalty: o.loyalty as number,
      ambition: o.ambition as number,
      wealth: o.wealth as number,
      ideology: asIdeology(o.ideology),
      corruption: o.corruption as number,
      skill: o.skill as number,
      reputation: o.reputation as number,
      status: o.status as string,
    })),
    parties: game.parties.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      ideology: asIdeology(p.ideology),
      leaderOfficialId: p.leaderOfficialId as string | null,
      popularity: p.popularity as number,
      seatsLower: p.seatsLower as number,
      seatsUpper: p.seatsUpper as number,
    })),
    senators: game.senators.map((s: Record<string, unknown>) => ({
      id: s.id as string,
      partyId: s.partyId as string,
      name: s.name as string,
      personalIdeology: asIdeology(s.personalIdeology),
      chamber: s.chamber as "LOWER" | "UPPER",
      loyalty: s.loyalty as number,
    })),
    activeLaws: game.activeLaws.map((al: Record<string, unknown>) => {
      const cat = lawCatalogMap.get(al.lawKey as string);
      return {
        id: al.id as string,
        lawKey: al.lawKey as string,
        activatedAt: (al.activatedAt as Date).toISOString(),
        effectsJson: (cat?.effectsJson ?? {}) as Record<string, unknown>,
      };
    }),
    judicialCases: game.judicialCases.map((jc: Record<string, unknown>) => ({
      id: jc.id as string,
      defendantOfficialId: jc.defendantOfficialId as string,
      caseType: jc.caseType as string,
      currentPhase: jc.currentPhase as string,
      monthsInPhase: jc.monthsInPhase as number,
      evidenceStrength: jc.evidenceStrength as number,
      prosecutorId: jc.prosecutorId as string | null,
      judgeId: jc.judgeId as string | null,
      verdict: jc.verdict as string | null,
      sentenceMonths: jc.sentenceMonths as number | null,
    })),
    organisms: game.organisms.map((org: Record<string, unknown>) => ({
      id: org.id as string,
      type: org.type as string,
      name: org.name as string,
      monthlyBudget: org.monthlyBudget as number,
      staff: org.staff as number,
      effectiveness: org.effectiveness as number,
      autonomyLevel: org.autonomyLevel as number,
      headOfficialId: org.headOfficialId as string | null,
    })),
    socialClasses: game.socialClasses.map((sc: Record<string, unknown>) => ({
      id: sc.id as string,
      key: sc.key as string,
      populationPercent: sc.populationPercent as number,
      averageIncome: sc.averageIncome as number,
      approval: sc.approval as number,
      demands: (sc.demands ?? []) as string[],
      educationLevel: sc.educationLevel as number,
      healthAccess: sc.healthAccess as number,
    })),
    regimeMetrics: latestMetrics ?? {
      powerConcentration: 30,
      pressFreedom: 70,
      judicialIndependence: 60,
      politicalPluralism: 70,
      civilLiberties: 70,
      transparency: 50,
      militarySubordination: 60,
    },
    media: game.media.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      name: m.name as string,
      type: m.type as string,
      ideologicalAffinity: asIdeology(m.ideologicalAffinity),
      reach: m.reach as number,
      credibility: m.credibility as number,
      governmentAffinity: m.governmentAffinity as number,
      status: m.status as string,
    })),
    events: game.events.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      type: e.type as string,
      severity: e.severity as number,
      year: e.year as number,
      month: e.month as number,
      description: e.description as string,
      effectsApplied: (e.effectsApplied ?? {}) as Record<string, unknown>,
      resolvedAt: e.resolvedAt ? (e.resolvedAt as Date).toISOString() : null,
    })),
  };
}

// ─── Server Action ────────────────────────────────────────────────────────────

async function verifyOwnership(gameId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true },
  });

  if (!game || game.userId !== session.user.id) {
    throw new Error("No tienes acceso a esta partida.");
  }

  return session.user.id;
}

/**
 * Carga el estado completo de un juego desde la base de datos.
 * Verifica que el usuario autenticado sea el dueño.
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
  await verifyOwnership(gameId);

  const [game, latestMetrics, latestSnapshot, lawCatalog] = await Promise.all([
    fetchGameData(gameId),
    prisma.regimeMetrics.findFirst({
      where: { gameId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.monthSnapshot.findFirst({
      where: { gameId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
    prisma.lawCatalog.findMany(),
  ]);

  if (!game) {
    return null;
  }

  const lawCatalogMap = new Map<string, LawCatalogEntry>();
  for (const l of lawCatalog) {
    lawCatalogMap.set(l.key, {
      key: l.key,
      name: l.name,
      description: l.description,
      effectsJson: l.effectsJson as Record<string, unknown>,
      idealIdeology: asIdeology(l.idealIdeology),
      cost: l.cost,
    });
  }

  return buildGameState(
    game,
    latestMetrics as RegimeMetricsState | null,
    latestSnapshot as MonthSnapshotData | null,
    lawCatalogMap,
  );
}

/**
 * Obtiene todos los snapshots historicos de una partida.
 * Utilizado por los graficos de reportes (Recharts).
 */
export async function getSnapshots(gameId: string): Promise<MonthSnapshotData[]> {
  await verifyOwnership(gameId);

  const snapshots = await prisma.monthSnapshot.findMany({
    where: { gameId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return snapshots.map((s: Record<string, unknown>) => ({
    year: Number(s.year),
    month: Number(s.month),
    treasury: Number(s.treasury) || 0,
    gdp: Number(s.gdp) || 0,
    population: Number(s.population) || 0,
    approval: Number(s.approval) || 0,
    corruption: Number(s.corruption) || 0,
    povertyRate: Number(s.povertyRate) || 0,
    unemploymentRate: Number(s.unemploymentRate) || 0,
    sickRate: Number(s.sickRate) || 0,
    crimeRate: Number(s.crimeRate) || 0,
    foodSecurity: Number(s.foodSecurity) || 0,
    educationLevel: Number(s.educationLevel) || 0,
    inflation: Number(s.inflation) || 0,
    gini: Number(s.gini) || 0,
    lifeExpectancy: Number(s.lifeExpectancy) || 68,
    regimeType: s.regimeType as string,
    regimeMetrics: (s.regimeMetrics ?? {
      powerConcentration: 0, pressFreedom: 0, judicialIndependence: 0,
      politicalPluralism: 0, civilLiberties: 0, transparency: 0, militarySubordination: 0,
    }) as MonthSnapshotData["regimeMetrics"],
  }));
}

/**
 * Crea una nueva partida para el usuario autenticado.
 */
export async function createGame(params: {
  countryName: string;
  preset: "estable_democratico" | "pobre_con_potencial" | "crisis_economica" | "post_conflicto";
  difficulty: "facil" | "normal" | "dificil";
}): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const { crearPartidaAction } = await import("./seed-game");
  return crearPartidaAction(params, session.user.id);
}
