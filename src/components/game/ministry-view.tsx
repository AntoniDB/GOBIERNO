"use client";

import type { MinistryState, OfficialState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { BudgetSlider } from "@/components/game/budget-slider";
import { SubDecisions } from "@/components/game/sub-decisions";
import { MinisterCard } from "@/components/game/minister-card";
import { EfficiencyChart } from "@/components/game/efficiency-chart";
import { ProgramsPanel } from "@/components/game/health/programs-panel";
import { ResourcePanel } from "@/components/game/health/resource-panel";
import { DiseasePrevalencesPanel } from "@/components/game/health/disease-prevalences-panel";
import { TradePanel } from "@/components/game/trade-panel";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const MINISTRY_CFG: Record<string, { name: string; abbr: string; color: string; description: string }> = {
  HEALTH:             { name: "Salud Pública",      abbr: "SAL", color: "#00C87E", description: "Gestiona hospitales públicos, campañas de vacunación y políticas de salud mental para mantener baja la tasa de enfermedad en la población." },
  EDUCATION:          { name: "Educación",           abbr: "EDU", color: "#E08800", description: "Administra la inversión en educación primaria, secundaria y superior, define el enfoque curricular y otorga becas estudiantiles." },
  ECONOMY:            { name: "Economía",            abbr: "ECO", color: "#00C2B8", description: "Controla la tasa de interés referencial, el salario mínimo y la política industrial para regular la economía nacional." },
  DEFENSE:            { name: "Defensa Nacional",    abbr: "DEF", color: "#2468CC", description: "Maneja las tropas activas, el gasto en equipamiento militar y las políticas de servicio militar obligatorio para la defensa del país." },
  SECURITY:           { name: "Seguridad Interior",  abbr: "SEC", color: "#FF2090", description: "Coordina el patrullaje urbano y rural, las políticas antidrogas y la inversión en el sistema carcelario para combatir el crimen." },
  JUSTICE:            { name: "Justicia",            abbr: "JUS", color: "#CC2244", description: "Supervisa jueces y fiscales, prioriza la lucha contra la corrupción y define la dureza del sistema penal." },
  AGRICULTURE:        { name: "Agricultura",         abbr: "AGR", color: "#8844CC", description: "Gestiona subsidios al productor y la inversión en infraestructura rural para garantizar la seguridad alimentaria nacional." },
  SOCIAL_DEVELOPMENT: { name: "Desarrollo Social",   abbr: "DES", color: "#FF6600", description: "Define la focalización de programas sociales y prioriza la atención a niñez, adultos mayores y mujeres en situación de vulnerabilidad." },
};

function getEffColor(v: number) {
  if (v >= 70) return "#00C87E";
  if (v >= 40) return "#E08800";
  return "#FF2090";
}

function Bar({ value, color, h = 10 }: { value: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function MinistryView({ ministry }: { ministry: MinistryState }) {
  const gameState       = useGameStore((s) => s.gameState);
  const pendingInput    = useGameStore((s) => s.pendingInput);
  const updateBudget    = useGameStore((s) => s.updateBudget);
  const updateSubDecision = useGameStore((s) => s.updateSubDecision);

  const cfg = MINISTRY_CFG[ministry.key] ?? {
    name: ministry.key, abbr: ministry.key.slice(0, 3).toUpperCase(),
    color: "#888888", description: "Ministerio del gobierno.",
  };

  const effColor = getEffColor(ministry.efficiency);
  const corruptColor = ministry.internalCorruption < 30 ? "#00C87E" : ministry.internalCorruption < 60 ? "#E08800" : "#FF2090";

  const minister: OfficialState | null | undefined = ministry.ministerOfficialId
    ? gameState?.officials.find((o) => o.id === ministry.ministerOfficialId)
    : null;

  const hasPendingBudget      = pendingInput.budgetAdjustments?.[ministry.key] !== undefined;
  const hasPendingSubDecisions= pendingInput.subDecisionChanges?.[ministry.key] !== undefined;
  const hasPendingChanges     = hasPendingBudget || hasPendingSubDecisions;

  return (
    <div style={{ fontFamily: FF }}>
      {/* Info banner */}
      <div
        style={{
          background: "#FFFFFF",
          border: `2.5px solid #0A0A0A`,
          borderTop: `6px solid ${cfg.color}`,
          boxShadow: `4px 4px 0 ${cfg.color}`,
          padding: 20,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingBottom: 14, borderBottom: "1.5px solid #E8E0D8" }}>
          <div>
            <div style={{ background: cfg.color, color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2, padding: "3px 10px", display: "inline-block", marginBottom: 8 }}>
              {cfg.abbr}
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#555", lineHeight: 1.6, maxWidth: 520 }}>
              {cfg.description}
            </p>
            {hasPendingChanges && (
              <div style={{ marginTop: 8, padding: "4px 10px", background: "#FFE600", border: "2px solid #0A0A0A", fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 1, display: "inline-block" }}>
                CAMBIOS PENDIENTES — AVANZAR MES PARA APLICAR
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "right", marginLeft: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5, marginBottom: 4 }}>EFICIENCIA</div>
            <div style={{ fontFamily: FFM, fontSize: 28, color: effColor, lineHeight: 1 }}>
              {ministry.efficiency.toFixed(0)}<span style={{ fontSize: 13 }}>%</span>
            </div>
          </div>
        </div>

        {/* 3 metric bars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5 }}>PRESUPUESTO</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#00C2B8" }}>{ministry.budgetPercent.toFixed(1)}%</span>
            </div>
            <Bar value={ministry.budgetPercent * 2.5} color="#00C2B8" />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5 }}>CORRUPCIÓN</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: corruptColor }}>{ministry.internalCorruption.toFixed(0)}%</span>
            </div>
            <Bar value={ministry.internalCorruption} color={corruptColor} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5 }}>EFICIENCIA</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: effColor }}>{ministry.efficiency.toFixed(0)}%</span>
            </div>
            <Bar value={ministry.efficiency} color={effColor} />
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          <BudgetSlider
            ministryKey={ministry.key}
            currentBudget={ministry.budgetPercent}
            onBudgetChange={updateBudget}
          />
          <SubDecisions
            ministryKey={ministry.key}
            subDecisions={ministry.subDecisions}
            onSubDecisionChange={updateSubDecision}
          />

          {/* Paneles especificos del Ministerio de Salud (Sesion Salud-3A) */}
          {ministry.key === "HEALTH" && (
            <>
              <TradePanel ministryKey="HEALTH" />
              <ResourcePanel />
              <DiseasePrevalencesPanel />
              <ProgramsPanel />
            </>
          )}
        </div>
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <MinisterCard minister={minister} ministry={ministry} />
          <EfficiencyChart ministryKey={ministry.key} />
        </div>
      </div>
    </div>
  );
}
