"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { simulateSenateVote } from "@/lib/engine/congress";
import type {
  SenatorState,
  PartyState,
  LawCatalogEntry,
  Ideology,
} from "@/lib/engine/types";

async function verifyOwnership(gameId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true },
  });
  if (!game || game.userId !== session.user.id) {
    throw new Error("No tienes acceso a esta partida.");
  }
  return session.user.id;
}

// ─── Tipos para la UI ─────────────────────────────────────────────────────

/** Resultado de simulación de voto formateado para la UI del congreso */
export interface SimulateVoteResult {
  lower: { for: number; against: number; abstain: number; total: number };
  upper: { for: number; against: number; abstain: number; total: number };
  overallApproved: boolean;
  perPartyLower: Record<string, { for: number; against: number; abstain: number; total: number }>;
  perPartyUpper: Record<string, { for: number; against: number; abstain: number; total: number }>;
}

/** Propuesta de ley histórica para la tabla del congreso */
export interface LawProposalData {
  id: string;
  lawKey: string;
  proposedAt: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  resolvedAt: string | null;
}

/** Datos completos del congreso para la UI */
export interface CongressData {
  parties: PartyState[];
  senators: SenatorState[];
  activeLaws: { id: string; lawKey: string; activatedAt: string }[];
  lawProposals: LawProposalData[];
  lawCatalog: LawCatalogEntry[];
  officials: {
    id: string;
    name: string;
    role: string;
    partyId: string | null;
    corruption: number;
    status: string;
  }[];
  approval: number;
  currentYear: number;
  currentMonth: number;
}

// ─── Utilidades de mapeo ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asIdeology(raw: any): Ideology {
  const obj = raw as Record<string, unknown> | null | undefined;
  return {
    economic: (obj?.economic as number) ?? 0,
    social: (obj?.social as number) ?? 0,
    authority: (obj?.authority as number) ?? 0,
  };
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Simula la votación de una ley específica en el congreso.
 * Obtiene los datos del juego (senadores, partidos, aprobación) y del catálogo
 * de leyes, ejecuta la simulación pura y devuelve el resultado detallado.
 *
 * @param gameId - ID del juego activo
 * @param lawKey - Clave de la ley en el catálogo (LawCatalog.key)
 * @returns VoteResult con el desglose completo de la votación
 * @throws Error si la ley no existe en el catálogo
 */
export async function simulateVoteAction(
  gameId: string,
  lawKey: string,
): Promise<SimulateVoteResult> {
  await verifyOwnership(gameId);

  // Obtener juego con senadores y partidos, catálogo de ley y último snapshot
  const [game, lawCatalogEntry, latestSnapshot] = await Promise.all([
    prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: {
        parties: true,
        senators: true,
      },
    }),
    prisma.lawCatalog.findUnique({
      where: { key: lawKey },
    }),
    prisma.monthSnapshot.findFirst({
      where: { gameId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!lawCatalogEntry) {
    throw new Error(`No se encontró la ley con clave "${lawKey}" en el catálogo.`);
  }

  // Mapear partidos a tipos planos y construir mapa id → nombre
  const parties: PartyState[] = game.parties.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    ideology: asIdeology(p.ideology),
    leaderOfficialId: p.leaderOfficialId as string | null,
    popularity: p.popularity as number,
    seatsLower: p.seatsLower as number,
    seatsUpper: p.seatsUpper as number,
  }));

  const partyIdToName = new Map<string, string>();
  for (const p of parties) {
    partyIdToName.set(p.id, p.name);
  }

  // Mapear senadores a tipos planos
  const senators: SenatorState[] = game.senators.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    partyId: s.partyId as string,
    name: s.name as string,
    personalIdeology: asIdeology(s.personalIdeology),
    chamber: s.chamber as "LOWER" | "UPPER",
    loyalty: s.loyalty as number,
  }));

  // Ideología ideal de la ley desde el catálogo
  const lawIdealIdeology = asIdeology(lawCatalogEntry.idealIdeology);

  // Aprobación general desde el último snapshot (o valor por defecto)
  const generalApproval = (latestSnapshot?.approval as number) ?? 50;

  // Ejecutar simulación pura
  const result = simulateSenateVote(
    senators,
    parties,
    lawIdealIdeology as unknown as Record<string, number>,
    generalApproval,
  );

  result.lawKey = lawKey;

  // Transformar al formato esperado por la UI
  // perParty del motor está indexado por partyId; la UI espera partyName
  const perPartyLower: Record<string, { for: number; against: number; abstain: number; total: number }> = {};
  const perPartyUpper: Record<string, { for: number; against: number; abstain: number; total: number }> = {};

  for (const [partyId, counts] of Object.entries(result.perParty)) {
    const name = partyIdToName.get(partyId) ?? partyId;
    perPartyLower[name] = {
      for: counts.votesFor,
      against: counts.votesAgainst,
      abstain: counts.votesAbstain,
      total: counts.votesFor + counts.votesAgainst + counts.votesAbstain,
    };
    perPartyUpper[name] = {
      for: counts.votesFor,
      against: counts.votesAgainst,
      abstain: counts.votesAbstain,
      total: counts.votesFor + counts.votesAgainst + counts.votesAbstain,
    };
  }

  return {
    lower: {
      for: result.lowerVotesFor,
      against: result.lowerVotesAgainst,
      abstain: result.lowerVotesAbstain,
      total: result.lowerVotesFor + result.lowerVotesAgainst + result.lowerVotesAbstain,
    },
    upper: {
      for: result.upperVotesFor,
      against: result.upperVotesAgainst,
      abstain: result.upperVotesAbstain,
      total: result.upperVotesFor + result.upperVotesAgainst + result.upperVotesAbstain,
    },
    overallApproved: result.approved,
    perPartyLower,
    perPartyUpper,
  };
}

