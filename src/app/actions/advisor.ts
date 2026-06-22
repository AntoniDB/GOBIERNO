"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateNarrative } from "@/lib/ai/generator";
import { buildAdvisorPrompt } from "@/lib/ai/prompts/advisor";
import { isAiAvailable } from "@/lib/ai/config";
import { BALANCE } from "@/lib/balance";
import type { GameState, TurnInput } from "@/lib/engine/types";

export interface AdvisorReport {
  markdown: string;
  turnYear: number;
  turnMonth: number;
  error?: string;
}

/** Min, MonthSnapshot y LawCatalog necesarios para popular indicadores actuales */
async function loadGameStateWithSnapshot(gameId: string): Promise<GameState | null> {
  const [game, snapshot] = await Promise.all([
    prisma.game.findUnique({
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
    }),
    prisma.monthSnapshot.findFirst({
      where: { gameId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!game) return null;

  const ministries = game.ministries.map((m) => ({
    id: m.id,
    key: m.key,
    budgetPercent: m.budgetPercent,
    efficiency: m.efficiency,
    internalCorruption: m.internalCorruption,
    subDecisions: (m.subDecisions ?? {}) as Record<string, number | boolean>,
    ministerOfficialId: m.ministerOfficialId as string | null,
  }));

  const officials = game.officials.map((o) => ({
    id: o.id,
    name: o.name,
    role: o.role,
    ministryId: o.ministryId as string | null,
    partyId: o.partyId as string | null,
    loyalty: o.loyalty,
    ambition: o.ambition,
    wealth: o.wealth,
    ideology: (o.ideology ?? {
      economic: 0,
      social: 0,
      authority: 0,
    }) as { economic: number; social: number; authority: number },
    corruption: o.corruption,
    skill: o.skill,
    reputation: o.reputation,
    status: o.status,
  }));

  const parties = game.parties.map((p) => ({
    id: p.id,
    name: p.name,
    ideology: (p.ideology ?? {
      economic: 0,
      social: 0,
      authority: 0,
    }) as { economic: number; social: number; authority: number },
    leaderOfficialId: p.leaderOfficialId as string | null,
    popularity: p.popularity,
    seatsLower: p.seatsLower,
    seatsUpper: p.seatsUpper,
  }));

  const senators = game.senators.map((s) => ({
    id: s.id,
    partyId: s.partyId,
    name: s.name,
    personalIdeology: (s.personalIdeology ?? {
      economic: 0,
      social: 0,
      authority: 0,
    }) as { economic: number; social: number; authority: number },
    chamber: s.chamber as "LOWER" | "UPPER",
    loyalty: s.loyalty,
  }));

  const activeLaws = game.activeLaws.map((al) => ({
    id: al.id,
    lawKey: al.lawKey,
    activatedAt: al.activatedAt.toISOString(),
    effectsJson: ({} as Record<string, unknown>),
  }));

  const judicialCases = game.judicialCases.map((jc) => ({
    id: jc.id,
    defendantOfficialId: jc.defendantOfficialId,
    caseType: jc.caseType,
    currentPhase: jc.currentPhase,
    monthsInPhase: jc.monthsInPhase,
    evidenceStrength: jc.evidenceStrength,
    prosecutorId: jc.prosecutorId as string | null,
    judgeId: jc.judgeId as string | null,
    verdict: jc.verdict as string | null,
    sentenceMonths: jc.sentenceMonths as number | null,
  }));

  const organisms = game.organisms.map((org) => ({
    id: org.id,
    type: org.type,
    name: org.name,
    monthlyBudget: org.monthlyBudget,
    staff: org.staff,
    effectiveness: org.effectiveness,
    autonomyLevel: org.autonomyLevel,
    headOfficialId: org.headOfficialId as string | null,
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

  const media = game.media.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    ideologicalAffinity: (m.ideologicalAffinity ?? {
      economic: 0,
      social: 0,
      authority: 0,
    }) as { economic: number; social: number; authority: number },
    reach: m.reach,
    credibility: m.credibility,
    governmentAffinity: m.governmentAffinity,
    status: m.status,
  }));

  const events = game.events.map((e) => ({
    id: e.id,
    type: e.type,
    severity: e.severity,
    year: e.year,
    month: e.month,
    description: e.description,
    effectsApplied: (e.effectsApplied ?? {}) as Record<string, unknown>,
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
  }));

  return {
    countryName: game.countryName,
    currentYear: game.currentYear,
    currentMonth: game.currentMonth,
    treasury: snapshot?.treasury ?? game.treasury,
    population: snapshot?.population ?? game.population,
    seed: game.seed,
    gdp: snapshot?.gdp ?? 0,
    povertyRate: snapshot?.povertyRate ?? 0,
    unemploymentRate: snapshot?.unemploymentRate ?? 0,
    sickRate: snapshot?.sickRate ?? 0,
    crimeRate: snapshot?.crimeRate ?? 0,
    foodSecurity: snapshot?.foodSecurity ?? 0,
    educationLevel: snapshot?.educationLevel ?? 0,
    inflation: snapshot?.inflation ?? 0,
    ministries,
    officials,
    parties,
    senators,
    activeLaws,
    judicialCases,
    organisms,
    socialClasses,
    regimeMetrics: (snapshot?.regimeMetrics ?? {
      powerConcentration: 30,
      pressFreedom: 70,
      judicialIndependence: 60,
      politicalPluralism: 70,
      civilLiberties: 70,
      transparency: 50,
      militarySubordination: 60,
    }) as GameState["regimeMetrics"],
    media,
    events,
    consecutiveLowApprovalMonths: game.consecutiveLowApprovalMonths ?? 0,
  };
}

export async function consultAdvisor(
  gameId: string,
  pendingInput: TurnInput,
): Promise<AdvisorReport | null> {
  if (!isAiAvailable()) return null;

  const session = await auth();
  if (!session?.user?.id) return null;

  const gameOwnership = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true, currentYear: true, currentMonth: true },
  });
  if (!gameOwnership || gameOwnership.userId !== session.user.id) return null;

  const state = await loadGameStateWithSnapshot(gameId);
  if (!state) return null;

  const { system, user } = buildAdvisorPrompt(state, pendingInput);

  try {
    const markdown = await generateNarrative(
      system,
      user,
      BALANCE.AI_ADVISOR_MAX_TOKENS,
    );

    if (!markdown) {
      // generateNarrative retorna null cuando el LLM falla (timeout, error red, etc.)
      return {
        markdown: "",
        turnYear: gameOwnership.currentYear,
        turnMonth: gameOwnership.currentMonth,
        error: "El servicio de IA no respondió a tiempo. Reintenta o verifica tu conexión.",
      };
    }

    return {
      markdown,
      turnYear: gameOwnership.currentYear,
      turnMonth: gameOwnership.currentMonth,
    };
  } catch (err) {
    return {
      markdown: "",
      turnYear: gameOwnership.currentYear,
      turnMonth: gameOwnership.currentMonth,
      error: `Error inesperado: ${err instanceof Error ? err.message : "desconocido"}`,
    };
  }
}
