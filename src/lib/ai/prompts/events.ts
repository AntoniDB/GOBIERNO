// ─── Prompt builder para eventos ─────────────────────────────────────────────
// Construye los prompts system/user para que el LLM genere una crónica
// narrativa en español a partir de los datos estructurados del evento.

import type { EventState, GameState } from "@/lib/engine/types";

const MINISTRY_FOR_EVENT: Record<string, string> = {
  EPIDEMIC: "HEALTH",
  SCANDAL: "JUSTICE",
  PROTEST: "SOCIAL_DEVELOPMENT",
  CRIME_SURGE: "SECURITY",
  COUP_ATTEMPT: "DEFENSE",
  DISASTER: "AGRICULTURE",
  ECONOMIC_CRISIS: "ECONOMY",
};

const EVENT_LABEL: Record<string, string> = {
  EPIDEMIC: "una epidemia",
  SCANDAL: "un escándalo de corrupción",
  PROTEST: "protestas masivas",
  CRIME_SURGE: "una ola de criminalidad",
  COUP_ATTEMPT: "un intento de golpe de Estado",
  DISASTER: "un desastre natural",
  ECONOMIC_CRISIS: "una crisis económica",
  DISCOVERY: "un descubrimiento inesperado",
  LEAK: "una filtración de información",
};

function severityLabel(severity: number): string {
  if (severity < 30) return "leve";
  if (severity < 60) return "moderada";
  return "grave";
}

export function buildEventPrompt(
  event: EventState,
  state: GameState,
): { system: string; user: string } {
  const relatedMinistryKey = MINISTRY_FOR_EVENT[event.type];
  const relatedMinistry = relatedMinistryKey
    ? state.ministries.find((m) => m.key === relatedMinistryKey)
    : undefined;
  const minister = relatedMinistry?.ministerOfficialId
    ? state.officials.find((o) => o.id === relatedMinistry.ministerOfficialId)
    : undefined;

  const eventLabel = EVENT_LABEL[event.type] ?? event.type.toLowerCase();
  const sevLabel = severityLabel(event.severity);

  const system = `Eres un cronista político y corresponsal que escribe para un diario serio en español.
Tu estilo es sobrio, informativo y narrativo. Describes los hechos con precisión,
mencionando datos concretos y nombres propios cuando están disponibles.
Evitas adjetivos sensacionalistas. Escribes siempre en español neutro.`;

  const user = `Escribe una crónica de 2 a 3 párrafos (200-250 palabras) sobre el siguiente suceso:

PAÍS: ${state.countryName}
FECHA: Año ${event.year}, Mes ${event.month}
SUCESO: ${eventLabel} de magnitud ${sevLabel} (${Math.round(event.severity)}/100)

CONTEXTO:
- Ministro responsable: ${minister?.name ?? "No asignado"} (Ministerio de ${relatedMinistryKey ?? "N/A"})
- Habilidad del ministro: ${minister?.skill ?? "N/A"}/100
- Corrupción del ministro: ${minister?.corruption ?? "N/A"}/100
- Eficiencia del ministerio: ${relatedMinistry?.efficiency ?? "N/A"}/100
- Población total: ${state.population.toLocaleString("es")}
- Tesoro nacional: M$ ${(state.treasury / 1_000_000).toFixed(1)}
- PIB: M$ ${(state.gdp / 1_000_000).toFixed(0)}

Indicadores sociales actuales:
- Pobreza: ${state.povertyRate.toFixed(1)}% | Desempleo: ${state.unemploymentRate.toFixed(1)}%
- Crimen: ${state.crimeRate.toFixed(1)}% | Salud (enfermos): ${state.sickRate.toFixed(1)}%
- Educación: ${state.educationLevel.toFixed(0)}/100 | Inflación: ${state.inflation.toFixed(1)}%

Incorpora naturalmente algunos de estos datos en la crónica. No inventes cifras ni nombres que no aparezcan en el contexto proporcionado.`;

  return { system, user };
}
