// ─── Generador principal de narrativa IA ─────────────────────────────────────
// Orquesta la generación de texto enriquecido para eventos y coberturas.
// Delega en el cliente LLM y expone helpers para los Server Actions.

import { getAiClient } from "./client";
import { isAiAvailable } from "./config";
import { BALANCE } from "../balance";

export function getEventMaxTokens(): number {
  return BALANCE.AI_EVENT_MAX_TOKENS;
}

export function getCoverageMaxTokens(): number {
  return BALANCE.AI_COVERAGE_MAX_TOKENS;
}

export async function generateNarrative(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string | null> {
  if (!isAiAvailable()) return null;

  const client = getAiClient();
  if (!client) return null;

  try {
    const narrative = await client.generate(systemPrompt, userPrompt, maxTokens);
    const trimmed = narrative.trim();
    return trimmed || null;
  } catch (error) {
    console.error(
      "[AI] Error generando narrativa:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
