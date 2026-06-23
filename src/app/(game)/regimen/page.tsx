"use client";

import { useGameStore } from "@/lib/store/game-store";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const METRICS: { key: string; label: string; description: string; higherBetter: boolean }[] = [
  { key: "powerConcentration",   label: "CONCENTRACIÓN DE PODER",   description: "Cuánto poder acumula el ejecutivo frente a otros poderes",    higherBetter: false },
  { key: "pressFreedom",         label: "LIBERTAD DE PRENSA",       description: "Grado de independencia y libertad de los medios",             higherBetter: true  },
  { key: "judicialIndependence", label: "INDEPENDENCIA JUDICIAL",   description: "Autonomía del Poder Judicial frente al ejecutivo",            higherBetter: true  },
  { key: "politicalPluralism",   label: "PLURALISMO POLÍTICO",      description: "Diversidad y competencia de partidos políticos",              higherBetter: true  },
  { key: "civilLiberties",       label: "LIBERTADES CIVILES",       description: "Protección de derechos individuales y colectivos",            higherBetter: true  },
  { key: "transparency",         label: "TRANSPARENCIA",            description: "Acceso a la información y rendición de cuentas",              higherBetter: true  },
  { key: "militarySubordination",label: "SUBORDINACIÓN MILITAR",    description: "Control civil sobre las fuerzas armadas",                    higherBetter: true  },
];

function getRegimeColor(regimeType: string): string {
  switch (regimeType) {
    case "Democracia plena":         return "#00C87E";
    case "Democracia defectuosa":    return "#E08800";
    case "Régimen híbrido":          return "#FF6600";
    case "Autoritarismo electoral":  return "#FF2090";
    case "Dictadura":                return "#CC2244";
    case "Estado fallido":           return "#CC2244";
    default:                         return "#666666";
  }
}

function getMetricColor(value: number, higherBetter: boolean): string {
  if (higherBetter) {
    if (value >= 70) return "#00C87E";
    if (value >= 40) return "#E08800";
    return "#FF2090";
  }
  if (value <= 30) return "#00C87E";
  if (value <= 55) return "#E08800";
  return "#FF2090";
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 10, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export default function RegimenPage() {
  const gameState       = useGameStore((s) => s.gameState);
  const lastTurnResult  = useGameStore((s) => s.lastTurnResult);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        {[0,1,2,3,4,5,6].map((i) => (
          <div key={i} style={{ height: 80, background: "#E8E0D8", border: "2.5px solid #0A0A0A", marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  const metrics    = gameState.regimeMetrics;
  const snapshot   = lastTurnResult?.monthSnapshot;
  const regimeType = snapshot?.regimeType ?? "—";
  const regimeColor= getRegimeColor(regimeType);

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO DE RÉGIMEN
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          RÉGIMEN POLÍTICO
        </div>
      </div>

      {/* Regime type banner */}
      <div
        style={{
          background: regimeColor,
          border: "2.5px solid #0A0A0A",
          boxShadow: `4px 4px 0 #0A0A0A`,
          padding: 20,
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.5)", letterSpacing: 2, marginBottom: 4 }}>
            CLASIFICACIÓN ACTUAL
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", letterSpacing: 3 }}>
            {regimeType.toUpperCase()}
          </div>
        </div>
        {(regimeType === "Dictadura" || regimeType === "Estado fallido") && (
          <div style={{ marginLeft: "auto", border: "2px solid rgba(255,255,255,0.5)", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1 }}>
            ⚠ RIESGO CRÍTICO
          </div>
        )}
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {METRICS.map((metric) => {
          const rawValue = metrics[metric.key as keyof typeof metrics];
          const value    = typeof rawValue === "number" ? rawValue : 0;
          const color    = getMetricColor(value, metric.higherBetter);

          return (
            <div
              key={metric.key}
              style={{
                background: "#FFFFFF",
                border: "2.5px solid #0A0A0A",
                boxShadow: "3px 3px 0 #0A0A0A",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 1.5, marginBottom: 3 }}>
                    {metric.label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>
                    {metric.description}
                  </div>
                </div>
                <div style={{ fontFamily: FFM, fontSize: 22, color, fontWeight: 700, flexShrink: 0, marginLeft: 16 }}>
                  {value.toFixed(0)}<span style={{ fontSize: 12 }}>/100</span>
                </div>
              </div>
              <Bar value={value} color={color} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 600, color: "#888", marginTop: 4 }}>
                <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
