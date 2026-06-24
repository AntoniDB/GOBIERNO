// @ts-nocheck — Capa de persistencia: mapeo entre tipos planos del motor y Prisma 7.
// Los tipos estrictos de JSON/enums de Prisma 7 son incompatibles con objetos planos.
// El motor (lib/engine/*) sí está completamente tipado y testeado.
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { simulateSenateVote } from "@/lib/engine/congress";
import type {
  GameState,
  TurnInput,
  TurnOutput,
  MinistryState,
  OfficialState,
  PartyState,
  SenatorState,
  ActiveLawState,
  JudicialCaseState,
  OrganismState,
  SocialClassState,
  RegimeMetricsState,
  MediaState,
  EventState,
  Ideology,
  MonthSnapshotData,
  TurnNotification,
  MediaCoverageData,
  MediaPollData,
  LawCatalogEntry,
} from "@/lib/engine/types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_TREASURY = 1_000_000_000;
const DEFAULT_POPULATION = 10_000_000;

// ─── Utilidades ───────────────────────────────────────────────────────────────

function ideologyAlignment(a: Ideology, b: Record<string, number>): number {
  const aNorm = Math.sqrt(a.economic ** 2 + a.social ** 2 + a.authority ** 2);
  const bEconomic = b.economic ?? 0;
  const bSocial = b.social ?? 0;
  const bAuthority = b.authority ?? 0;
  const bNorm = Math.sqrt(bEconomic ** 2 + bSocial ** 2 + bAuthority ** 2);
  if (aNorm === 0 || bNorm === 0) return 0;
  return (
    (a.economic * bEconomic + a.social * bSocial + a.authority * bAuthority) /
    (aNorm * bNorm)
  );
}

