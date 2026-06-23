"use client";

import { useGameStore } from "@/lib/store/game-store";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const CLASS_CFG: Record<string, { name: string; color: string; desc: string }> = {
  EXTREME_POVERTY: { name: "POBREZA EXTREMA",  color: "#FF2090", desc: "Desplazados, sin acceso básico garantizado" },
  POVERTY:         { name: "CLASE BAJA",        color: "#FF6600", desc: "Trabajadores informales y desempleados" },
  MIDDLE:          { name: "CLASE MEDIA",       color: "#2468CC", desc: "Asalariados y pequeños empresarios" },
  ELITE:           { name: "ÉLITE",             color: "#E08800", desc: "Corporativos y alta burguesía" },
};

function riskLabel(tension: number) {
  if (tension < 20) return "MÍNIMO";
  if (tension < 40) return "BAJO";
  if (tension < 60) return "MEDIO";
  if (tension < 80) return "ALTO";
  return "CRÍTICO";
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 10, background: "#F5F0E8", border: "2px solid #0A0A0A" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export default function PoblacionPage() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ height: 160, background: "#E8E0D8", border: "2.5px solid #0A0A0A", marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  const classes = gameState.socialClasses;
  const totalPop = (gameState.population / 1e6).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO SOCIAL
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          CLASES SOCIALES
        </div>
        <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>
          POBLACIÓN: {totalPop}M
        </div>
      </div>

      {classes.map((sc) => {
        const cfg     = CLASS_CFG[sc.key] ?? { name: sc.key, color: "#888", desc: "" };
        const tension = Math.round(100 - sc.approval);

        return (
          <div
            key={sc.key}
            style={{
              background: "#FFFFFF",
              border: "2.5px solid #0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A",
              padding: 20,
              marginBottom: 14,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: cfg.color }} />

            <div style={{ paddingLeft: 18 }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start", marginBottom: 16, paddingBottom: 14, borderBottom: "1.5px solid #E8E0D8" }}>
                <div>
                  <div style={{ background: cfg.color, color: "#FFFFFF", fontSize: 9, fontWeight: 800, letterSpacing: 2, padding: "3px 10px", display: "inline-block", marginBottom: 6 }}>
                    {cfg.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>{cfg.desc}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FFM, fontSize: 36, color: "#0A0A0A", lineHeight: 1 }}>
                    {sc.populationPercent.toFixed(1)}<span style={{ fontSize: 16 }}>%</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1 }}>DE POBLACIÓN</div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 8 }}>TENSIÓN SOCIAL</div>
                  <div style={{ fontFamily: FFM, fontSize: 24, color: "#0A0A0A", marginBottom: 8 }}>{tension}%</div>
                  <Bar value={tension} color={cfg.color} />
                  <span style={{ background: cfg.color, color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "2px 6px", display: "inline-block", marginTop: 5 }}>
                    {riskLabel(tension)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 8 }}>APROBACIÓN</div>
                  <div style={{ fontFamily: FFM, fontSize: 24, color: "#0A0A0A", marginBottom: 8 }}>{sc.approval.toFixed(1)}%</div>
                  <Bar value={sc.approval} color="#00C87E" />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 8 }}>INGRESO ANUAL PROM.</div>
                  <div style={{ fontFamily: FFM, fontSize: 22, color: "#00C2B8", marginBottom: 4, lineHeight: 1.1 }}>
                    ${sc.averageIncome.toLocaleString("es-ES")}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#888" }}>AKN CREDITS</div>
                </div>
              </div>

              {/* Education & Health */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#666" }}>EDUCACIÓN</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#00C2B8" }}>{sc.educationLevel.toFixed(0)}/100</span>
                  </div>
                  <Bar value={sc.educationLevel} color="#00C2B8" />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#666" }}>ACCESO A SALUD</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#00C87E" }}>{sc.healthAccess.toFixed(0)}/100</span>
                  </div>
                  <Bar value={sc.healthAccess} color="#00C87E" />
                </div>
              </div>

              {/* Demands */}
              {sc.demands.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 1.5, marginBottom: 6 }}>DEMANDAS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {sc.demands.map((d) => (
                      <span
                        key={d}
                        style={{
                          border: "2px solid #0A0A0A",
                          fontSize: 10, fontWeight: 700, color: "#0A0A0A",
                          padding: "2px 8px", background: "#F5F0E8",
                          letterSpacing: 0.5,
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
