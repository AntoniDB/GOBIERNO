// ─── Tipos planos del motor de cálculo ──────────────────────────────────────
// Estos tipos son independientes de Prisma. El motor recibe y devuelve
// objetos planos, haciéndolo puro, testeable y serializable.

export interface GameState {
  countryName: string;
  currentYear: number;
  currentMonth: number;
  treasury: number;
  population: number;
  seed: string;
  ministries: MinistryState[];
  officials: OfficialState[];
  parties: PartyState[];
  senators: SenatorState[];
  activeLaws: ActiveLawState[];
  judicialCases: JudicialCaseState[];
  organisms: OrganismState[];
  socialClasses: SocialClassState[];
  regimeMetrics: RegimeMetricsState;
  media: MediaState[];
  events: EventState[];
}

export interface MinistryState {
  id: string;
  key: string;
  budgetPercent: number;
  efficiency: number;
  internalCorruption: number;
  subDecisions: Record<string, number | boolean>;
  ministerOfficialId: string | null;
}

export interface OfficialState {
  id: string;
  name: string;
  role: string;
  ministryId: string | null;
  partyId: string | null;
  loyalty: number;
  ambition: number;
  wealth: number;
  ideology: Ideology;
  corruption: number;
  skill: number;
  reputation: number;
  status: string;
}

export interface PartyState {
  id: string;
  name: string;
  ideology: Ideology;
  leaderOfficialId: string | null;
  popularity: number;
  seatsLower: number;
  seatsUpper: number;
}

export interface SenatorState {
  id: string;
  partyId: string;
  name: string;
  personalIdeology: Ideology;
  chamber: "LOWER" | "UPPER";
  loyalty: number;
}

export interface ActiveLawState {
  id: string;
  lawKey: string;
  activatedAt: string;
  effectsJson: Record<string, unknown>;
}

export interface JudicialCaseState {
  id: string;
  defendantOfficialId: string;
  caseType: string;
  currentPhase: string;
  monthsInPhase: number;
  evidenceStrength: number;
  prosecutorId: string | null;
  judgeId: string | null;
  verdict: string | null;
  sentenceMonths: number | null;
}

export interface OrganismState {
  id: string;
  type: string;
  name: string;
  monthlyBudget: number;
  staff: number;
  effectiveness: number;
  autonomyLevel: number;
  headOfficialId: string | null;
}

export interface SocialClassState {
  id: string;
  key: string;
  populationPercent: number;
  averageIncome: number;
  approval: number;
  demands: string[];
  educationLevel: number;
  healthAccess: number;
}

export interface RegimeMetricsState {
  powerConcentration: number;
  pressFreedom: number;
  judicialIndependence: number;
  politicalPluralism: number;
  civilLiberties: number;
  transparency: number;
  militarySubordination: number;
}

export interface MediaState {
  id: string;
  name: string;
  type: string;
  ideologicalAffinity: Ideology;
  reach: number;
  credibility: number;
  governmentAffinity: number;
  status: string;
}

export interface EventState {
  id: string;
  type: string;
  severity: number;
  year: number;
  month: number;
  description: string;
  effectsApplied: Record<string, unknown>;
  resolvedAt: string | null;
}

export interface LawCatalogEntry {
  key: string;
  name: string;
  description: string;
  effectsJson: Record<string, unknown>;
  idealIdeology: Ideology;
  cost: number;
}

export interface Ideology {
  economic: number;
  social: number;
  authority: number;
}

/** Entrada del jugador al avanzar el mes */
export interface TurnInput {
  /** Ajustes de presupuesto por ministerio key → nuevo % */
  budgetAdjustments?: Record<string, number>;
  /** Sub-decisiones modificadas por ministerio key → { key: value } */
  subDecisionChanges?: Record<string, Record<string, number | boolean>>;
  /** Leyes propuestas este mes (keys del catálogo) */
  proposedLaws?: string[];
  /** Nombramientos: role → officialId */
  appointments?: Record<string, string>;
  /** Organismos creados: type → { name, budget, headOfficialId } */
  newOrganisms?: Record<string, { name: string; monthlyBudget: number; headOfficialId?: string }>;
  /** Acciones sobre medios: mediaId → acción */
  mediaActions?: Record<string, "censor" | "close" | "boost" | "none">;
  /** ¿El jugador ordenó investigar a alguien? officialId[] */
  investigations?: string[];
}

/** Resultado de procesar un turno */
export interface TurnOutput {
  newState: GameState;
  monthSnapshot: MonthSnapshotData;
  notifications: TurnNotification[];
  newEvents: EventState[];
  mediaCoverages: MediaCoverageData[];
}

export interface MonthSnapshotData {
  year: number;
  month: number;
  treasury: number;
  gdp: number;
  population: number;
  approval: number;
  corruption: number;
  povertyRate: number;
  unemploymentRate: number;
  sickRate: number;
  crimeRate: number;
  foodSecurity: number;
  educationLevel: number;
  inflation: number;
  gini: number;
  regimeType: string;
  regimeMetrics: RegimeMetricsState;
}

export interface TurnNotification {
  type: "event" | "warning" | "info" | "law" | "case" | "crisis";
  title: string;
  description: string;
  severity?: number;
}

export interface MediaCoverageData {
  mediaId: string;
  headline: string;
  sentiment: number;
  impactOnApproval: Record<string, number>;
}
