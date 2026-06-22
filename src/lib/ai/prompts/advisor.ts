// ─── Prompt builder para el Asesor de Gobierno ──────────────────────────────
// Serializa el GameState completo y el TurnInput en un prompt estructurado
// para que el LLM genere un informe de asesoría gubernamental.

import type { GameState, TurnInput } from "@/lib/engine/types";
import { BALANCE } from "@/lib/balance";

function fmt(value: unknown, decimals = 1): string {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : "?";
}

function moneyM(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "M$ ?";
  return `M$ ${(num / 1_000_000).toFixed(1)}`;
}

function formatNumber(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num.toLocaleString("es") : "?";
}

function severityLabel(severity: number): string {
  if (severity < 30) return "leve";
  if (severity < 60) return "moderada";
  return "grave";
}

const MINISTRY_NAMES: Record<string, string> = {
  HEALTH: "Salud",
  EDUCATION: "Educación",
  ECONOMY: "Economía",
  DEFENSE: "Defensa",
  SECURITY: "Seguridad",
  JUSTICE: "Justicia",
  AGRICULTURE: "Agricultura",
  SOCIAL_DEVELOPMENT: "Desarrollo Social",
};

const CLASS_NAMES: Record<string, string> = {
  EXTREME_POVERTY: "Pobreza extrema",
  POVERTY: "Pobreza",
  MIDDLE: "Clase media",
  ELITE: "Élite",
};

const REGIME_LABELS: Record<string, string> = {
  powerConcentration: "Concentración de poder",
  pressFreedom: "Libertad de prensa",
  judicialIndependence: "Independencia judicial",
  politicalPluralism: "Pluralismo político",
  civilLiberties: "Libertades civiles",
  transparency: "Transparencia",
  militarySubordination: "Subordinación militar",
};

function regimeTypeFromMetrics(m: GameState["regimeMetrics"]): string {
  const avg =
    (m.powerConcentration +
      m.pressFreedom +
      m.judicialIndependence +
      m.politicalPluralism +
      m.civilLiberties +
      m.transparency +
      m.militarySubordination) /
    7;
  if (m.powerConcentration > 85 && avg < 20) return "Dictadura";
  if (avg > 70) return "Democracia plena";
  if (avg > 55) return "Democracia defectuosa";
  if (avg > 35) return "Régimen híbrido";
  if (avg > 20) return "Autoritarismo electoral";
  return "Estado fallido";
}

function serializePendingInput(
  input: TurnInput,
  state: GameState,
): string {
  const lines: string[] = [];
  let hasAny = false;

  if (input.budgetAdjustments) {
    for (const [key, pct] of Object.entries(input.budgetAdjustments)) {
      const ministry = state.ministries.find((m) => m.key === key);
      const oldPct = ministry?.budgetPercent;
      const name = MINISTRY_NAMES[key] ?? key;
      lines.push(
        `  - Ajuste de presupuesto: ${name} ${oldPct != null ? fmt(oldPct) + "%" : "?"} → ${fmt(pct)}%`,
      );
      hasAny = true;
    }
  }

  if (input.subDecisionChanges) {
    for (const [key, changes] of Object.entries(input.subDecisionChanges)) {
      const name = MINISTRY_NAMES[key] ?? key;
      for (const [subKey, value] of Object.entries(changes)) {
        lines.push(
          `  - Sub-decisión en ${name}: ${subKey} → ${String(value)}`,
        );
        hasAny = true;
      }
    }
  }

  if (input.proposedLaws && input.proposedLaws.length > 0) {
    for (const lawKey of input.proposedLaws) {
      lines.push(`  - Ley propuesta: ${lawKey} (pendiente de votación en el Congreso)`);
      hasAny = true;
    }
  }

  if (input.appointments) {
    for (const [role, officialId] of Object.entries(input.appointments)) {
      const official = state.officials.find((o) => o.id === officialId);
      const roleName = MINISTRY_NAMES[role] ?? role;
      lines.push(
        `  - Nombramiento: ${official?.name ?? officialId} como ministro de ${roleName}`,
      );
      hasAny = true;
    }
  }

  if (input.newOrganisms) {
    for (const [type, config] of Object.entries(input.newOrganisms)) {
      lines.push(
        `  - Creación de organismo: ${config.name} (${type}), presupuesto M$ ${fmt(config.monthlyBudget / 1_000_000, 1)}/mes`,
      );
      hasAny = true;
    }
  }

  if (input.investigations && input.investigations.length > 0) {
    for (const officialId of input.investigations) {
      const official = state.officials.find((o) => o.id === officialId);
      lines.push(
        `  - Orden de investigar a: ${official?.name ?? officialId}`,
      );
      hasAny = true;
    }
  }

  if (input.mediaActions) {
    for (const [mediaId, action] of Object.entries(input.mediaActions)) {
      if (action === "none") continue;
      const medium = state.media.find((m) => m.id === mediaId);
      const actionLabel =
        action === "censor"
          ? "CENSURAR"
          : action === "close"
            ? "CLAUSURAR"
            : action === "boost"
              ? "IMPULSAR"
              : "RESTAURAR";
      lines.push(
        `  - Acción sobre medio: ${medium?.name ?? mediaId} → ${actionLabel}`,
      );
      hasAny = true;
    }
  }

  if (input.voteBuyingPartyIds && input.voteBuyingPartyIds.length > 0) {
    for (const partyId of input.voteBuyingPartyIds) {
      const party = state.parties.find((p) => p.id === partyId);
      lines.push(
        `  - Compra de votos al partido: ${party?.name ?? partyId}`,
      );
      hasAny = true;
    }
  }

  if (input.hireCandidateIds && input.hireCandidateIds.length > 0) {
    for (const candidateId of input.hireCandidateIds) {
      const candidate = state.officials.find((o) => o.id === candidateId);
      lines.push(
        `  - Contratación de candidato: ${candidate?.name ?? candidateId} (rol: ${candidate?.role ?? "?"})`,
      );
      hasAny = true;
    }
  }

  return hasAny ? lines.join("\n") : "  (No hay decisiones pendientes este mes)";
}

