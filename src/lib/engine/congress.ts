// ─── Motor de votación del congreso ───────────────────────────────────────────
// Funciones puras: reciben objetos planos, devuelven objetos planos.
// Sin I/O, sin Prisma, sin base de datos. Totalmente testeable.
// Simula votaciones en cámara baja y alta, y evalúa mociones opositoras.

import type { SenatorState, PartyState, Ideology } from "./types";
import { BALANCE } from "../balance";
import { rollChance } from "../rng";

// ─── Interfaces exportadas ────────────────────────────────────────────────────

/** Resultado detallado de una votación en el congreso bicameral */
export interface VoteResult {
  lawKey: string;
  totalVotesFor: number;
  totalVotesAgainst: number;
  totalVotesAbstain: number;
  lowerVotesFor: number;
  lowerVotesAgainst: number;
  lowerVotesAbstain: number;
  upperVotesFor: number;
  upperVotesAgainst: number;
  upperVotesAbstain: number;
  approved: boolean;
  perParty: Record<string, { votesFor: number; votesAgainst: number; votesAbstain: number }>;
  perSenator: {
    senatorId: string;
    senatorName: string;
    vote: "for" | "against" | "abstain";
    score: number;
  }[];
}

/** Moción opositora generada por el congreso (censura o juicio político) */
export interface Motion {
  type: "censure_ministro" | "juicio_politico";
  targetOfficialId?: string;
  targetName?: string;
  probability: number;
  lowerVotesExpected: { for: number; against: number; abstain: number };
  upperVotesExpected: { for: number; against: number; abstain: number };
  willPass: boolean;
}

/** Estado mínimo necesario para evaluar mociones */
export interface MotionEvaluationState {
  officials: {
    id: string;
    name: string;
    role: string;
    corruption: number;
    status: string;
  }[];
  senators: SenatorState[];
  parties: PartyState[];
  generalApproval: number;
}

// ─── Ideología ────────────────────────────────────────────────────────────────

/**
 * Similitud coseno entre dos vectores ideológicos (economic, social, authority).
 * - Devuelve valor en [-1, 1] donde 1 = idénticos, 0 = ortogonales, -1 = opuestos.
 * - Si alguna de las dos normas es 0, retorna 0 (sin alineamiento definido).
 */
