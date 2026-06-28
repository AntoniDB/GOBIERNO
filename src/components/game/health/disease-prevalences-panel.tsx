"use client";

import { useMemo } from "react";
import { useGameStore } from "@/lib/store/game-store";
import type { DiseaseStateInput } from "@/lib/engine/types";

const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const CATEGORY_COLORS: Record<string, string> = {
  TRANSMISSIBLE: "#00C2B8",
  CHRONIC: "#8844CC",
  MENTAL_HEALTH: "#E08800",
};

const CATEGORY_LABELS: Record<string, string> = {
  TRANSMISSIBLE: "Transmisible",
  CHRONIC: "Crónica",
  MENTAL_HEALTH: "Salud mental",
};

const HISTORY_MONTHS = 12;

interface PrevSnapshotEntry {
  diseaseId: string;
  name: string;
  category: string;
  prevalence: number;
}

export function DiseasePrevalencesPanel() {
  const gameState = useGameStore((s) => s.gameState);
  const snapshots = useGameStore((s) => s.snapshots);

  const history = useMemo(() => {
    // Tomar últimos N snapshots que tengan diseasePrevalences
    return snapshots
      .filter((s) => s.diseasePrevalences && s.diseasePrevalences.length > 0)
      .slice(-HISTORY_MONTHS);
  }, [snapshots]);

  if (!gameState) return null;

  const diseases = (gameState.diseases ?? []) as DiseaseStateInput[];
  const currentPrevs = gameState.diseasePrevalences ?? [];
  const activePrograms = (gameState.programs ?? []).filter((p) => p.status === "ACTIVE");

  // Agrupar enfermedades por categoría para la visualización
  const categories = ["TRANSMISSIBLE", "CHRONIC", "MENTAL_HEALTH"] as const;

  if (diseases.length === 0) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "2.5px solid #0A0A0A",
          boxShadow: "4px 4px 0 #FF2090",
          padding: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span
            style={{
              background: "#FF2090",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "3px 10px",
              fontFamily: FF,
            }}
          >
            SAL · EPIDEMIOLOGÍA
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#888", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
          No hay catálogo de enfermedades sembradas en esta partida. Crea una
          nueva partida para ver el desglose epidemiológico por enfermedad.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "2.5px solid #0A0A0A",
        boxShadow: "4px 4px 0 #FF2090",
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
              background: "#FF2090",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "3px 10px",
              fontFamily: FF,
            }}
          >
            SAL · EPIDEMIOLOGÍA
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
            DESGLOSE POR ENFERMEDAD
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#888", fontWeight: 600, fontFamily: FF }}>
          {diseases.length} enfermed · {history.length} meses de historial
        </span>
      </div>

      <p
        style={{
          fontSize: 10,
          color: "#777",
          fontWeight: 600,
          margin: 0,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        Prevalencia actual de cada enfermedad sobre el total de la población.
        La línea base (prevalenciaBase) es el nivel al que tiende la enfermedad
        sin programas activos. Las campañas de vacunación, prevención y salud
        mental reducen la prevalencia por debajo de su base; al desactivarlas,
        sube de nuevo.
      </p>

      {categories.map((cat) => {
        const catDiseases = diseases.filter((d) => d.category === cat);
        if (catDiseases.length === 0) return null;
        const color = CATEGORY_COLORS[cat];
        const label = CATEGORY_LABELS[cat];

        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                paddingBottom: 4,
                borderBottom: `2px solid ${color}`,
              }}
            >
              <span
                style={{
                  background: color,
                  color: "#FFFFFF",
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  padding: "2px 8px",
                  fontFamily: FF,
                }}
              >
                {label.toUpperCase()}
              </span>
              <span style={{ fontSize: 9, color: "#888", fontWeight: 600, fontFamily: FF }}>
                {catDiseases.length} enfermed
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {catDiseases.map((d) => (
                <DiseaseRow
                  key={d.id}
                  disease={d}
                  currentPrev={currentPrevs.find((p) => p.diseaseId === d.id)?.currentPrevalence}
                  history={history.map((h) => {
                    const entry = (h.diseasePrevalences as PrevSnapshotEntry[] | undefined)?.find(
                      (e) => e.diseaseId === d.id,
                    );
                    return entry?.prevalence;
                  })}
                  hasCampaign={activePrograms.some((p) => {
                    if (p.type === "VACCINATION_CAMPAIGN") return p.parameters.diseaseId === d.id;
                    if (p.type === "PREVENTION_EDUCATION")
                      return d.category === "TRANSMISSIBLE" || d.category === "CHRONIC";
                    if (p.type === "MENTAL_HEALTH_PROGRAM") return d.category === "MENTAL_HEALTH";
                    return false;
                  })}
                  color={color}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiseaseRow({
  disease,
  currentPrev,
  history,
  hasCampaign,
  color,
}: {
  disease: DiseaseStateInput;
  currentPrev: number | undefined;
  history: (number | undefined)[];
  hasCampaign: boolean;
  color: string;
}) {
  const current = currentPrev ?? disease.prevalenceBase;
  const base = disease.prevalenceBase;

  // Calcular tendencia usando el historial (comparar valor actual con el de hace 3 meses)
  let trend: "down" | "up" | "stable" | "unknown" = "unknown";
  if (history.length >= 4) {
    const recent = history[history.length - 1];
    const threeMonthsAgo = history[history.length - 4];
    if (recent !== undefined && threeMonthsAgo !== undefined) {
      const delta = recent - threeMonthsAgo;
      if (delta < -0.5) trend = "down";
      else if (delta > 0.5) trend = "up";
      else trend = "stable";
    }
  }

  const trendColor = trend === "down" ? "#00C87E" : trend === "up" ? "#FF2090" : "#888";
  const trendSymbol = trend === "down" ? "↓" : trend === "up" ? "↑" : trend === "stable" ? "→" : "•";
  const trendLabel =
    trend === "down" ? "Bajando" : trend === "up" ? "Subiendo" : trend === "stable" ? "Estable" : "Sin historial";

  // Min y max del historial para escalar la sparkline
  const validHistory = history.filter((h): h is number => h !== undefined);
  const histMax = Math.max(base, ...validHistory, current, 0.1);
  const histMin = 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 60px 90px 110px",
        gap: 8,
        padding: "8px 10px",
        border: "1.5px solid #0A0A0A",
        borderLeft: `4px solid ${color}`,
        background: hasCampaign ? "#FFFCEB" : "#FAFAFA",
        alignItems: "center",
      }}
    >
      {/* Nombre + badges */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0A0A0A", fontFamily: FF }}>
          {disease.name}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
          {disease.hasVaccine && (
            <Badge bg="#00C87E" color="#FFFFFF" text="VACUNA" />
          )}
          {hasCampaign && (
            <Badge bg="#0A0A0A" color="#FFE600" text="CAMPAÑA ACTIVA" pulse />
          )}
        </div>
      </div>

      {/* Prevalencia actual */}
      <div>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#888", letterSpacing: 1, fontFamily: FF }}>
          ACTUAL
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: hasCampaign ? "#00C87E" : "#0A0A0A", fontFamily: FFM }}>
          {current.toFixed(1)}%
        </div>
        <div style={{ fontSize: 8, color: "#AAA", fontFamily: FFM }}>
          base {base.toFixed(1)}%
        </div>
      </div>

      {/* Tendencia */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#888", letterSpacing: 1, fontFamily: FF, marginBottom: 2 }}>
          TENDENCIA 3M
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: trendColor, lineHeight: 1, fontFamily: FFM }}>
          {trendSymbol}
        </div>
        <div style={{ fontSize: 8, color: trendColor, fontWeight: 700, fontFamily: FF }}>
          {trendLabel}
        </div>
      </div>

      {/* Sparkline */}
      <div>
        {validHistory.length < 2 ? (
          <div
            style={{
              height: 30,
              border: "1.5px solid #E8E0D8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "#AAA",
              fontFamily: FF,
              fontWeight: 600,
            }}
          >
            —
          </div>
        ) : (
          <Sparkline values={validHistory} min={histMin} max={histMax} base={base} color={color} />
        )}
      </div>
    </div>
  );
}

function Sparkline({
  values,
  min,
  max,
  base,
  color,
}: {
  values: number[];
  min: number;
  max: number;
  base: number;
  color: string;
}) {
  const width = 100;
  const height = 30;
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = points.join(" ");

  // Línea base (referencia)
  const baseY = height - ((base - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", border: "1.5px solid #E8E0D8", background: "#FFFFFF" }}
      preserveAspectRatio="none"
    >
      {/* Línea de base punteada */}
      <line
        x1={0}
        y1={baseY}
        x2={width}
        y2={baseY}
        stroke="#CCC"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      {/* Sparkline */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Punto final */}
      {values.length > 0 && (
        <circle
          cx={(values.length - 1) * stepX}
          cy={height - ((values[values.length - 1] - min) / range) * height}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}

function Badge({
  bg,
  color,
  text,
  pulse,
}: {
  bg: string;
  color: string;
  text: string;
  pulse?: boolean;
}) {
  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 7,
        fontWeight: 800,
        letterSpacing: 1,
        padding: "1.5px 5px",
        fontFamily: FF,
        border: pulse ? "1px solid #0A0A0A" : "none",
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
}