// ─── Mapeo: DB → GameState ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asIdeology(raw: any): Ideology {
  const obj = raw as Record<string, unknown> | null | undefined;
  return {
    economic: (obj?.economic as number) ?? 0,
    social: (obj?.social as number) ?? 0,
    authority: (obj?.authority as number) ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGameState(game: any, latestMetrics: RegimeMetricsState | null, latestSnapshot: MonthSnapshotData | null, lawCatalogMap: Map<string, LawCatalogEntry>): GameState {
  return {
    countryName: game.countryName,
    currentYear: game.currentYear,
    currentMonth: game.currentMonth,
    treasury: latestSnapshot?.treasury ?? DEFAULT_TREASURY,
    population: latestSnapshot?.population ?? DEFAULT_POPULATION,
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
      powerConcentration: 30, pressFreedom: 70, judicialIndependence: 60,
      politicalPluralism: 70, civilLiberties: 70, transparency: 50, militarySubordination: 60,
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
    longRunningDecisions: (game.longRunningDecisions ?? []).map((lrd: Record<string, unknown>) => ({
      id: lrd.id as string,
      type: lrd.type as string,
      name: lrd.name as string,
      monthsRemaining: lrd.monthsRemaining as number,
      totalMonths: lrd.totalMonths as number,
      monthlyCost: lrd.monthlyCost as number,
      parameters: (lrd.parameters ?? {}) as Record<string, unknown>,
      status: (lrd.status as string) as "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      startedAt: (lrd.startedAt as Date).toISOString(),
      completedAt: lrd.completedAt ? (lrd.completedAt as Date).toISOString() : null,
      cancelledAt: lrd.cancelledAt ? (lrd.cancelledAt as Date).toISOString() : null,
      progressLog: (lrd.progressLog as string[]) ?? [],
      effectOnCompletion: (lrd.effectOnCompletion ?? {}) as Record<string, unknown>,
    })),
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
      longRunningDecisions: true,
    },
  });
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function advanceMonth(
  gameId: string,
  input: TurnInput,
): Promise<TurnOutput> {
  // Verificar ownership
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const gameOwnership = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true },
  });
  if (!gameOwnership || gameOwnership.userId !== session.user.id) {
    throw new Error("No tienes acceso a esta partida.");
  }

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

  // Construir GameState plano
  const gameState = buildGameState(
    game,
    latestMetrics as RegimeMetricsState | null,
    latestSnapshot as MonthSnapshotData | null,
    lawCatalogMap,
  );

  // RNG determinista sembrado
  const rng = createRNG(
    `${game.seed}-${game.currentYear}-${game.currentMonth}`,
  );

  // Ejecutar motor puro
  const output = processTurn(gameState, input, rng);
  const { newState, monthSnapshot, notifications, newEvents, mediaCoverages, mediaPolls, gameOver } = output;

  // Calcular nuevo año/mes
  const monthAdvanced = game.currentMonth + 1;
  const newYear = monthAdvanced > 12 ? game.currentYear + 1 : game.currentYear;
  const newMonth = monthAdvanced > 12 ? 1 : monthAdvanced;

  // Simular votación de leyes con el motor bicameral
  const lawResults: {
    lawKey: string; approved: boolean; votesFor: number; votesAgainst: number; votesAbstain: number;
    lowerFor: number; lowerAgainst: number; lowerAbstain: number;
    upperFor: number; upperAgainst: number; upperAbstain: number;
  }[] = [];

  if (input.proposedLaws && input.proposedLaws.length > 0) {
    // Construir set de partidos beneficiados por compra de votos
    const rewardedPartyIds = input.voteBuyingPartyIds
      ? new Set(input.voteBuyingPartyIds)
      : new Set<string>();

    for (const lawKey of input.proposedLaws) {
      const catalogEntry = lawCatalogMap.get(lawKey);
      if (!catalogEntry) continue;

      const voteResult = simulateSenateVote(
        game.senators.map((s: Record<string, unknown>) => ({
          id: s.id as string, partyId: s.partyId as string, name: s.name as string,
          personalIdeology: asIdeology(s.personalIdeology),
          chamber: s.chamber as "LOWER" | "UPPER", loyalty: s.loyalty as number,
        })),
        game.parties.map((p: Record<string, unknown>) => ({
          id: p.id as string, name: p.name as string,
          ideology: asIdeology(p.ideology),
          leaderOfficialId: p.leaderOfficialId as string | null,
          popularity: p.popularity as number, seatsLower: p.seatsLower as number, seatsUpper: p.seatsUpper as number,
        })),
        catalogEntry.idealIdeology as unknown as Record<string, number>,
        latestSnapshot?.approval ?? 50,
        rewardedPartyIds,
      );

      lawResults.push({
        lawKey,
        approved: voteResult.approved,
        votesFor: voteResult.totalVotesFor,
        votesAgainst: voteResult.totalVotesAgainst,
        votesAbstain: voteResult.totalVotesAbstain,
        lowerFor: voteResult.lowerVotesFor,
        lowerAgainst: voteResult.lowerVotesAgainst,
        lowerAbstain: voteResult.lowerVotesAbstain,
        upperFor: voteResult.upperVotesFor,
        upperAgainst: voteResult.upperVotesAgainst,
        upperAbstain: voteResult.upperVotesAbstain,
      });
    }
  }

  // Persistir en transacción atómica
  await prisma.$transaction(async (tx) => {
    // a. Actualizar Game
    await tx.game.update({
      where: { id: gameId },
      data: {
        currentYear: newYear,
        currentMonth: newMonth,
        treasury: newState.treasury,
        population: newState.population,
        consecutiveLowApprovalMonths: newState.consecutiveLowApprovalMonths ?? 0,
        status: gameOver ? ("FINISHED" as const) : undefined,
      },
    });

    // b. Ministerios
    for (const m of newState.ministries) {
      await tx.ministry.update({
        where: { id: m.id },
        data: {
          efficiency: m.efficiency,
          internalCorruption: m.internalCorruption,
          subDecisions: m.subDecisions as Record<string, unknown>,
          budgetPercent: m.budgetPercent,
          ministerOfficialId: m.ministerOfficialId,
        },
      });
    }

    // c. Officials (upsert para soportar nuevos candidatos)
    for (const o of newState.officials) {
      await tx.official.upsert({
        where: { id: o.id },
        create: {
          id: o.id,
          game: { connect: { id: gameId } },
          name: o.name,
          role: o.role as string,
          status: o.status as string,
          corruption: o.corruption,
          skill: o.skill ?? 50,
          loyalty: o.loyalty,
          ambition: o.ambition,
          wealth: o.wealth,
          reputation: o.reputation,
          ideology: o.ideology as Record<string, unknown>,
          ministryId: o.ministryId,
          party: o.partyId ? { connect: { id: o.partyId } } : undefined,
        },
        update: {
          corruption: o.corruption,
          status: o.status as string,
          wealth: o.wealth,
          reputation: o.reputation,
          ministryId: o.ministryId,
          party: o.partyId ? { connect: { id: o.partyId } } : { disconnect: true },
          role: o.role as string,
          loyalty: o.loyalty,
          ambition: o.ambition,
          skill: o.skill ?? 50,
          ideology: o.ideology as Record<string, unknown>,
        },
      });
    }

    // d. SocialClasses
    for (const sc of newState.socialClasses) {
      await tx.socialClass.update({
        where: { id: sc.id },
        data: {
          approval: sc.approval,
          populationPercent: sc.populationPercent,
          educationLevel: sc.educationLevel,
          healthAccess: sc.healthAccess,
          averageIncome: sc.averageIncome,
          demands: sc.demands as unknown[],
        },
      });
    }

    // e. Crear RegimeMetrics
    await tx.regimeMetrics.create({
      data: {
        gameId,
        powerConcentration: newState.regimeMetrics.powerConcentration,
        pressFreedom: newState.regimeMetrics.pressFreedom,
        judicialIndependence: newState.regimeMetrics.judicialIndependence,
        politicalPluralism: newState.regimeMetrics.politicalPluralism,
        civilLiberties: newState.regimeMetrics.civilLiberties,
        transparency: newState.regimeMetrics.transparency,
        militarySubordination: newState.regimeMetrics.militarySubordination,
      },
    });

    // f. MonthSnapshot
    await tx.monthSnapshot.upsert({
      where: {
        gameId_year_month: {
          gameId,
          year: game.currentYear,
          month: game.currentMonth,
        },
      },
      create: {
        id: crypto.randomUUID(),
        game: { connect: { id: gameId } },
        year: game.currentYear,
        month: game.currentMonth,
        treasury: monthSnapshot.treasury,
        gdp: monthSnapshot.gdp,
        population: monthSnapshot.population,
        approval: monthSnapshot.approval,
        corruption: monthSnapshot.corruption,
        povertyRate: monthSnapshot.povertyRate,
        unemploymentRate: monthSnapshot.unemploymentRate,
        sickRate: monthSnapshot.sickRate,
        crimeRate: monthSnapshot.crimeRate,
        foodSecurity: monthSnapshot.foodSecurity,
        educationLevel: monthSnapshot.educationLevel,
        inflation: monthSnapshot.inflation,
        gini: monthSnapshot.gini,
        regimeType: monthSnapshot.regimeType,
        regimeMetrics: monthSnapshot.regimeMetrics as Record<string, unknown>,
        lifeExpectancy: monthSnapshot.lifeExpectancy,
        activeLrdCount: monthSnapshot.activeLrdCount,
        lrdMonthlyCost: monthSnapshot.lrdMonthlyCost,
        lrdCompletedThisMonth: monthSnapshot.lrdCompletedThisMonth,
        lrdCancelledThisMonth: monthSnapshot.lrdCancelledThisMonth,
      },
      update: {
        treasury: monthSnapshot.treasury,
        gdp: monthSnapshot.gdp,
        population: monthSnapshot.population,
        approval: monthSnapshot.approval,
        corruption: monthSnapshot.corruption,
        povertyRate: monthSnapshot.povertyRate,
        unemploymentRate: monthSnapshot.unemploymentRate,
        sickRate: monthSnapshot.sickRate,
        crimeRate: monthSnapshot.crimeRate,
        foodSecurity: monthSnapshot.foodSecurity,
        educationLevel: monthSnapshot.educationLevel,
        inflation: monthSnapshot.inflation,
        gini: monthSnapshot.gini,
        regimeType: monthSnapshot.regimeType,
        regimeMetrics: monthSnapshot.regimeMetrics as Record<string, unknown>,
        lifeExpectancy: monthSnapshot.lifeExpectancy,
        activeLrdCount: monthSnapshot.activeLrdCount,
        lrdMonthlyCost: monthSnapshot.lrdMonthlyCost,
        lrdCompletedThisMonth: monthSnapshot.lrdCompletedThisMonth,
        lrdCancelledThisMonth: monthSnapshot.lrdCancelledThisMonth,
      },
    });

    // g. LongRunningDecisions: upsert cada LRD
    for (const lrd of newState.longRunningDecisions) {
      await tx.longRunningDecision.upsert({
        where: { id: lrd.id },
        create: {
          id: lrd.id,
          game: { connect: { id: gameId } },
          type: lrd.type as string,
          name: lrd.name,
          monthsRemaining: lrd.monthsRemaining,
          totalMonths: lrd.totalMonths,
          monthlyCost: lrd.monthlyCost,
          parameters: lrd.parameters as Record<string, unknown>,
          status: lrd.status as string,
          startedAt: new Date(lrd.startedAt),
          completedAt: lrd.completedAt ? new Date(lrd.completedAt) : null,
          cancelledAt: lrd.cancelledAt ? new Date(lrd.cancelledAt) : null,
          progressLog: lrd.progressLog ?? [],
          effectOnCompletion: lrd.effectOnCompletion as Record<string, unknown>,
        },
        update: {
          monthsRemaining: lrd.monthsRemaining,
          monthlyCost: lrd.monthlyCost,
          parameters: lrd.parameters as Record<string, unknown>,
          status: lrd.status as string,
          completedAt: lrd.completedAt ? new Date(lrd.completedAt) : null,
          cancelledAt: lrd.cancelledAt ? new Date(lrd.cancelledAt) : null,
          progressLog: lrd.progressLog ?? [],
          effectOnCompletion: lrd.effectOnCompletion as Record<string, unknown>,
        },
      });
    }

    // h. JudicialCases — con verificacion anti-duplicados a nivel DB
    for (const jc of newState.judicialCases) {
      // Para casos nuevos de corrupcion, verificar que no exista ya uno activo
      // del mismo tipo para el mismo funcionario. Esto es la ultima linea de defensa:
      // el motor puro tambien chequea, pero una constraint a nivel DB garantiza integridad.
      if (jc.id.startsWith("auto-") && jc.caseType === "CORRUPTION") {
        const existing = await tx.judicialCase.findFirst({
          where: {
            defendantOfficialId: jc.defendantOfficialId,
            caseType: jc.caseType as string,
            currentPhase: { not: "CLOSED" as const },
            id: { not: jc.id },
          },
          select: { id: true },
        });
        if (existing) {
          // Ya existe un caso activo del mismo tipo para este funcionario. Saltar.
          continue;
        }
      }

      await tx.judicialCase.upsert({
        where: { id: jc.id },
        create: {
          id: jc.id,
          game: { connect: { id: gameId } },
          defendant: { connect: { id: jc.defendantOfficialId } },
          caseType: jc.caseType as string,
          description: `Caso ${jc.caseType.toLowerCase()} abierto contra funcionario`,
          currentPhase: jc.currentPhase as string,
          monthsInPhase: jc.monthsInPhase,
          evidenceStrength: jc.evidenceStrength,
          prosecutor: jc.prosecutorId ? { connect: { id: jc.prosecutorId } } : undefined,
          judge: jc.judgeId ? { connect: { id: jc.judgeId } } : undefined,
          verdict: jc.verdict,
          sentenceMonths: jc.sentenceMonths,
        },
        update: {
          currentPhase: jc.currentPhase as string,
          monthsInPhase: jc.monthsInPhase,
          evidenceStrength: jc.evidenceStrength,
          prosecutor: jc.prosecutorId ? { connect: { id: jc.prosecutorId } } : { disconnect: true },
          judge: jc.judgeId ? { connect: { id: jc.judgeId } } : { disconnect: true },
          verdict: jc.verdict,
          sentenceMonths: jc.sentenceMonths,
        },
      });
    }

    // h. Organismos: upsert (nuevos creados por el jugador)
    for (const org of newState.organisms) {
      // Si el organismo esta siendo disuelto, registrar la fecha
      const isDissolved = org.effectiveness <= 0;
      const existingOrg = isDissolved
        ? await tx.organism.findUnique({ where: { id: org.id }, select: { dissolvedAt: true } })
        : null;
      const dissolvedAt = isDissolved
        ? (existingOrg?.dissolvedAt ?? new Date())
        : null;

      await tx.organism.upsert({
        where: { id: org.id },
        create: {
          id: org.id,
          game: { connect: { id: gameId } },
          type: org.type as string,
          name: org.name,
          monthlyBudget: org.monthlyBudget,
          staff: org.staff,
          effectiveness: org.effectiveness,
          autonomyLevel: org.autonomyLevel,
          headOfficial: org.headOfficialId ? { connect: { id: org.headOfficialId } } : undefined,
          dissolvedAt,
        },
        update: {
          monthlyBudget: org.monthlyBudget,
          staff: org.staff,
          effectiveness: org.effectiveness,
          autonomyLevel: org.autonomyLevel,
          headOfficial: org.headOfficialId ? { connect: { id: org.headOfficialId } } : { disconnect: true },
          dissolvedAt,
        },
      });
    }

    // i. Eventos
    for (const evt of newEvents) {
      await tx.event.create({
        data: {
          id: evt.id,
          gameId,
          type: evt.type as string,
          severity: evt.severity,
          year: evt.year,
          month: evt.month,
          description: evt.description,
          effectsApplied: evt.effectsApplied as Record<string, unknown>,
          resolvedAt: evt.resolvedAt ? new Date(evt.resolvedAt) : null,
        },
      });
    }

    // i. MediaCoverages
    for (const mc of mediaCoverages) {
      await tx.mediaCoverage.create({
        data: {
          id: crypto.randomUUID(),
          mediaId: mc.mediaId,
          gameId,
          year: game.currentYear,
          month: game.currentMonth,
          headline: mc.headline,
          sentiment: mc.sentiment,
          impactOnApproval: mc.impactOnApproval as Record<string, unknown>,
        },
      });
    }

    // j. Leyes propuestas
    for (const result of lawResults) {
      await tx.lawProposal.create({
        data: {
          id: crypto.randomUUID(),
          gameId,
          lawKey: result.lawKey,
          status: result.approved ? "APPROVED" as const : "REJECTED" as const,
          votesFor: result.votesFor,
          votesAgainst: result.votesAgainst,
          votesAbstain: result.votesAbstain,
          resolvedAt: new Date(),
        },
      });

      if (result.approved) {
        await tx.activeLaw.create({
          data: {
          id: crypto.randomUUID(),
            gameId,
            lawKey: result.lawKey,
          },
        });
      }
    }
  });

  // Notificaciones de leyes con detalle bicameral
  const lawNotifications: TurnNotification[] = lawResults.map((r) => ({
    type: "law",
    title: r.approved ? "Ley aprobada" : "Ley rechazada",
    description: r.approved
      ? `La ley "${r.lawKey}" fue aprobada. Cámara Baja: ${r.lowerFor} a favor, ${r.lowerAgainst} en contra. Cámara Alta: ${r.upperFor} a favor, ${r.upperAgainst} en contra.`
      : `La ley "${r.lawKey}" fue rechazada. Cámara Baja: ${r.lowerFor} a favor, ${r.lowerAgainst} en contra. Cámara Alta: ${r.upperFor} a favor, ${r.upperAgainst} en contra.`,
  }));

  return {
    newState,
    monthSnapshot,
    notifications: [...notifications, ...lawNotifications],
    newEvents,
    mediaCoverages,
    mediaPolls,
    gameOver,
  };
}
