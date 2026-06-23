"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { useRouter } from "next/navigation";
import { ReportChart } from "@/components/game/report-chart";
import { getSnapshots } from "@/app/actions/game";
import type { MonthSnapshotData } from "@/lib/engine/types";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

const REASON_TITLES: Record<string, string> = {
  golpe_estado:       "GOLPE DE ESTADO",
  juicio_politico:    "JUICIO POLÍTICO",
  renuncia_forzada:   "RENUNCIA FORZADA",
  perdida_electoral:  "PÉRDIDA ELECTORAL",
  fin_mandato:        "FIN DE MANDATO",
  asesinato:          "ASESINATO",
  estado_fallido:     "ESTADO FALLIDO",
};

const CLASS_LABELS: Record<string, string> = {
  EXTREME_POVERTY: "Pobreza Extrema",
  POVERTY:         "Pobreza",
  MIDDLE:          "Clase Media",
  ELITE:           "Élite",
};

export default function FinPage() {
  const router      = useRouter();
  const gameState   = useGameStore((s) => s.gameState);
  const gameOver    = useGameStore((s) => s.gameOver);
  const gameId      = useGameStore((s) => s.gameId);
  const setSnapshots= useGameStore((s) => s.setSnapshots);
  const snapshots   = useGameStore((s) => s.snapshots);
  const [chartSnapshots, setChartSnapshots] = useState<MonthSnapshotData[]>(snapshots);

  useEffect(() => {
    if (!gameOver) { router.push("/dashboard"); return; }
    if (!gameId) return;
    getSnapshots(gameId).then((s) => {
      if (s && s.length > 0) { setSnapshots(s); setChartSnapshots(s); }
    });
  }, [gameOver, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gameOver) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F0E8" }}>
        <div style={{ width: 80, height: 80, border: "3px solid #0A0A0A", background: "#EDE8DF" }} />
      </div>
    );
  }

  const yearsInPower = gameState
    ? `${gameState.currentYear} AÑO(S) Y ${gameState.currentMonth} MES(ES)`
    : "DESCONOCIDO";

  const chartData = chartSnapshots.map((s: MonthSnapshotData) => ({
    label:     `A${s.year}M${s.month}`,
    aprobacion: Number(s.approval) || 0,
    corrupcion: Number(s.corruption) || 0,
    pib:        Number(s.gdp) || 0,
    tesoreria:  Number(s.treasury) || 0,
  }));

  const isGoodEnding = gameOver.reason === "fin_mandato";
  const accentColor  = isGoodEnding ? "#00C87E" : "#FF2090";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F5F0E8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: FF,
      }}
    >
      <div style={{ maxWidth: 680, width: "100%" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              background: accentColor, color: isGoodEnding ? "#0A0A0A" : "#FFFFFF",
              fontSize: 9, fontWeight: 700, letterSpacing: 2.5,
              padding: "4px 16px", display: "inline-block", marginBottom: 12,
            }}
          >
            {REASON_TITLES[gameOver.reason] ?? gameOver.reason.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 36, fontWeight: 900, color: "#0A0A0A",
              letterSpacing: 4, lineHeight: 1, marginBottom: 4,
            }}
          >
            FIN DE PARTIDA
          </div>
          <div style={{ fontSize: 13, color: "#555", fontWeight: 600, letterSpacing: 1 }}>
            {gameState?.countryName?.toUpperCase() ?? "ARKON"}
          </div>
        </div>

        {/* Description card */}
        <div
          style={{
            background: "#FFFFFF",
            border: `2.5px solid #0A0A0A`,
            borderLeft: `6px solid ${accentColor}`,
            boxShadow: `4px 4px 0 ${accentColor}`,
            padding: 20,
            marginBottom: 18,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: "#444", lineHeight: 1.7 }}>
            {gameOver.description}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 18 }}>
          <StatCard label="TIEMPO EN EL PODER" value={yearsInPower} ffm={FFM} />
          <StatCard label="RÉGIMEN FINAL"       value={gameOver.regimeType?.toUpperCase() ?? "—"} ffm={FFM} />
          <StatCard label="APROBACIÓN FINAL"    value={`${gameOver.approval.toFixed(1)}%`} ffm={FFM} color={gameOver.approval > 50 ? "#00C87E" : "#FF2090"} />
          <StatCard label="PIB FINAL"           value={`${(gameOver.gdp / 1e9).toFixed(1)}B AKN`} ffm={FFM} color="#00C2B8" />

          {gameOver.reason === "perdida_electoral" && gameOver.votePercent !== undefined && (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "#FFFFFF", border: "2.5px solid #0A0A0A",
                boxShadow: "4px 4px 0 #0A0A0A", padding: 20,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 10 }}>
                RESULTADO ELECTORAL
              </div>
              <div
                style={{ fontFamily: FFM, fontSize: 32, color: "#0A0A0A", marginBottom: 14 }}
              >
                {gameOver.votePercent.toFixed(1)}<span style={{ fontSize: 16 }}>% VOTOS</span>
              </div>
              {gameOver.perClassVotes && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {Object.entries(gameOver.perClassVotes).map(([clase, pct]) => (
                    <div key={clase} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: "#666" }}>{CLASS_LABELS[clase] ?? clase}</span>
                      <span style={{ fontFamily: FFM, color: "#0A0A0A" }}>{Number(pct).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Historical chart */}
        {chartData.length > 1 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                background: "#FFFFFF", border: "2.5px solid #0A0A0A",
                boxShadow: "4px 4px 0 #0A0A0A", padding: 20,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #0A0A0A" }}>
                EVOLUCIÓN HISTÓRICA
              </div>
              <ReportChart
                title=""
                data={chartData}
                series={[
                  { dataKey: "aprobacion", name: "Aprobación (%)", color: "#00C2B8" },
                  { dataKey: "corrupcion", name: "Corrupción (%)", color: "#FF2090" },
                ]}
                chartType="line"
                valueFormatter={(v) => `${v.toFixed(1)}%`}
                domain={[0, 100]}
                height={180}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => router.push("/nueva-partida")}
            style={{
              cursor: "pointer",
              padding: "14px 36px",
              background: "#00C2B8",
              border: "2.5px solid #0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A",
              fontFamily: FF,
              fontSize: 14,
              fontWeight: 900,
              color: "#0A0A0A",
              letterSpacing: 3,
            }}
          >
            ▶ NUEVA PARTIDA
          </button>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label, value, ffm, color = "#0A0A0A",
}: {
  label: string; value: string; ffm: string; color?: string;
}) {
  return (
    <div style={{ background: "#FFFFFF", border: "2.5px solid #0A0A0A", boxShadow: "4px 4px 0 #0A0A0A", padding: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: ffm, fontSize: 20, color, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}