export function buildAdvisorPrompt(
  state: GameState,
  pendingInput: TurnInput,
): { system: string; user: string } {
  const regimeType = regimeTypeFromMetrics(state.regimeMetrics);

  const system = `Eres el Jefe de Gabinete y Asesor Principal del mandatario de ${state.countryName}.
Tu rol es analizar la situación del país con honestidad y rigor, respaldar
tus observaciones con los datos proporcionados, y ofrecer recomendaciones
accionables y específicas. Eres directo, profesional y evitas la adulación.
Señalas problemas incluso cuando son incómodos. Escribes en español neutro.`;

  const activeOfficials = state.officials.filter((o) => o.status === "ACTIVE");
  const globalCorruption =
    activeOfficials.length > 0
      ? activeOfficials.reduce((s, o) => s + o.corruption, 0) /
        activeOfficials.length
      : 0;

  const minBudgetRange = BALANCE.MIN_BUDGET_PERCENT;
  const maxBudgetRange = BALANCE.MAX_BUDGET_PERCENT;

  const lines: string[] = [];

  lines.push(`=== DATOS DEL PAÍS ===`);
  lines.push(`Nombre: ${state.countryName}`);
  lines.push(
    `Fecha: Año ${state.currentYear}, Mes ${state.currentMonth}`,
  );
  lines.push(`Población: ${formatNumber(state.population)}`);
  lines.push(`Tesoro: ${moneyM(state.treasury)}`);
  lines.push(`PIB: ${moneyM(state.gdp)}`);

  lines.push(``);
  lines.push(`=== INDICADORES SOCIALES ===`);
  lines.push(
    `Pobreza: ${fmt(state.povertyRate)}% | Desempleo: ${fmt(state.unemploymentRate)}%`,
  );
  lines.push(
    `Salud (enfermos): ${fmt(state.sickRate)}% | Crimen: ${fmt(state.crimeRate)}%`,
  );
  lines.push(
    `Seguridad alimentaria: ${fmt(state.foodSecurity)}% | Educación: ${fmt(state.educationLevel)}/100`,
  );
  lines.push(
    `Inflación: ${fmt(state.inflation)}% | Gini: ${fmt(state.povertyRate)}`,
  );

  lines.push(``);
  lines.push(`=== APROBACIÓN POR CLASE SOCIAL ===`);
  for (const sc of state.socialClasses) {
    const name = CLASS_NAMES[sc.key] ?? sc.key;
    const demands =
      sc.demands.length > 0 ? sc.demands.join(", ") : "sin demandas urgentes";
    lines.push(
      `${name}: ${fmt(sc.approval)}% aprobación (${fmt(sc.populationPercent)}% de la población) — demanda: ${demands}`,
    );
  }

  lines.push(``);
  lines.push(
    `=== MINISTERIOS (rango de presupuesto: ${minBudgetRange}%–${maxBudgetRange}%) ===`,
  );
  for (const m of state.ministries) {
    const name = MINISTRY_NAMES[m.key] ?? m.key;
    const minister = m.ministerOfficialId
      ? state.officials.find((o) => o.id === m.ministerOfficialId)
      : undefined;
    const ministerStr = minister
      ? `${minister.name} (habilidad ${fmt(minister.skill)}, corrupción ${fmt(minister.corruption)})`
      : "Sin ministro asignado";
    lines.push(
      `${name}: ${fmt(m.budgetPercent)}% presupuesto, ${fmt(m.efficiency)}% eficiencia, corrupción interna ${fmt(m.internalCorruption)}`,
    );
    lines.push(`  Ministro: ${ministerStr}`);
  }

  lines.push(``);
  lines.push(`=== RÉGIMEN ===`);
  lines.push(`Tipo: ${regimeType}`);
  for (const [key, value] of Object.entries(state.regimeMetrics)) {
    const name = REGIME_LABELS[key] ?? key;
    lines.push(`  ${name}: ${fmt(value)}/100`);
  }

  lines.push(``);
  lines.push(`=== CORRUPCIÓN GLOBAL ===`);
  lines.push(`${fmt(globalCorruption)}% (promedio de ${activeOfficials.length} funcionarios activos)`);

  if (state.organisms.length > 0) {
    lines.push(``);
    lines.push(`=== ORGANISMOS CREADOS ===`);
    for (const org of state.organisms) {
      const head = org.headOfficialId
        ? state.officials.find((o) => o.id === org.headOfficialId)
        : undefined;
      lines.push(
        `${org.name} (${org.type}): efectividad ${fmt(org.effectiveness)}%, autonomía ${fmt(org.autonomyLevel)}%, presupuesto M$ ${fmt(org.monthlyBudget / 1_000_000, 1)}/mes`,
      );
      if (head) {
        lines.push(`  Titular: ${head.name}`);
      }
    }
  }

  if (state.activeLaws.length > 0) {
    lines.push(``);
    lines.push(`=== LEYES ACTIVAS ===`);
    const keys = state.activeLaws.map((l) => l.lawKey).join(", ");
    lines.push(keys);
  }

  const unresolvedEvents = state.events.filter(
    (e) => !e.resolvedAt,
  );
  if (unresolvedEvents.length > 0) {
    lines.push(``);
    lines.push(`=== EVENTOS ACTIVOS ===`);
    for (const evt of unresolvedEvents) {
      lines.push(
        `${evt.type} (severidad ${fmt(evt.severity)}, ${severityLabel(evt.severity)}) — ${evt.description}`,
      );
    }
  }

  if (state.parties.length > 0) {
    lines.push(``);
    lines.push(`=== CONGRESO ===`);
    for (const party of state.parties) {
      lines.push(
        `${party.name}: ${party.seatsLower} bancas en Cámara Baja, ${party.seatsUpper} en Cámara Alta (popularidad ${fmt(party.popularity)}%)`,
      );
    }
  }

  const activeCases = state.judicialCases.filter(
    (jc) => jc.currentPhase !== "CLOSED",
  );
  if (activeCases.length > 0) {
    lines.push(``);
    lines.push(`=== CASOS JUDICIALES ACTIVOS ===`);
    for (const jc of activeCases) {
      const defendant = state.officials.find(
        (o) => o.id === jc.defendantOfficialId,
      );
      lines.push(
        `Caso contra ${defendant?.name ?? jc.defendantOfficialId} (${jc.caseType}) — fase ${jc.currentPhase}, ${jc.monthsInPhase} meses`,
      );
    }
  }

  lines.push(``);
  lines.push(`=== DECISIONES PENDIENTES DEL JUGADOR (aún no aplicadas) ===`);
  lines.push(serializePendingInput(pendingInput, state));

  lines.push(``);
  lines.push(`---`);
  lines.push(
    `Genera un informe de asesoría en formato markdown con EXACTAMENTE estas tres secciones:`,
  );
  lines.push(``);
  lines.push(`## 1. Resumen de situación`);
  lines.push(`[1–2 párrafos evaluando la situación general del país]`);
  lines.push(``);
  lines.push(`## 2. Puntos críticos`);
  lines.push(`- [alerta 1: problema urgente con indicadores específicos]`);
  lines.push(`- [alerta 2]`);
  lines.push(`- [alerta 3]`);
  lines.push(`- [alerta 4 si aplica — máximo 4]`);
  lines.push(``);
  lines.push(`## 3. Recomendaciones`);
  lines.push(
    `- [recomendación 1: acción concreta, menciona ministerio, ley u organismo específico]`,
  );
  lines.push(`- [recomendación 2]`);
  lines.push(`- [recomendación 3]`);
  lines.push(``);
  lines.push(
    `IMPORTANTE: Comenta explícitamente las consecuencias previsibles de las decisiones pendientes listadas arriba. Si son peligrosas, adviértelo con claridad.`,
  );

  const user = lines.join("\n");

  return { system, user };
}
