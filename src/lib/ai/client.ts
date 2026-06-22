// ─── Cliente LLM abstracto ──────────────────────────────────────────────────
// Soporta OpenAI, Anthropic y Ollama via fetch() nativo (sin dependencias npm).
// Cada proveedor implementa la interfaz AiClient con generate().

import type { AiConfig } from "./types";
import { BALANCE } from "../balance";
import { getAiConfig } from "./config";

export interface AiClient {
  generate(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string>;
}

function createOpenAiClient(config: AiConfig): AiClient {
  return {
    async generate(systemPrompt, userPrompt, maxTokens) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BALANCE.AI_TIMEOUT_MS);

      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature: BALANCE.AI_TEMPERATURE,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`OpenAI error ${res.status}: ${body}`);
        }

        const json = (await res.json()) as {
          choices: { message: { content: string } }[];
        };
        return json.choices[0].message.content;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

function createAnthropicClient(config: AiConfig): AiClient {
  return {
    async generate(systemPrompt, userPrompt, maxTokens) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BALANCE.AI_TIMEOUT_MS);

      try {
        const res = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            max_tokens: maxTokens,
            temperature: BALANCE.AI_TEMPERATURE,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Anthropic error ${res.status}: ${body}`);
        }

        const json = (await res.json()) as {
          content: { text: string }[];
        };
        return json.content[0].text;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

function createOllamaClient(config: AiConfig): AiClient {
  return {
    async generate(systemPrompt, userPrompt, maxTokens) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BALANCE.AI_TIMEOUT_MS);

      try {
        const res = await fetch(`${config.baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            prompt: `${systemPrompt}\n\n${userPrompt}`,
            stream: false,
            options: {
              num_predict: maxTokens,
              temperature: BALANCE.AI_TEMPERATURE,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Ollama error ${res.status}: ${body}`);
        }

        const json = (await res.json()) as { response: string };
        return json.response;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

let cachedClient: AiClient | null | undefined = undefined;

export function getAiClient(): AiClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const config = getAiConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }

  switch (config.provider) {
    case "openai":
      cachedClient = createOpenAiClient(config);
      break;
    case "anthropic":
      cachedClient = createAnthropicClient(config);
      break;
    case "ollama":
      cachedClient = createOllamaClient(config);
      break;
    default:
      cachedClient = null;
  }

  return cachedClient;
}
