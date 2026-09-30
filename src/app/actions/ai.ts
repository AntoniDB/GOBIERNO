"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateNarrative, getEventMaxTokens, getCoverageMaxTokens } from "@/lib/ai/generator";
import { buildEventPrompt } from "@/lib/ai/prompts/events";
import { buildCoveragePrompt } from "@/lib/ai/prompts/media";
import { isAiAvailable } from "@/lib/ai/config";
import type { GameState, EventState, MediaState } from "@/lib/engine/types";

async function verifyOwnership(gameId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true },
  });
  return game?.userId === session.user.id;
}

async function loadGameStateForPrompt(gameId: string): Promise<GameState | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      ministries: true,
      officials: true,
      socialClasses: true,
    },
  });
  if (!game) return null;

  const ministries = game.ministries.map((m) => ({
    id: m.id,
    key: m.key,
    budgetPercent: m.budgetPercent,
    efficiency: m.efficiency,
    internalCorruption: m.internalCorruption,
    subDecisions: (m.subDecisions ?? {}) as Record<string, number | boolean>,
    ministerOfficialId: m.ministerOfficialId as string | null,
    producedResources: (m.producedResources ?? {}) as Record<string, number>,
    consumedResources: (m.consumedResources ?? {}) as Record<string, number>,
    healthBudgetSplit: (m.healthBudgetSplit ?? { primary: 50, secondary: 30, tertiary: 20 }) as Record<string, number>,
  }));

  const officials = game.officials.map((o) => ({
    id: o.id,
    name: o.name,
    role: o.role,
    specialty: o.specialty as string | null,
    ministryId: o.ministryId as string | null,
    partyId: o.partyId as string | null,
    loyalty: o.loyalty,
    ambition: o.ambition,
    wealth: o.wealth,
    ideology: (o.ideology ?? { economic: 0, social: 0, authority: 0 }) as {
      economic: number;
      social: number;
      authority: number;
    },
    corruption: o.corruption,
    skill: o.skill,
    reputation: o.reputation,
    status: o.status,
  }));

  const socialClasses = game.socialClasses.map((sc) => ({
    id: sc.id,
    key: sc.key,
    populationPercent: sc.populationPercent,
    averageIncome: sc.averageIncome,
    approval: sc.approval,
    demands: (sc.demands ?? []) as string[],
    educationLevel: sc.educationLevel,
    healthAccess: sc.healthAccess,
  }));

  return {
    countryName: game.countryName,
    currentYear: game.currentYear,
    currentMonth: game.currentMonth,
    treasury: game.treasury,
    population: game.population,
    seed: game.seed,
    gdp: 0,
    povertyRate: 0,
    unemploymentRate: 0,
    sickRate: 0,
    crimeRate: 0,
    foodSecurity: 0,
    educationLevel: 0,
    inflation: 0,
    ministries,
    officials,
    parties: [],
    senators: [],
    activeLaws: [],
    judicialCases: [],
    organisms: [],
    socialClasses,
    regimeMetrics: {
      powerConcentration: 0,
      pressFreedom: 0,
      judicialIndependence: 0,
      politicalPluralism: 0,
      civilLiberties: 0,
      transparency: 0,
      militarySubordination: 0,
    },
    media: [],
    events: [],
    consecutiveLowApprovalMonths: 0,
    lifeExpectancy: 68,
    longRunningDecisions: [],
    // Estado de salud/comercio no se usa en los prompts de IA: valores neutros.
    programs: [],
    resourceStocks: [],
    regions: [],
    diseases: [],
    diseasePrevalences: [],
    diseaseMortality: 0,
    healthEfficiencyStreak: 0,
    consecutiveSaturationMonths: {},
    sanctionsMultiplier: 1,
    tradeGoods: [],
    tradeFlows: [],
    tradeBalance: 0,
    totalImports: 0,
    totalExports: 0,
  };
}

function fillIndicatorsFromSnapshot(
  state: GameState,
  snapshot: {
    povertyRate: number;
    unemploymentRate: number;
    sickRate: number;
    crimeRate: number;
    educationLevel: number;
    inflation: number;
    gdp: number;
  } | null,
): void {
  if (!snapshot) return;
  state.povertyRate = snapshot.povertyRate;
  state.unemploymentRate = snapshot.unemploymentRate;
  state.sickRate = snapshot.sickRate;
  state.crimeRate = snapshot.crimeRate;
  state.educationLevel = snapshot.educationLevel;
  state.inflation = snapshot.inflation;
  state.gdp = snapshot.gdp;
}

