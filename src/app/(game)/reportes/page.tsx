"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getSnapshots } from "@/app/actions/game";
import { ReportChart, type ChartSeries } from "@/components/game/report-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthSnapshotData } from "@/lib/engine/types";

type TabKey = "economia" | "social" | "gobierno" | "regimen";

export default function ReportesPage() {
  const gameState = useGameStore((s) => s.gameState);
  const gameId = useGameStore((s) => s.gameId);
  const snapshots = useGameStore((s) => s.snapshots);
  const setSnapshots = useGameStore((s) => s.setSnapshots);
  const [tab, setTab] = useState<TabKey>("economia");

  useEffect(() => {
    if (gameId && snapshots.length === 0) {
      getSnapshots(gameId).then((s) => {
        if (s) setSnapshots(s);
      });
    }
  }, [gameId, snapshots.length, setSnapshots]);

  const chartData = useMemo(() => {
    return snapshots.map((s: MonthSnapshotData) => ({
      label: `A${s.year}M${s.month}`,
      tesoreria: s.treasury,
      pib: s.gdp,
      inflacion: s.inflation,
      pobreza: s.povertyRate,
      desempleo: s.unemploymentRate,
      salud: 100 - s.sickRate,
      alimentacion: s.foodSecurity,
      crimen: s.crimeRate,
      educacion: s.educationLevel,
      gini: s.gini,
      aprobacion: s.approval,
      corrupcion: s.corruption,
      tipoRegimen: s.regimeType,
    }));
  }, [snapshots]);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const tabItems: { key: TabKey; label: string }[] = [
    { key: "economia", label: "Economia" },
    { key: "social", label: "Social" },
    { key: "gobierno", label: "Gobierno" },
    { key: "regimen", label: "Regimen" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes Historicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Datos acumulados de {chartData.length} meses
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="mb-4">
          {tabItems.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ECONOMIA */}
        <TabsContent value="economia" className="space-y-6">
          <ReportChart
            title="Tesorería"
            data={chartData}
            series={[
              { dataKey: "tesoreria", name: "Tesorería ($)", color: "var(--color-chart-1)" },
            ]}
            chartType="area"
            valueFormatter={(v) => {
              if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
              return `$${(v / 1_000_000).toFixed(0)}M`;
            }}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportChart
              title="PIB"
              data={chartData}
              series={[
                { dataKey: "pib", name: "PIB ($)", color: "var(--color-chart-2)" },
              ]}
              chartType="area"
              valueFormatter={(v) => {
                if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
                return `$${(v / 1_000_000).toFixed(0)}M`;
              }}
            />
            <ReportChart
              title="Inflación"
              data={chartData}
              series={[
                { dataKey: "inflacion", name: "Inflación (%)", color: "var(--color-destructive)" },
              ]}
              chartType="line"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>
        </TabsContent>

        {/* SOCIAL */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportChart
              title="Pobreza"
              data={chartData}
              series={[
                { dataKey: "pobreza", name: "Tasa de pobreza (%)", color: "var(--color-destructive)" },
              ]}
              chartType="area"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <ReportChart
              title="Desempleo"
              data={chartData}
              series={[
                { dataKey: "desempleo", name: "Desempleo (%)", color: "var(--color-chart-3)" },
              ]}
              chartType="area"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportChart
              title="Salud y Alimentación"
              data={chartData}
              series={[
                { dataKey: "salud", name: "Salud (%)", color: "var(--color-chart-2)" },
                { dataKey: "alimentacion", name: "Seg. Alimentaria (%)", color: "var(--color-chart-4)" },
              ]}
              chartType="line"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
              domain={[0, 100]}
            />
            <ReportChart
              title="Crimen"
              data={chartData}
              series={[
                { dataKey: "crimen", name: "Tasa de crimen (%)", color: "var(--color-destructive)" },
              ]}
              chartType="area"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportChart
              title="Educación"
              data={chartData}
              series={[
                { dataKey: "educacion", name: "Nivel educativo", color: "var(--color-chart-1)" },
              ]}
              chartType="line"
              valueFormatter={(v) => `${v.toFixed(1)}`}
              domain={[0, 100]}
            />
            <ReportChart
              title="Desigualdad (Gini)"
              data={chartData}
              series={[
                { dataKey: "gini", name: "Coeficiente Gini", color: "var(--color-chart-3)" },
              ]}
              chartType="line"
              valueFormatter={(v) => `${v.toFixed(1)}`}
              domain={[0, 100]}
            />
          </div>
        </TabsContent>

        {/* GOBIERNO */}
        <TabsContent value="gobierno" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportChart
              title="Aprobación General"
              data={chartData}
              series={[
                { dataKey: "aprobacion", name: "Aprobación (%)", color: "var(--color-chart-2)" },
              ]}
              chartType="area"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
              domain={[0, 100]}
            />
            <ReportChart
              title="Corrupción"
              data={chartData}
              series={[
                { dataKey: "corrupcion", name: "Corrupción (%)", color: "var(--color-destructive)" },
              ]}
              chartType="area"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>
          <ReportChart
            title="Aprobación vs Corrupción"
            data={chartData}
            series={[
              { dataKey: "aprobacion", name: "Aprobación (%)", color: "var(--color-chart-2)" },
              { dataKey: "corrupcion", name: "Corrupción (%)", color: "var(--color-destructive)" },
            ]}
            chartType="line"
            valueFormatter={(v) => `${v.toFixed(1)}%`}
            domain={[0, 100]}
          />
        </TabsContent>

        {/* REGIMEN */}
        <TabsContent value="regimen" className="space-y-6">
          <div className="p-4 bg-muted/30 rounded-lg border border-border mb-4">
            <p className="text-sm text-muted-foreground">
              Tipo de regimen actual:{" "}
              <span className="font-semibold text-foreground">
                {gameState.regimeMetrics
                  ? "Consultar vista de Regimen para detalle"
                  : "No disponible"}
              </span>
            </p>
          </div>
          <ReportChart
            title="Evolución de Régimen (tipo)"
            data={chartData.map((d) => ({
              ...d,
              tipoRegimenValor:
                d.tipoRegimen === "Democracia plena"
                  ? 5
                  : d.tipoRegimen === "Democracia defectuosa"
                  ? 4
                  : d.tipoRegimen === "Regimen hibrido"
                  ? 3
                  : d.tipoRegimen === "Autoritarismo electoral"
                  ? 2
                  : d.tipoRegimen === "Dictadura"
                  ? 1
                  : 0,
            }))}
            series={[
              { dataKey: "tipoRegimenValor", name: "Calidad democratica", color: "var(--color-chart-1)" },
            ]}
            chartType="area"
            valueFormatter={(v) => {
              const labels = ["Estado fallido", "Dictadura", "Autoritarismo", "Regimen hibrido", "Democracia defectuosa", "Democracia plena"];
              return labels[Math.round(v)] ?? `${v}`;
            }}
            domain={[0, 5]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
