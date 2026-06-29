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

export interface TurnInput {
  budgetAdjustments?: Record<string, number>;
  subDecisionChanges?: Record<string, Record<string, number | boolean>>;
  proposedLaws?: string[];
  newOrganisms?: Record<string, { name: string; monthlyBudget: number; headOfficialId?: string }>;
  mediaActions?: Record<string, string>;
  appointments?: Record<string, string>;
  hireCandidateIds?: string[];
  organismHeadChanges?: Record<string, string>;
  dissolveOrganismIds?: string[];
  newLongRunningDecisions?: Array<{
    type: string;
    name: string;
    totalMonths: number;
    monthlyCost: number;
    parameters?: Record<string, unknown>;
    effectOnCompletion?: Record<string, unknown>;
  }>;
  cancelDecisionIds?: string[];
  newPrograms?: Array<{
    type: "VACCINATION_CAMPAIGN" | "PREVENTION_EDUCATION" | "MENTAL_HEALTH_PROGRAM";
    parameters?: Record<string, unknown>;
    monthlyCost?: number;
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
  mediaCoverages: MediaCoverageData[];
  mediaPolls: MediaPollData[];
}

export interface GameOverResult {
  reason: string;
  finalApproval: number;
  totalTurns: number;
}
