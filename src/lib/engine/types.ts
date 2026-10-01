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
  gdp: number;
  povertyRate: number;
  unemploymentRate: number;
  sickRate: number;
  crimeRate: number;
  foodSecurity: number;
  educationLevel: number;
  inflation: number;
  lifeExpectancy: number;
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
  longRunningDecisions: LongRunningDecisionState[];
  programs: MinistryProgramState[];
  resourceStocks: ResourceStockState[];
  regions: RegionState[];
  diseases: DiseaseStateInput[];
  diseasePrevalences: DiseasePrevalenceStateInput[];
  diseaseMortality: number;
  consecutiveLowApprovalMonths: number;
  healthEfficiencyStreak: number;
  consecutiveSaturationMonths: Record<string, number>;
  sanctionsMultiplier: number;
  tradeGoods: TradeGoodState[];
  tradeFlows: TradeFlowState[];
  tradeBalance: number;
  totalImports: number;
  totalExports: number;
}

export interface ResourceStockState {
  id: string;
  resourceType: string;
  quantity: number;
}

export interface HealthCoveragePerLevel {
  facilities: number;
  beds: number;
  operationalCost: number;
}

export interface RegionState {
  id: string;
  name: string;
  type: string;
  populationPercent: number;
  povertyRate: number;
  infrastructureLevel: number;
  accessModifier: number;
  povertyModifier: number;
  healthCoverage: {
    primary: HealthCoveragePerLevel;
    secondary: HealthCoveragePerLevel;
    tertiary: HealthCoveragePerLevel;
  };
}

export interface MinistryState {
  id: string;
  key: string;
  budgetPercent: number;
  efficiency: number;
  internalCorruption: number;
  subDecisions: Record<string, number | boolean>;
  ministerOfficialId: string | null;
  producedResources: Record<string, number>;
  consumedResources: Record<string, number>;
  healthBudgetSplit: Record<string, number>;
}