/**
 * Obtiene todos los datos del congreso para mostrarlos en la interfaz.
 * Incluye partidos, senadores, leyes activas, propuestas de ley históricas,
 * catálogo completo de leyes y el snapshot mensual más reciente.
 *
 * @param gameId - ID del juego activo
 * @returns Objeto plano con todos los datos del congreso
 */
export async function getCongressData(gameId: string): Promise<CongressData> {
  await verifyOwnership(gameId);

  const [game, lawCatalog, latestSnapshot] = await Promise.all([
    prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: {
        parties: true,
        senators: true,
        activeLaws: true,
        lawProposals: {
          orderBy: { proposedAt: "desc" },
        },
        officials: {
          where: {
            role: { in: ["MINISTER", "JUDGE", "PROSECUTOR", "GENERAL"] },
          },
        },
      },
    }),
    prisma.lawCatalog.findMany(),
    prisma.monthSnapshot.findFirst({
      where: { gameId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  // Serializar partidos
  const parties: PartyState[] = game.parties.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    ideology: asIdeology(p.ideology),
    leaderOfficialId: p.leaderOfficialId as string | null,
    popularity: p.popularity as number,
    seatsLower: p.seatsLower as number,
    seatsUpper: p.seatsUpper as number,
  }));

  // Serializar senadores
  const senators: SenatorState[] = game.senators.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    partyId: s.partyId as string,
    name: s.name as string,
    personalIdeology: asIdeology(s.personalIdeology),
    chamber: s.chamber as "LOWER" | "UPPER",
    loyalty: s.loyalty as number,
  }));

  // Serializar leyes activas (convertir fechas a ISO)
  const activeLaws = game.activeLaws.map((al: Record<string, unknown>) => ({
    id: al.id as string,
    lawKey: al.lawKey as string,
    activatedAt: (al.activatedAt as Date).toISOString(),
  }));

  // Serializar propuestas de ley históricas (convertir fechas a ISO)
  const lawProposals = game.lawProposals.map((lp: Record<string, unknown>) => ({
    id: lp.id as string,
    lawKey: lp.lawKey as string,
    proposedAt: (lp.proposedAt as Date).toISOString(),
    status: lp.status as string,
    votesFor: lp.votesFor as number,
    votesAgainst: lp.votesAgainst as number,
    votesAbstain: lp.votesAbstain as number,
    resolvedAt: lp.resolvedAt ? (lp.resolvedAt as Date).toISOString() : null,
  }));

  // Serializar catálogo de leyes
  const lawCatalogEntries: LawCatalogEntry[] = lawCatalog.map((lc: Record<string, unknown>) => ({
    key: lc.key as string,
    name: lc.name as string,
    description: lc.description as string,
    effectsJson: lc.effectsJson as Record<string, unknown>,
    idealIdeology: asIdeology(lc.idealIdeology),
    cost: lc.cost as number,
  }));

  // Serializar funcionarios relevantes para el congreso
  const officials = game.officials.map((o: Record<string, unknown>) => ({
    id: o.id as string,
    name: o.name as string,
    role: o.role as string,
    partyId: o.partyId as string | null,
    corruption: o.corruption as number,
    status: o.status as string,
  }));

  return {
    parties,
    senators,
    activeLaws,
    lawProposals,
    lawCatalog: lawCatalogEntries,
    officials,
    approval: (latestSnapshot?.approval as number) ?? 50,
    currentYear: game.currentYear as number,
    currentMonth: game.currentMonth as number,
  };
}