export function ideologySimilarity(a: Ideology, b: Record<string, number>): number {
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

// ─── Votación (núcleo interno) ────────────────────────────────────────────────

/**
 * Núcleo interno de simulación de votación bicameral.
 * Recibe el set de partidos recompensados por nombramientos pendientes
 * para aplicar el bono de +0.2 al score de senadores leales a esos partidos.
 */
function simulateVoteCore(
  senators: SenatorState[],
  parties: PartyState[],
  lawIdealIdeology: Record<string, number>,
  generalApproval: number,
  rewardedPartyIds: Set<string>,
): VoteResult {
  // Índice de partidos por id para búsqueda O(1)
  const partyMap = new Map<string, PartyState>();
  for (const p of parties) {
    partyMap.set(p.id, p);
  }

  // Normalizar aprobación a [-1, 1] donde 50 = 0
  const approvalInfluence = (generalApproval - 50) / 50;

  // Acumuladores por cámara
  let lowerFor = 0;
  let lowerAgainst = 0;
  let lowerAbstain = 0;
  let upperFor = 0;
  let upperAgainst = 0;
  let upperAbstain = 0;

  // Acumuladores por partido
  const perParty: Record<string, { votesFor: number; votesAgainst: number; votesAbstain: number }> = {};
  for (const p of parties) {
    perParty[p.id] = { votesFor: 0, votesAgainst: 0, votesAbstain: 0 };
  }

  // Detalle por senador
  const perSenator: VoteResult["perSenator"] = [];

  for (const senator of senators) {
    const party = partyMap.get(senator.partyId);

    // 1. Alineamiento ideológico personal con la ley [-1, 1]
    const alignment = ideologySimilarity(senator.personalIdeology, lawIdealIdeology);

    // 2. Alineamiento del partido con la ley, ponderado por lealtad del senador
    //    partyInfluence = signo(partyAlignment) * (loyalty / 100)
    //    Esto hace que senadores leales sigan la línea del partido,
    //    mientras que los desleales votan más por convicción personal.
    let partyInfluence = 0;
    if (party) {
      const partyAlignment = ideologySimilarity(party.ideology, lawIdealIdeology);
      partyInfluence = Math.sign(partyAlignment) * (senator.loyalty / 100);
    }

    // 3. Score compuesto con pesos de balance definidos en lib/balance.ts
    let score =
      alignment * BALANCE.SENATE_IDEOLOGY_WEIGHT +
      partyInfluence * BALANCE.SENATE_PARTY_LOYALTY_WEIGHT +
      approvalInfluence * BALANCE.SENATE_APPROVAL_WEIGHT;

    // 4. Bono por nombramientos pendientes que beneficien al partido del senador
    //    Si el ejecutivo está nombrando a alguien del mismo partido, los
    //    senadores de ese partido tienden a apoyar las leyes (+0.2 al score).
    if (rewardedPartyIds.has(senator.partyId)) {
      score += 0.2;
    }

    // Determinar voto según umbrales de score:
    //   score >  0.05 → A FAVOR
    //   score < -0.05 → EN CONTRA
    //   resto        → ABSTENCIÓN
    let vote: "for" | "against" | "abstain";
    if (score > 0.05) {
      vote = "for";
    } else if (score < -0.05) {
      vote = "against";
    } else {
      vote = "abstain";
    }

    // Acumular por cámara
    if (senator.chamber === "LOWER") {
      if (vote === "for") lowerFor++;
      else if (vote === "against") lowerAgainst++;
      else lowerAbstain++;
    } else {
      if (vote === "for") upperFor++;
      else if (vote === "against") upperAgainst++;
      else upperAbstain++;
    }

    // Acumular por partido
    if (party && perParty[senator.partyId]) {
      if (vote === "for") perParty[senator.partyId].votesFor++;
      else if (vote === "against") perParty[senator.partyId].votesAgainst++;
      else perParty[senator.partyId].votesAbstain++;
    }

    // Registrar voto individual
    perSenator.push({
      senatorId: senator.id,
      senatorName: senator.name,
      vote,
      score: Math.round(score * 1000) / 1000,
    });
  }

  // Mayoría simple en cada cámara: votos a favor > votos en contra
  const lowerApproved = lowerFor > lowerAgainst;
  const upperApproved = upperFor > upperAgainst;
  // La ley se aprueba solo si gana en AMBAS cámaras
  const approved = lowerApproved && upperApproved;

  return {
    lawKey: "", // Será asignado por el caller
    totalVotesFor: lowerFor + upperFor,
    totalVotesAgainst: lowerAgainst + upperAgainst,
    totalVotesAbstain: lowerAbstain + upperAbstain,
    lowerVotesFor: lowerFor,
    lowerVotesAgainst: lowerAgainst,
    lowerVotesAbstain: lowerAbstain,
    upperVotesFor: upperFor,
    upperVotesAgainst: upperAgainst,
    upperVotesAbstain: upperAbstain,
    approved,
    perParty,
    perSenator,
  };
}

// ─── Votación (API pública) ───────────────────────────────────────────────────

/**
 * Simula la votación de una ley en el congreso bicameral.
 * Cada senador decide su voto basándose en:
 *   1. Afinidad ideológica personal con la ley
 *   2. Influencia del partido (alineamiento del partido × lealtad del senador)
 *   3. Aprobación general del gobierno (como termómetro de presión popular)
 *   4. Bono por nombramientos pendientes que beneficien a su partido
 *
 * La ley se aprueba si tiene mayoría simple (votos a favor > votos en contra)
 * en AMBAS cámaras.
 *
 * @param senators - Lista de senadores con ideología personal y cámara
 * @param parties - Lista de partidos con ideología y bancas
 * @param lawIdealIdeology - Vector ideológico ideal de la ley
 * @param generalApproval - Aprobación general del gobierno [0, 100]
 * @param rewardedPartyIds - Set de IDs de partidos beneficiados por nombramientos
 *   pendientes. Senadores de estos partidos reciben +0.2 al score de votación.
 * @returns Resultado completo de la votación
 */
export function simulateSenateVote(
  senators: SenatorState[],
  parties: PartyState[],
  lawIdealIdeology: Record<string, number>,
  generalApproval: number,
  rewardedPartyIds?: Set<string>,
): VoteResult {
  return simulateVoteCore(
    senators,
    parties,
    lawIdealIdeology,
    generalApproval,
    rewardedPartyIds ?? new Set(),
  );
}

// ─── Mociones opositoras ──────────────────────────────────────────────────────

/**
 * Evalúa si la oposición lanza mociones de censura a ministros o
 * juicio político al ejecutivo, basándose en correlación de fuerzas
 * en el congreso, aprobación general y corrupción ministerial.
 *
 * Censura a ministro:
 *   - Oposición > 50% en ambas cámaras
 *   - Aprobación general < 40
 *   - Ministros con corrupción > 50 y estado ACTIVE
 *   - Probabilidad: 8% mensual por ministro corrupto
 *
 * Juicio político:
 *   - Oposición con supermayoría (>66%) en ambas cámaras
 *   - Aprobación general < 20
 *   - Probabilidad: 5% mensual
 *
 * @param state - Estado parcial con officials, senadores, partidos y aprobación
 * @param rng - Función generadora de números aleatorios determinista
 * @returns Lista de mociones generadas este mes
 */
export function evaluateMotions(
  state: MotionEvaluationState,
  rng: () => number,
): Motion[] {
  const motions: Motion[] = [];
  const { officials, senators, parties, generalApproval } = state;

  // ── Determinar el partido oficialista (mayor cantidad de bancas totales) ──
  let rulingPartyId: string | null = null;
  let maxSeats = 0;
  for (const p of parties) {
    const totalSeats = p.seatsLower + p.seatsUpper;
    if (totalSeats > maxSeats) {
      maxSeats = totalSeats;
      rulingPartyId = p.id;
    }
  }

  // Calcular totales por cámara para porcentajes
  const totalLower = parties.reduce((s, p) => s + p.seatsLower, 0);
  const totalUpper = parties.reduce((s, p) => s + p.seatsUpper, 0);

  /**
   * Calcula el porcentaje de bancas de oposición en cada cámara
   * excluyendo las bancas de un partido específico.
   */
  function oppositionStrength(excludePartyId: string): {
    lowerPct: number;
    upperPct: number;
  } {
    let oppLower = 0;
    let oppUpper = 0;
    for (const p of parties) {
      if (p.id !== excludePartyId) {
        oppLower += p.seatsLower;
        oppUpper += p.seatsUpper;
      }
    }
    return {
      lowerPct: totalLower > 0 ? (oppLower / totalLower) * 100 : 0,
      upperPct: totalUpper > 0 ? (oppUpper / totalUpper) * 100 : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Censura a ministro
  // ═══════════════════════════════════════════════════════════════════════

  const corruptMinisters = officials.filter(
    (o) =>
      o.role === "MINISTER" &&
      o.status === "ACTIVE" &&
      o.corruption > 50,
  );

  for (const minister of corruptMinisters) {
    // Determinar el partido del ministro.
    // Si el official tiene partyId lo usamos; si no, asumimos el oficialismo.
    const ministerPartyId = (minister as { partyId?: string }).partyId ?? rulingPartyId;
    if (!ministerPartyId) continue;

    const { lowerPct, upperPct } = oppositionStrength(ministerPartyId);

    // Condiciones: oposición > 50% en ambas cámaras, aprobación < 40
    if (lowerPct > 50 && upperPct > 50 && generalApproval < 40) {
      // Probabilidad base: 8% mensual por ministro corrupto
      const prob = 0.08;
      if (rollChance(rng, prob)) {
        const voteResult = simulateSenateVote(
          senators,
          parties,
          { economic: 0, social: 0, authority: 0 },
          generalApproval,
        );

        motions.push({
          type: "censure_ministro",
          targetOfficialId: minister.id,
          targetName: minister.name,
          probability: prob,
          lowerVotesExpected: {
            for: voteResult.lowerVotesFor,
            against: voteResult.lowerVotesAgainst,
            abstain: voteResult.lowerVotesAbstain,
          },
          upperVotesExpected: {
            for: voteResult.upperVotesFor,
            against: voteResult.upperVotesAgainst,
            abstain: voteResult.upperVotesAbstain,
          },
          willPass: voteResult.approved,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Juicio político
  // ═══════════════════════════════════════════════════════════════════════

  if (rulingPartyId) {
    const { lowerPct, upperPct } = oppositionStrength(rulingPartyId);

    // Condiciones: oposición con supermayoría (>66%) en ambas cámaras
    // y aprobación general < 20
    if (lowerPct > 66 && upperPct > 66 && generalApproval < 20) {
      // Probabilidad base: 5% mensual
      const prob = 0.05;
      if (rollChance(rng, prob)) {
        const voteResult = simulateSenateVote(
          senators,
          parties,
          { economic: 0, social: 0, authority: 0 },
          generalApproval,
        );

        motions.push({
          type: "juicio_politico",
          probability: prob,
          lowerVotesExpected: {
            for: voteResult.lowerVotesFor,
            against: voteResult.lowerVotesAgainst,
            abstain: voteResult.lowerVotesAbstain,
          },
          upperVotesExpected: {
            for: voteResult.upperVotesFor,
            against: voteResult.upperVotesAgainst,
            abstain: voteResult.upperVotesAbstain,
          },
          willPass: voteResult.approved,
        });
      }
    }
  }

  return motions;
}