export async function generateEventNarrative(
  gameId: string,
  eventId: string,
): Promise<{ narrative: string } | null> {
  if (!isAiAvailable()) return null;
  if (!(await verifyOwnership(gameId))) return null;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.gameId !== gameId) return null;

  const snapshot = await prisma.monthSnapshot.findUnique({
    where: {
      gameId_year_month: {
        gameId,
        year: event.year,
        month: event.month,
      },
    },
    select: { aiEventNarratives: true },
  });

  const cached = (snapshot?.aiEventNarratives as Record<string, string> | null)?.[
    eventId
  ];
  if (cached) return { narrative: cached };

  const state = await loadGameStateForPrompt(gameId);
  if (!state) return null;

  const indicatorsSnapshot = await prisma.monthSnapshot.findUnique({
    where: {
      gameId_year_month: {
        gameId,
        year: event.year,
        month: event.month,
      },
    },
    select: {
      povertyRate: true,
      unemploymentRate: true,
      sickRate: true,
      crimeRate: true,
      educationLevel: true,
      inflation: true,
      gdp: true,
    },
  });
  fillIndicatorsFromSnapshot(state, indicatorsSnapshot);

  const eventState: EventState = {
    id: event.id,
    type: event.type,
    severity: event.severity,
    year: event.year,
    month: event.month,
    description: event.description,
    effectsApplied: (event.effectsApplied ?? {}) as Record<string, unknown>,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
  };

  const { system, user } = buildEventPrompt(eventState, state);
  const narrative = await generateNarrative(system, user, getEventMaxTokens());
  if (!narrative) return null;

  const currentNarratives =
    (snapshot?.aiEventNarratives as Record<string, string>) ?? {};
  currentNarratives[eventId] = narrative;

  await prisma.monthSnapshot.upsert({
    where: {
      gameId_year_month: {
        gameId,
        year: event.year,
        month: event.month,
      },
    },
    create: {
      id: crypto.randomUUID(),
      game: { connect: { id: gameId } },
      year: event.year,
      month: event.month,
      treasury: state.treasury,
      gdp: state.gdp,
      population: state.population,
      approval: 0,
      corruption: 0,
      povertyRate: state.povertyRate,
      unemploymentRate: state.unemploymentRate,
      sickRate: state.sickRate,
      crimeRate: state.crimeRate,
      foodSecurity: 0,
      educationLevel: state.educationLevel,
      inflation: state.inflation,
      gini: 0,
      regimeType: "",
      regimeMetrics: {},
      aiEventNarratives: currentNarratives,
    },
    update: { aiEventNarratives: currentNarratives },
  });

  return { narrative };
}

export async function generateCoverageNarrative(
  gameId: string,
  coverageId: string,
): Promise<{ narrative: string } | null> {
  if (!isAiAvailable()) return null;
  if (!(await verifyOwnership(gameId))) return null;

  const coverage = await prisma.mediaCoverage.findUnique({
    where: { id: coverageId },
    include: { media: true },
  });
  if (!coverage || coverage.gameId !== gameId) return null;

  const snapshot = await prisma.monthSnapshot.findUnique({
    where: {
      gameId_year_month: {
        gameId,
        year: coverage.year,
        month: coverage.month,
      },
    },
    select: { aiCoverageNarratives: true },
  });

  const cached = (
    snapshot?.aiCoverageNarratives as Record<string, string> | null
  )?.[coverageId];
  if (cached) return { narrative: cached };

  const event = coverage.eventId
    ? await prisma.event.findUnique({ where: { id: coverage.eventId } })
    : null;

  const eventState: EventState = {
    id: event?.id ?? coverageId,
    type: event?.type ?? "OTHER",
    severity: event?.severity ?? 0,
    year: coverage.year,
    month: coverage.month,
    description: event?.description ?? coverage.headline,
    effectsApplied: (event?.effectsApplied ?? {}) as Record<string, unknown>,
    resolvedAt: event?.resolvedAt?.toISOString() ?? null,
  };

  const mediaState: MediaState = {
    id: coverage.media.id,
    name: coverage.media.name,
    type: coverage.media.type,
    ideologicalAffinity:
      (coverage.media.ideologicalAffinity as {
        economic: number;
        social: number;
        authority: number;
      }) ?? { economic: 0, social: 0, authority: 0 },
    reach: coverage.media.reach,
    credibility: coverage.media.credibility,
    governmentAffinity: coverage.media.governmentAffinity,
    status: coverage.media.status,
  };

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { countryName: true },
  });
  const countryName = game?.countryName ?? "el país";

  const { system, user } = buildCoveragePrompt(
    mediaState,
    eventState,
    coverage.sentiment,
    countryName,
  );

  const narrative = await generateNarrative(system, user, getCoverageMaxTokens());
  if (!narrative) return null;

  const currentNarratives =
    (snapshot?.aiCoverageNarratives as Record<string, string>) ?? {};
  currentNarratives[coverageId] = narrative;

  await prisma.monthSnapshot.upsert({
    where: {
      gameId_year_month: {
        gameId,
        year: coverage.year,
        month: coverage.month,
      },
    },
    create: {
      id: crypto.randomUUID(),
      game: { connect: { id: gameId } },
      year: coverage.year,
      month: coverage.month,
      treasury: 0,
      gdp: 0,
      population: 0,
      approval: 0,
      corruption: 0,
      povertyRate: 0,
      unemploymentRate: 0,
      sickRate: 0,
      crimeRate: 0,
      foodSecurity: 0,
      educationLevel: 0,
      inflation: 0,
      gini: 0,
      regimeType: "",
      regimeMetrics: {},
      aiCoverageNarratives: currentNarratives,
    },
    update: { aiCoverageNarratives: currentNarratives },
  });

  return { narrative };
}

export async function checkAiAvailability(): Promise<boolean> {
  return isAiAvailable();
}
