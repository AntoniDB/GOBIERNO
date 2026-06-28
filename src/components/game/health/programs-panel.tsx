"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { ProgramLaunchModal } from "./program-launch-modal";
import type { MinistryProgramState } from "@/lib/engine/types";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const PROGRAM_COLORS: Record<string, string> = {
  VACCINATION_CAMPAIGN: "#00C2B8",
  PREVENTION_EDUCATION: "#8844CC",
  MENTAL_HEALTH_PROGRAM: "#E08800",
};

const PROGRAM_LABELS: Record<string, string> = {
  VACCINATION_CAMPAIGN: "Campaña de vacunación",
  PREVENTION_EDUCATION: "Prevención / educación sanitaria",
  MENTAL_HEALTH_PROGRAM: "Programa de salud mental",
};

function fmtCost(n: number): string {
  if (n >= 1e9) return `M$ ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `M$ ${(n / 1e6).toFixed(1)}M`;
  return `M$ ${n}`;
}

export function ProgramsPanel() {
  const gameState = useGameStore((s) => s.gameState);
  const cancelProgram = useGameStore((s) => s.cancelProgram);
  const [showLaunchModal, setShowLaunchModal] = useState(false);

  if (!gameState) return null;

  const programs = (gameState.programs ?? []).filter((p) => p.status === "ACTIVE");
  const totalCost = programs.reduce((s, p) => s + p.monthlyCost, 0);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #00C87E",
        padding: 18,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "2px solid #0A0A0A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "#00C87E",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "3px 10px",
              fontFamily: FF,
            }}
          >
            SAL · PROGRAMAS
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0A0A0A",
              letterSpacing: 2,
              fontFamily: FF,
            }}
          >
            PROGRAMAS OPERATIVOS
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#555", fontWeight: 600, fontFamily: FF }}>
          COSTO MENSUAL:{" "}
          <span style={{ color: "#FF6600", fontFamily: FFM }}>{fmtCost(totalCost)}</span>
        </div>
      </div>

      {programs.length === 0 ? (
        <p
          style={{
            fontSize: 11,
            color: "#888",
            fontWeight: 600,
            padding: "12px 0",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          No hay programas activos. Los programas operativos son acciones del
          Ministro que no requieren aprobación del Senado: campañas de vacunación,
          prevención sanitaria y salud mental. Los costos se descuentan del tesoro
          automáticamente cada mes.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {programs.map((prog) => (
            <ProgramCard
              key={prog.id}
              prog={prog}
              onCancel={() => cancelProgram(prog.id)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowLaunchModal(true)}
          style={{
            cursor: "pointer",
            background: "#00C87E",
            border: "2px solid #0A0A0A",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: 800,
            padding: "6px 14px",
            fontFamily: FF,
            letterSpacing: 1.5,
          }}
        >
          + LANZAR PROGRAMA
        </button>
      </div>

      {showLaunchModal && (
        <ProgramLaunchModal onClose={() => setShowLaunchModal(false)} />
      )}
    </div>
  );
}

function ProgramCard({
  prog,
  onCancel,
}: {
  prog: MinistryProgramState;
  onCancel: () => void;
}) {
  const color = PROGRAM_COLORS[prog.type] ?? "#888";

  return (
    <div
      style={{
        padding: "10px 12px",
        border: "2px solid #0A0A0A",
        borderLeft: `5px solid ${color}`,
        background: "#FAFAFA",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0A0A0A" }}>
            {PROGRAM_LABELS[prog.type] ?? prog.type}
          </div>
          <div style={{ fontSize: 9, color: "#888", fontWeight: 600, marginTop: 2 }}>
            {prog.parameters.diseaseName as string | undefined
              ? `Enf. ${prog.parameters.diseaseName}`
              : prog.type === "VACCINATION_CAMPAIGN"
                ? "Vacunación"
                : prog.type === "PREVENTION_EDUCATION"
                  ? "Prevención transversal"
                  : "Salud mental"}
            {" · "}
            {fmtCost(prog.monthlyCost)}/mes
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            cursor: "pointer",
            background: "none",
            border: "1.5px solid #FF2090",
            color: "#FF2090",
            fontSize: 9,
            fontWeight: 700,
            padding: "3px 10px",
            fontFamily: FF,
            letterSpacing: 1,
          }}
        >
          DESACTIVAR
        </button>
      </div>
    </div>
  );
}