export interface OfficialState {
  id: string;
  name: string;
  role: string;
  specialty: string | null;
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

export interface LongRunningDecisionState {
  id: string;
  type: string;
  name: string;
  monthsRemaining: number;
  totalMonths: number;
  monthlyCost: number;
  parameters: Record<string, unknown>;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  progressLog: string[];
  effectOnCompletion: Record<string, unknown>;
}

export interface DiseaseStateInput {
  id: string;
  name: string;
  category: string;
  contagionRate: number;
  mortalityRate: number;
  prevalence: number;
  prevalenceBase: number;
  hasVaccine: boolean;
  preventionSensitivity: number;
  monthlyCostPerPatient: number;
  classAffinity: Record<string, number>;
}

export interface DiseasePrevalenceStateInput {
  id: string;
  diseaseId: string;
  currentPrevalence: number;
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

/** Configuracion de fin de partida */
export interface GameOverConfig {
  electionIntervalYears: number;
  termLimit: number;
  consecutiveLowApprovalMonths: number;
}

/** Resultado de evaluar condiciones de fin de partida */
export interface GameOverResult {
  reason: "golpe_estado" | "juicio_politico" | "renuncia_forzada" | "perdida_electoral" | "fin_mandato" | "asesinato" | "estado_fallido" | "reeleccion";
  description: string;
  regimeType: string;
  approval: number;
  corruption: number;
  treasury: number;
  gdp: number;
  /** % de votos obtenidos (solo para perdida_electoral y reeleccion) */
  votePercent?: number;
  /** Desglose de votos por clase social (solo elecciones) */
  perClassVotes?: Record<string, number>;
}

// ─── Programas operativos de ministerios (Salud-3A Capa D) ──────────────────
// Programas persistentes (no requieren Senado): campañas de vacunación,
// prevención sanitaria, salud mental. El Ministro los activa/desactiva.
// Costo mensual descontado del tesoro.

export interface MinistryProgramState {
  id: string;
  type: "VACCINATION_CAMPAIGN" | "PREVENTION_EDUCATION" | "MENTAL_HEALTH_PROGRAM";
  /** diseaseId (vacunación), null para los demás tipos */
  parameters: Record<string, unknown>;
  monthlyCost: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  deactivatedAt: string | null;
}

// ─── Comercio Exterior (Salud-3B-i) ───────────────────────────────────────────
// Sistema genérico de bienes comerciables y flujos de importación/exportación.

export type TradeGoodCategory =
  | "MEDICAMENTS_GENERIC"
  | "MEDICAMENTS_BRAND";

export type TradeFlowDirection = "IMPORT" | "EXPORT";

export interface TradeGoodState {
  id: string;
  gameId: string;
  key: string;
  category: TradeGoodCategory;
  name: string;
  description: string | null;
  baseCostPerUnit: number;
  unitDescription: string;
  demandPerCapita: number;
}

export interface TradeFlowState {
  id: string;
  gameId: string;
  tradeGoodId: string;
  direction: TradeFlowDirection;
  monthlyVolume: number;
  targetVolume: number;
  unitCost: number;
  sanctionsMultiplier: number;
  monthlyCost: number;
  isActive: boolean;
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
  lifeExpectancy: number;
  activeLrdCount: number;
  lrdMonthlyCost: number;
  lrdCompletedThisMonth: number;
  lrdCancelledThisMonth: number;
  activeProgramsCount: number;
  programMonthlyCost: number;
  /** Historico de prevalencias por enfermedad (Salud-3A): [{diseaseId, name, category, prevalence}] */
  diseasePrevalences?: Array<{ diseaseId: string; name: string; category: string; prevalence: number }>;
  tradeBalance: number;
  totalImports: number;
  totalExports: number;
}

export interface TurnNotification {
  type: "event" | "warning" | "info" | "law" | "case" | "crisis";
  title: string;
  description: string;
  severity?: number;
}

export interface MediaCoverageData {
  id: string;
  mediaId: string;
  headline: string;
  sentiment: number;
  impactOnApproval: Record<string, number>;
}

export interface MediaPollData {
  mediaId: string;
  mediaName: string;
  approvalPoll: number;
  corruptionPoll: number;
  credibility: number;
  governmentAffinity: number;
}

// ─── Turn Input / Output ─────────────────────────────────────────────────────

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
  mediaActions?: Record<string, "censor" | "close" | "boost" | "restore" | "buyAffinity" | "none">;
  /** ¿El jugador ordenó investigar a alguien? officialId[] */
  investigations?: string[];
  /** IDs de partidos a los que el jugador ofrece beneficios a cambio de votos */
  voteBuyingPartyIds?: string[];
  /** IDs de candidatos a contratar (status CANDIDATE → ACTIVE) */
  hireCandidateIds?: string[];
  /** Cambios de titular de organismos existentes: organismId → officialId */
  organismHeadChanges?: Record<string, string>;
  /** IDs de organismos a disolver este mes */
  dissolveOrganismIds?: string[];
  /** IDs de LRD a cancelar este mes */
  cancelDecisionIds?: string[];
  /**
   * Nuevas LRD a iniciar este mes. Solo tipo y parámetros: el motor fija nombre,
   * duración y costo (el cliente no es de fiar) y rechaza lo inválido.
   * HOSPITAL_CONSTRUCTION: { regionId, level }. MEDICAL_RESEARCH: { diseaseIds } (1-2).
   */
  newLongRunningDecisions?: Array<{
    type: "HOSPITAL_CONSTRUCTION" | "MEDICAL_RESEARCH";
    parameters?: Record<string, unknown>;
  }>;
  /**
   * Nuevos programas operativos (Salud-3A). El costo lo fija el motor.
   * VACCINATION_CAMPAIGN: { diseaseId } de una enfermedad con vacuna.
   */
  newPrograms?: Array<{
    type: "VACCINATION_CAMPAIGN" | "PREVENTION_EDUCATION" | "MENTAL_HEALTH_PROGRAM";
    parameters?: Record<string, unknown>;
  }>;
  cancelProgramIds?: string[];
  /** Decisiones de comercio exterior: tradeFlowId → targetVolume */
  tradeFlowDecisions?: Record<string, { targetVolume: number }>;
}

export interface TurnOutput {
  newState: GameState;
  monthSnapshot: MonthSnapshotData;
  notifications: TurnNotification[];
  gameOver: GameOverResult | null;
  newEvents: EventState[];
  mediaCoverages: MediaCoverageData[];
  mediaPolls: MediaPollData[];
  autoProposedLaws: string[];
}
