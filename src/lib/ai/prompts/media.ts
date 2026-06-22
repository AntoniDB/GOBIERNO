// ─── Prompt builder para coberturas mediáticas ───────────────────────────────
// Construye los prompts para que el LLM genere un artículo periodístico
// con el sesgo editorial del medio correspondiente.

import type { EventState, MediaState } from "@/lib/engine/types";

function affinityLabel(value: number): string {
  if (value > 50) return "Muy afín al gobierno";
  if (value > 20) return "Afín al gobierno";
  if (value > -20) return "Neutral";
  if (value > -50) return "Opositor al gobierno";
  return "Muy opositor al gobierno";
}

function biasInstruction(governmentAffinity: number): string {
  if (governmentAffinity > 30) {
    return "Como medio afín al gobierno, tiendes a destacar los aspectos positivos y minimizar los negativos de la gestión gubernamental.";
  }
  if (governmentAffinity < -30) {
    return "Como medio opositor, tiendes a ser crítico con el gobierno y a señalar los fallos en la gestión.";
  }
  return "Como medio neutral, buscas el equilibrio informativo presentando tanto aspectos positivos como negativos.";
}

export function buildCoveragePrompt(
  medium: MediaState,
  event: EventState,
  sentiment: number,
  countryName: string,
): { system: string; user: string } {
  const affinity = affinityLabel(medium.governmentAffinity);
  const bias = biasInstruction(medium.governmentAffinity);

  // Detectar si es un editorial (ID con prefijo mc-edit-)
  const isEditorial = event.id.startsWith("mc-edit-") || event.id.startsWith("edit-");

  // Detectar si es un reportaje de investigación (ID con prefijo mc-invest-)
  const isInvestigative = event.id.startsWith("mc-invest-") || event.id.startsWith("invest-");

  if (isEditorial) {
    const system = `Eres el director editorial de "${medium.name}", un medio de comunicación de ${countryName}.
${bias}
Escribes en español con un estilo editorial reflexivo y analítico. Tu tarea es redactar la editorial mensual del periódico.`;

    const user = `Redacta la editorial mensual de "${medium.name}" analizando la situación actual del país.

CONTEXTO DEL SUCESO: ${event.description}
SENTIMIENTO EDITORIAL: ${sentiment > 0.2 ? "positivo" : sentiment < -0.2 ? "negativo" : "neutral"} (${sentiment.toFixed(2)})

PERFIL DEL MEDIO:
- Nombre: "${medium.name}"
- Tipo: ${medium.type}
- Afinidad al gobierno: ${affinity} (${medium.governmentAffinity}/100)
- Alcance: ${medium.reach}/100
- Credibilidad: ${medium.credibility}/100

Escribe una editorial de 2 a 3 párrafos (200-300 palabras) con el tono consistente de tu línea editorial (${affinity}).`;

    return { system, user };
  }

  if (isInvestigative) {
    const system = `Eres el jefe de investigación de "${medium.name}", un medio de comunicación de ${countryName}.
${bias}
Escribes en español con un estilo periodístico de investigación, serio y contundente. Citas fuentes y presentas evidencia.`;

    const user = `Redacta un reportaje de investigación de 3 a 4 párrafos (300-400 palabras) sobre:

SUCESO A CUBRIR: ${event.description}
SEVERIDAD DEL HALLAZGO: ${Math.round(event.severity)}/100

PERFIL DE TU MEDIO:
- Nombre: "${medium.name}"
- Tipo: ${medium.type}
- Afinidad al gobierno: ${affinity} (${medium.governmentAffinity}/100)
- Alcance: ${medium.reach}/100
- Credibilidad: ${medium.credibility}/100

El tono debe ser de denuncia periodística, manteniendo tu línea editorial (${affinity}).`;

    return { system, user };
  }

  const system = `Eres el redactor jefe de "${medium.name}", un medio de comunicación de ${countryName}.
${bias}
Escribes en español con un estilo periodístico profesional. Siempre mencionas fuentes y datos concretos cuando están disponibles.`;

  const user = `Redacta una noticia de 3 a 4 párrafos (300-400 palabras) sobre el siguiente suceso:

SUCESO A CUBRIR: ${event.description}
TIPO DE SUCESO: ${event.type}
SEVERIDAD: ${Math.round(event.severity)}/100

PERFIL DE TU MEDIO:
- Nombre: "${medium.name}"
- Tipo: ${medium.type}
- Afinidad al gobierno: ${affinity} (${medium.governmentAffinity}/100)
- Alcance: ${medium.reach}/100
- Credibilidad: ${medium.credibility}/100

El tono del artículo debe reflejar consistentemente tu línea editorial (${affinity}).`;

  return { system, user };
}
