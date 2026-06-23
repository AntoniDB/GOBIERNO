"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getSnapshots } from "@/app/actions/game";
import { ReportChart } from "@/components/game/report-chart";
import type { MonthSnapshotData } from "@/lib/engine/types";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

type TabKey = "economia" | "social" | "gobierno" | "regimen";

const TABS: { key: TabKey; label: string }[] = [
  { key: "economia", label: "ECONOMÍA" },
  { key: "social",   label: "SOCIAL"   },
  { key: "gobierno", label: "GOBIERNO" },
  { key: "regimen",  label: "RÉGIMEN"  },
];

function getRegimeColor(regimeType: string): string {
  switch (regimeType) {
    case "Democracia plena":         return "#00C87E";
    case "Democracia defectuosa":    return "#E08800";
    case "Regimen hibrido":          return "#FF6600";
    case "Autoritarismo electoral":  return "#FF2090";
    case "Dictadura":                return "#CC2244";
    case "Estado fallido":           return "#CC2244";
    default:                         return "#888888";
  }
}

export default function ReportesPage() {
  const gameState  = useGameStore((s) => s.gameState);
  const gameId     = useGameStore((s) => s.gameId);
  const snapshots  = useGameStore((s) => s.snapshots);
  const setSnapshots = useGameStore((s) => s.setSnapshots);
  const [tab, setTab] = useState<TabKey>("economia");

  useEffect(() => {
    if (gameId && snapshots.length === 0) {
      getSnapshots(gameId).then((s) => { if (s) setSnapshots(s); });
    }
  }, [gameId, snapshots.length, setSnapshots]);

  const chartData = useMemo(() => {
    return snapshots.map((s: MonthSnapshotData) => ({
      label:      `A${s.year}M${s.month}`,
      tesoreria:  Number(s.treasury)       || 0,
      pib:        Number(s.gdp)            || 0,
      inflacion:  Number(s.inflation)      || 0,
      pobreza:    Number(s.povertyRate)    || 0,
      desempleo:  Number(s.unemploymentRate)|| 0,
      salud:      100 - (Number(s.sickRate)|| 0),
      alimentacion:Number(s.foodSecurity)  || 0,
      crimen:     Number(s.crimeRate)      || 0,
      educacion:  Number(s.educationLevel) || 0,
      gini:       Number(s.gini)           || 0,
      aprobacion: Number(s.approval)       || 0,
      corrupcion: Number(s.corruption)     || 0,
      tipoRegimen: s.regimeType ?? "",
    }));
  }, [snapshots]);

  if (!gameState) {
    return (
      <div style={{ maxWidth: 1100, fontFamily: FF }}>
        <div style={{ height: 28, background: "#E8E0D8", marginBottom: 18, width: 200 }} />
        <div style={{ height: 400, background: "#E8E0D8", border: "2.5px solid #0A0A0A" }} />
      </div>
    );
  }

  const latestRegime = snapshots.length > 0 ? snapshots[snapshots.length - 1].regimeType : null;
  const regimeColor  = latestRegime ? getRegimeColor(latestRegime) : "#888";

  function ChartCard({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ background: "#FFFFFF", border: "2.5px solid #0A0A0A", boxShadow: "4px 4px 0 #0A0A0A", padding: 20 }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, fontFamily: FF }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: "#0A0A0A", color: "#FFFFFF", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, padding: "4px 12px", display: "inline-block", marginBottom: 10 }}>
          MÓDULO DE REPORTES
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0A0A0A", letterSpacing: 4, marginBottom: 4 }}>
          REPORTES HISTÓRICOS
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>{chartData.length} MESES DE DATOS</span>
          {latestRegime && (
            <span style={{ background: regimeColor, color: "#FFFFFF", fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "3px 10px" }}>
              {latestRegime.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "2px solid #0A0A0A" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              cursor: "pointer",
              padding: "10px 20px",
              background: tab === t.key ? "#0A0A0A" : "transparent",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #00C2B8" : "2px solid transparent",
              fontFamily: FF,
              fontSize: 12,
              fontWeight: 800,
              color: tab === t.key ? "#FFFFFF" : "#666",
              letterSpacing: 2,
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ECONOMIA */}
      {tab === "economia" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ChartCard>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>TESORERÍA</div>
            <ReportChart
              title=""
              data={chartData}
              series={[{ dataKey: "tesoreria", name: "Tesorería ($)", color: "#00C2B8" }]}
              chartType="area"
              valueFormatter={(v) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`}
            />
          </ChartCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>PIB</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "pib", name: "PIB ($)", color: "#00C87E" }]} chartType="area" valueFormatter={(v) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`} />
            </ChartCard>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>INFLACIÓN</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "inflacion", name: "Inflación (%)", color: "#FF2090" }]} chartType="line" valueFormatter={(v) => `${v.toFixed(1)}%`} />
            </ChartCard>
          </div>
        </div>
      )}

      {/* SOCIAL */}
      {tab === "social" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>POBREZA</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "pobreza", name: "Pobreza (%)", color: "#FF2090" }]} chartType="area" valueFormatter={(v) => `${v.toFixed(1)}%`} />
            </ChartCard>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>DESEMPLEO</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "desempleo", name: "Desempleo (%)", color: "#FF6600" }]} chartType="area" valueFormatter={(v) => `${v.toFixed(1)}%`} />
            </ChartCard>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>SALUD Y SEG. ALIMENTARIA</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "salud", name: "Salud (%)", color: "#00C87E" }, { dataKey: "alimentacion", name: "Seg. Alimentaria (%)", color: "#E08800" }]} chartType="line" valueFormatter={(v) => `${v.toFixed(1)}%`} domain={[0,100]} />
            </ChartCard>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>CRIMEN</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "crimen", name: "Crimen (%)", color: "#CC2244" }]} chartType="area" valueFormatter={(v) => `${v.toFixed(1)}%`} />
            </ChartCard>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>EDUCACIÓN</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "educacion", name: "Nivel Educativo", color: "#2468CC" }]} chartType="line" valueFormatter={(v) => `${v.toFixed(1)}`} domain={[0,100]} />
            </ChartCard>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>DESIGUALDAD — GINI</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "gini", name: "Gini", color: "#8844CC" }]} chartType="line" valueFormatter={(v) => `${v.toFixed(1)}`} domain={[0,100]} />
            </ChartCard>
          </div>
        </div>
      )}

      {/* GOBIERNO */}
      {tab === "gobierno" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>APROBACIÓN GENERAL</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "aprobacion", name: "Aprobación (%)", color: "#00C2B8" }]} chartType="area" valueFormatter={(v) => `${v.toFixed(1)}%`} domain={[0,100]} />
            </ChartCard>
            <ChartCard>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>CORRUPCIÓN</div>
              <ReportChart title="" data={chartData} series={[{ dataKey: "corrupcion", name: "Corrupción (%)", color: "#FF2090" }]} chartType="area" valueFormatter={(v) => `${v.toFixed(1)}%`} />
            </ChartCard>
          </div>
          <ChartCard>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>APROBACIÓN VS CORRUPCIÓN</div>
            <ReportChart title="" data={chartData} series={[{ dataKey: "aprobacion", name: "Aprobación (%)", color: "#00C2B8" }, { dataKey: "corrupcion", name: "Corrupción (%)", color: "#FF2090" }]} chartType="line" valueFormatter={(v) => `${v.toFixed(1)}%`} domain={[0,100]} />
          </ChartCard>
        </div>
      )}

      {/* RÉGIMEN */}
      {tab === "regimen" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {latestRegime && (
            <div style={{ padding: "14px 18px", border: "2.5px solid #0A0A0A", background: regimeColor, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF", letterSpacing: 2 }}>RÉGIMEN ACTUAL:</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF", letterSpacing: 2 }}>{latestRegime.toUpperCase()}</span>
            </div>
          )}
          <ChartCard>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0A0A0A", letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: "1.5px solid #0A0A0A" }}>EVOLUCIÓN DEL RÉGIMEN</div>
            <ReportChart
              title=""
              data={chartData.map((d) => ({
                ...d,
                tipoRegimenValor:
                  d.tipoRegimen === "Democracia plena"         ? 5
                  : d.tipoRegimen === "Democracia defectuosa"  ? 4
                  : d.tipoRegimen === "Regimen hibrido"        ? 3
                  : d.tipoRegimen === "Autoritarismo electoral"? 2
                  : d.tipoRegimen === "Dictadura"              ? 1
                  : 0,
              }))}
              series={[{ dataKey: "tipoRegimenValor", name: "Calidad democrática", color: "#00C2B8" }]}
              chartType="area"
              valueFormatter={(v) => {
                const labels = ["Estado fallido", "Dictadura", "Autoritarismo", "R. híbrido", "Dem. defectuosa", "Dem. plena"];
                return labels[Math.round(v)] ?? `${v}`;
              }}
              domain={[0,5]}
            />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
