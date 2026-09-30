// ─── Pool de candidatos naturales ────────────────────────────────────────
// Cada 6 meses se generan 1-3 nuevos funcionarios (candidatos) con status
// CANDIDATE, que el jugador puede contratar pagando un costo.
// Los candidatos expiran a los 6 meses si no se contratan.
// La cantidad y calidad depende del nivel educativo del pais.

import type { GameState, OfficialState } from "./types";
import { BALANCE } from "../balance";
import type { Ideology } from "./types";

const ROLES = ["JUDGE", "PROSECUTOR", "JUDGE", "PROSECUTOR", "MINISTER", "GENERAL"];

const NOMBRES_CANDIDATOS = [
  "Alberto Morgado Ruiz", "Blanca Espinoza Leyva", "Cesar Tamayo Peña",
  "Diana Fuentes Prado", "Esteban Cardenas Rojas", "Florencia Ibarra Diaz",
  "Gerardo Luna Vega", "Hilda Serrano Paz", "Ivan Montejo Lira",
  "Julia Oquendo Mora", "Kevin Padilla Leon", "Laura Quintero Sierra",
  "Mario Roldan Felix", "Nadia Salinas Toro", "Oscar Urbina Casas",
  "Patricia Valdes Hoyos", "Raul Zamudio Nieto", "Sofia Arriaga Campo",
  "Tomas Bello Cerda", "Ursula Carranza Davila",
];

export function generateCandidates(
  state: GameState,
  rng: () => number
): OfficialState[] {
  // Solo cada 6 meses
  const totalMonths = (state.currentYear - 1) * 12 + state.currentMonth;
  if (totalMonths <= 0 || totalMonths % 6 !== 0) return [];

  const educationLevel = state.educationLevel;

  // Cantidad segun educacion
  let count: number;
  if (educationLevel > 70) {
    count = 2 + Math.floor(rng() * 2); // 2-3
  } else if (educationLevel >= 40) {
    count = 1 + Math.floor(rng() * 2); // 1-2
  } else {
    count = Math.floor(rng() * 2); // 0-1
  }

  if (count === 0) return [];

  const candidates: OfficialState[] = [];
  const transparency = state.regimeMetrics.transparency;

  for (let i = 0; i < count; i++) {
    const role = ROLES[Math.floor(rng() * ROLES.length)];
    const name = NOMBRES_CANDIDATOS[Math.floor(rng() * NOMBRES_CANDIDATOS.length)];

    // Skill base + bonus por educacion
    const skill = Math.min(95, Math.round(
      40 + rng() * 20 + (educationLevel / 100) * BALANCE.CANDIDATE_EDUCATION_SKILL_BONUS
    ));

    // Corrupcion inicial: menor si hay transparencia alta
    const baseCorruption = 5 + rng() * 15;
    const transparencyBonus = (transparency / 100) * BALANCE.CANDIDATE_TRANSPARENCY_REDUCTION;
    const corruption = Math.max(1, Math.round(baseCorruption - transparencyBonus));

    const loyalty = Math.round(40 + rng() * 30);

    const ideology: Ideology = {
      economic: Math.round((rng() - 0.5) * 100),
      social: Math.round((rng() - 0.5) * 100),
      authority: Math.round((rng() - 0.5) * 100),
    };

    candidates.push({
      id: `cand-${state.currentYear}-${state.currentMonth}-${i}`,
      name,
      role,
      specialty: null,
      ministryId: null,
      partyId: null,
      loyalty,
      ambition: Math.round(20 + rng() * 40),
      wealth: Math.round(50000 + rng() * 100000),
      ideology,
      corruption,
      skill,
      reputation: Math.round(40 + rng() * 30),
      status: "CANDIDATE",
    });
  }

  return candidates;
}

/**
 * Elimina candidatos que hayan expirado (mas de CANDIDATE_EXPIRATION_MONTHS meses).
 * Se llama en cada turno; los candidatos vencidos simplemente se filtran fuera.
 */
export function expireCandidates(officials: OfficialState[]): OfficialState[] {
  // Los candidatos expiran implicitamente — el motor los elimina
  // cuando su status sigue siendo CANDIDATE y pasaron mas de 6 meses.
  // Como el ID contiene el year/month de creacion, calculamos la antiguedad.
  return officials.filter((o) => {
    if (o.status !== "CANDIDATE") return true;
    const parts = o.id.split("-");
    if (parts.length < 3) return true;
    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month)) return true;
    const ageMonths = (state_currentYear(year, month) ?? 999);
    return true; // La caducidad real se maneja en processTurn con el GameState
  });
}

function calculateAgeMonths(
  candidateYear: number,
  candidateMonth: number,
  currentYear: number,
  currentMonth: number
): number {
  return (currentYear - candidateYear) * 12 + (currentMonth - candidateMonth);
}

/**
 * Filtra los oficiales, eliminando candidatos expirados.
 * Retorna el array filtrado (sin los expirados).
 */
export function removeExpiredCandidates(
  officials: OfficialState[],
  currentYear: number,
  currentMonth: number
): OfficialState[] {
  const threshold = BALANCE.CANDIDATE_EXPIRATION_MONTHS;

  return officials.filter((o) => {
    if (o.status !== "CANDIDATE") return true;
    const parts = o.id.split("-");
    if (parts.length < 3) return false;
    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month)) return false;
    const age = calculateAgeMonths(year, month, currentYear, currentMonth);
    return age < threshold;
  });
}

function state_currentYear(year: number, month: number): number {
  return year * 12 + month;
}
