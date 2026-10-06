// @ts-nocheck — Capa de persistencia: mapeo entre tipos planos del motor y Prisma 7.
// Los tipos estrictos de JSON/enums de Prisma 7 son incompatibles con objetos planos.
// El motor (lib/engine/*) sí está completamente tipado y testeado.
"use server";

import { prisma } from "@/lib/prisma";
import { getTransactionOptions } from "@/lib/db-config";
import { persistTurn } from "./turn-persistence";
import { auth } from "@/auth";
import { ensureSeedIntegrity } from "@/lib/seed-integrity";
import { initialEconomy, snapshotIndicators } from "@/lib/initial-economy";
import { createRNG } from "@/lib/rng";
import { processTurn } from "@/lib/engine/turn";
import { resolveLawEnactments } from "@/lib/engine/economy";
import { simulateSenateVote } from "@/lib/engine/congress";
import type {
  GameState, MinistryProgramState, MonthSnapshotData, RegimeMetricsState, LawCatalogEntry,
  TradeGoodCategory, TradeFlowDirection,
} from "@/lib/engine/types";

// ─── Constantes ───────────────────────────────────────────────────────────────

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
  const initial = initialEconomy(game.preset, game.difficulty);
  return {
    countryName: game.countryName,
    currentYear: game.currentYear,
    currentMonth: game.currentMonth,
    treasury: latestSnapshot?.treasury ?? initial.treasury,
    population: latestSnapshot?.population ?? initial.population,
    ...snapshotIndicators(latestSnapshot, initial),
    seed: game.seed,
    consecutiveLowApprovalMonths: (game as Record<string, unknown>).consecutiveLowApprovalMonths as number ?? 0,
    healthEfficiencyStreak: (game as Record<string, unknown>).healthEfficiencyStreak as number ?? 0,
    consecutiveSaturationMonths: (game as Record<string, unknown>).consecutiveSaturationMonths as Record<string, number> ?? {},
    ministries: game.ministries.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      key: m.key as string,
      budgetPercent: m.budgetPercent as number,
      efficiency: m.efficiency as number,
      internalCorruption: m.internalCorruption as number,
      subDecisions: (m.subDecisions ?? {}) as Record<string, number | boolean>,
      ministerOfficialId: m.ministerOfficialId as string | null,
      producedResources: (m.producedResources ?? {}) as Record<string, number>,
      consumedResources: (m.consumedResources ?? {}) as Record<string, number>,
      healthBudgetSplit: (m.healthBudgetSplit ?? { primary: 50, secondary: 30, tertiary: 20 }) as Record<string, number>,
    })),
    officials: game.officials.map((o: Record<string, unknown>) => ({
      id: o.id as string,
      name: o.name as string,
      role: o.role as string,
      specialty: o.specialty as string | null,
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
    resourceStocks: (game.resourceStocks ?? []).map((rs: Record<string, unknown>) => ({
      id: rs.id as string,
      resourceType: rs.resourceType as string,
      quantity: rs.quantity as number,
    })),
    regions: (game.regions ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      type: r.type as string,
      populationPercent: r.populationPercent as number,
      povertyRate: r.povertyRate as number,
      infrastructureLevel: r.infrastructureLevel as number,
      accessModifier: r.accessModifier as number,
      povertyModifier: r.povertyModifier as number,
      healthCoverage: (r.healthCoverage ?? {}) as GameState["regions"][0]["healthCoverage"],
    })),
    diseases: (game.diseases ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      name: d.name as string,
      category: d.category as string,
      contagionRate: d.contagionRate as number,
      mortalityRate: d.mortalityRate as number,
      prevalence: d.prevalence as number,
      prevalenceBase: d.prevalenceBase as number,
      hasVaccine: d.hasVaccine as boolean,
      preventionSensitivity: d.preventionSensitivity as number,
      monthlyCostPerPatient: d.monthlyCostPerPatient as number,
      classAffinity: (d.classAffinity ?? {}) as Record<string, number>,
    })),
    diseasePrevalences: (game.diseasePrevalences ?? []).map((dp: Record<string, unknown>) => ({
      id: dp.id as string,
      diseaseId: dp.diseaseId as string,
      currentPrevalence: dp.currentPrevalence as number,
    })),
    diseaseMortality: 0,
    programs: (game.programs ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      type: p.type as MinistryProgramState["type"],
      parameters: (p.parameters ?? {}) as Record<string, unknown>,
      monthlyCost: p.monthlyCost as number,
      status: p.status as MinistryProgramState["status"],
      startedAt: (p.startedAt as Date).toISOString(),
      deactivatedAt: p.deactivatedAt ? (p.deactivatedAt as Date).toISOString() : null,
    })),
    sanctionsMultiplier: (game.sanctionsMultiplier as number) ?? 1.0,
    tradeGoods: (game.tradeGoods ?? []).map((tg: Record<string, unknown>) => ({
      id: tg.id as string,
      gameId: tg.gameId as string,
      key: tg.key as string,
      category: tg.category as TradeGoodCategory,
      name: tg.name as string,
      description: tg.description as string | null,
      baseCostPerUnit: tg.baseCostPerUnit as number,
      unitDescription: tg.unitDescription as string,
      demandPerCapita: tg.demandPerCapita as number,
    })),
    tradeFlows: (game.tradeFlows ?? []).map((tf: Record<string, unknown>) => ({
      id: tf.id as string,
      gameId: tf.gameId as string,
      tradeGoodId: tf.tradeGoodId as string,
      direction: tf.direction as TradeFlowDirection,
      monthlyVolume: tf.monthlyVolume as number,
      targetVolume: tf.targetVolume as number,
      unitCost: tf.unitCost as number,
      sanctionsMultiplier: (tf.sanctionsMultiplier as number) ?? 1.0,
      monthlyCost: tf.monthlyCost as number,
      isActive: tf.isActive as boolean,
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
      resourceStocks: true,
      regions: true,
      diseases: true,
      diseasePrevalences: true,
      programs: true,
      tradeGoods: true,
      tradeFlows: true,
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

  await ensureSeedIntegrity(prisma, gameId);

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

  // ─── Idempotencia: si el mes actual ya tiene snapshot, es un duplicado ──
  // Compara igualdad exacta de año/mes. Si ya existe un snapshot para el
  // mes actual, otro request ya lo procesó → devolver estado sin reprocesar.
  if (latestSnapshot) {
    const alreadyProcessed =
      game.currentYear === latestSnapshot.year &&
      game.currentMonth === latestSnapshot.month;
    if (alreadyProcessed) {
      const existingState = buildGameState(
        game,
        latestMetrics as RegimeMetricsState | null,
        latestSnapshot as MonthSnapshotData | null,
        lawCatalogMap,
      );
      return {
        newState: existingState,
        monthSnapshot: latestSnapshot as MonthSnapshotData,
        notifications: [],
        gameOver: game.status === "FINISHED"
          ? { reason: "Juego terminado", finalApproval: latestSnapshot.approval, totalTurns: game.currentYear * 12 + game.currentMonth }
          : null,
        newEvents: [],
        mediaCoverages: [],
        mediaPolls: [],
        autoProposedLaws: [],
      };
    }
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
  const { newState, monthSnapshot, notifications, newEvents, mediaCoverages, mediaPolls, gameOver, autoProposedLaws } = output;

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

  // Merge de leyes propuestas por el jugador con auto-propuestas del motor
  const allProposedLaws = [
    ...(input.proposedLaws ?? []),
    ...(autoProposedLaws ?? []).filter((l) => !input.proposedLaws?.includes(l)),
  ];

  if (allProposedLaws.length > 0) {
    // Construir set de partidos beneficiados por compra de votos
    const rewardedPartyIds = input.voteBuyingPartyIds
      ? new Set(input.voteBuyingPartyIds)
      : new Set<string>();

    for (const lawKey of allProposedLaws) {
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

  // Promulgación: las leyes aprobadas que aún no están vigentes entran en vigor y
  // pagan su costo único (negativo = ingreso). Una ley ya vigente que se vuelve a
  // aprobar (p. ej. estado-emergencia auto-propuesto en cada brote) no se duplica
  // ni se cobra otra vez.
  const alreadyActiveKeys = new Set<string>(
    game.activeLaws.filter((al: Record<string, unknown>) => !al.repealedAt).map((al: Record<string, unknown>) => al.lawKey as string),
  );
  const enactedKeys: string[] = [];
  for (const r of lawResults) {
    if (r.approved && !alreadyActiveKeys.has(r.lawKey) && !enactedKeys.includes(r.lawKey)) {
      enactedKeys.push(r.lawKey);
    }
  }
  const enactment = resolveLawEnactments(enactedKeys, lawCatalogMap, newState.population);
  newState.treasury -= enactment.totalCost;
  monthSnapshot.treasury -= enactment.totalCost;

  // Persistir en transacción atómica
  await prisma.$transaction(
    (tx) => persistTurn(tx, { gameId, game, newYear, newMonth, newState, monthSnapshot, newEvents, mediaCoverages, lawResults, enactedKeys, gameOver }),
    getTransactionOptions(),
  );

  // Notificaciones de leyes con detalle bicameral
  const lawNotifications: TurnNotification[] = lawResults.map((r) => ({
    type: "law",
    title: r.approved ? "Ley aprobada" : "Ley rechazada",
    description: r.approved
      ? `La ley "${r.lawKey}" fue aprobada. Cámara Baja: ${r.lowerFor} a favor, ${r.lowerAgainst} en contra. Cámara Alta: ${r.upperFor} a favor, ${r.upperAgainst} en contra.`
      : `La ley "${r.lawKey}" fue rechazada. Cámara Baja: ${r.lowerFor} a favor, ${r.lowerAgainst} en contra. Cámara Alta: ${r.upperFor} a favor, ${r.upperAgainst} en contra.`,
  }));

  const fmtM = (n: number) => `M$ ${(Math.abs(n) / 1_000_000).toFixed(0)}`;
  const enactmentNotifications: TurnNotification[] = enactment.details.map((d) => ({
    type: "law",
    title: d.cost > 0 ? "Costo de promulgación" : "Ingreso por promulgación",
    description: d.cost > 0
      ? `Promulgar "${d.name}" costó ${fmtM(d.cost)} al tesoro (pago único).`
      : `Promulgar "${d.name}" ingresó ${fmtM(d.cost)} al tesoro (ingreso único).`,
  }));

  return {
    newState,
    monthSnapshot,
    notifications: [...notifications, ...lawNotifications, ...enactmentNotifications],
    newEvents,
    mediaCoverages,
    mediaPolls,
    gameOver,
    autoProposedLaws: autoProposedLaws ?? [],
  };
}
