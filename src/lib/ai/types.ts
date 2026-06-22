// ─── Tipos del módulo de IA narrativa ───────────────────────────────────────
// Tipos planos para el generador de narrativa. Independientes del motor.

export type AiProvider = "openai" | "anthropic" | "ollama";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface EventContext {
  countryName: string;
  year: number;
  month: number;
  eventType: string;
  severity: number;
  ministerName: string | null;
  ministerSkill: number;
  ministerCorruption: number;
  ministryEfficiency: number;
  ministryKey: string | null;
  population: number;
  treasury: number;
  gdp: number;
  povertyRate: number;
  unemploymentRate: number;
  sickRate: number;
  crimeRate: number;
  educationLevel: number;
  inflation: number;
}

export interface CoverageContext {
  countryName: string;
  year: number;
  month: number;
  mediaName: string;
  mediaType: string;
  governmentAffinity: number;
  reach: number;
  credibility: number;
  eventDescription: string;
  eventType: string;
  eventSeverity: number;
  sentiment: number;
}
