import { BALANCE } from "../balance";
import type { AiConfig, AiProvider } from "./types";

let cachedConfig: AiConfig | null | undefined = undefined;

export function getAiConfig(): AiConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  if (!BALANCE.AI_ENABLED) {
    cachedConfig = null;
    return null;
  }

  const provider = (process.env.AI_PROVIDER ?? "none") as AiProvider;
  if (provider !== "openai" && provider !== "anthropic" && provider !== "ollama") {
    cachedConfig = null;
    return null;
  }

  let apiKey: string | undefined;
  let baseUrl: string;

  switch (provider) {
    case "openai":
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = "https://api.openai.com/v1";
      break;
    case "anthropic":
      apiKey = process.env.ANTHROPIC_API_KEY;
      baseUrl = "https://api.anthropic.com";
      break;
    case "ollama":
      baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      break;
    default:
      cachedConfig = null;
      return null;
  }

  if (provider !== "ollama" && !apiKey) {
    cachedConfig = null;
    return null;
  }

  const defaultModel =
    provider === "openai"
      ? "gpt-4o-mini"
      : provider === "anthropic"
        ? "claude-3-haiku-20240307"
        : "llama3";

  cachedConfig = {
    provider,
    apiKey: apiKey ?? "",
    model: process.env.AI_MODEL || defaultModel,
    baseUrl,
  };

  return cachedConfig;
}

export function isAiAvailable(): boolean {
  return getAiConfig() !== null;
}
