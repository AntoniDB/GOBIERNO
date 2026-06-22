"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { getSnapshots } from "@/app/actions/game";
import { ReportChart } from "@/components/game/report-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Coins,
  TrendingUp,
  Percent,
  Users,
  Heart,
  Shield,
  GraduationCap,
  Scale,
  Landmark,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import type { MonthSnapshotData } from "@/lib/engine/types";

type TabKey = "economia" | "social" | "gobierno" | "regimen";

function getRegimeBadge(regimeType: string) {
  switch (regimeType) {
    case "Democracia plena": return "bg-accent/20 text-accent border-accent/30";
    case "Democracia defectuosa": return "bg-yellow-400/20 text-yellow-400 border-yellow-400/30";
    case "Regimen hibrido": return "bg-orange-400/20 text-orange-400 border-orange-400/30";
    case "Autoritarismo electoral": return "bg-destructive/20 text-destructive border-destructive/30";
    case "Dictadura": return "bg-destructive text-destructive-foreground";
    case "Estado fallido": return "bg-destructive/80 text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

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
      tesoreria: Number(s.treasury) || 0,
      pib: Number(s.gdp) || 0,
      inflacion: Number(s.inflation) || 0,
      pobreza: Number(s.povertyRate) || 0,
      desempleo: Number(s.unemploymentRate) || 0,
      salud: 100 - (Number(s.sickRate) || 0),
      alimentacion: Number(s.foodSecurity) || 0,
      crimen: Number(s.crimeRate) || 0,
      educacion: Number(s.educationLevel) || 0,
      gini: Number(s.gini) || 0,
      aprobacion: Number(s.approval) || 0,
      corrupcion: Number(s.corruption) || 0,
      tipoRegimen: s.regimeType ?? "",
    }));
  }, [snapshots]);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const latestRegime = snapshots.length > 0 ? snapshots[snapshots.length - 1].regimeType : null;

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reportes</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes Historicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {chartData.length} meses de datos acumulados
          </p>
        </div>
        {latestRegime && (
          <Badge className={`text-xs ${getRegimeBadge(latestRegime)}`}>
            {latestRegime}
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="economia">
            <Coins className="size-4" />
            Economia
          </TabsTrigger>
          <TabsTrigger value="social">
            <Users className="size-4" />
            Social
          </TabsTrigger>
          <TabsTrigger value="gobierno">
            <Landmark className="size-4" />
            Gobierno
          </TabsTrigger>
          <TabsTrigger value="regimen">
            <Shield className="size-4" />
            Regimen
          </TabsTrigger>
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
              title="Salud y Seguridad Alimentaria"
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
              title="Desigualdad — Coeficiente Gini"
              data={chartData}
              series={[
                { dataKey: "gini", name: "Gini", color: "var(--color-chart-3)" },
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
          {latestRegime && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
              <AlertTriangle className={`size-5 ${latestRegime === "Estado fallido" || latestRegime === "Dictadura" ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <span className="text-sm text-muted-foreground">Regimen actual: </span>
                <Badge className={`text-xs ${getRegimeBadge(latestRegime)}`}>
                  {latestRegime}
                </Badge>
              </div>
            </div>
          )}
          <ReportChart
            title="Evolución del Régimen"
            data={chartData.map((d) => ({
              ...d,
              tipoRegimenValor:
                d.tipoRegimen === "Democracia plena" ? 5
                : d.tipoRegimen === "Democracia defectuosa" ? 4
                : d.tipoRegimen === "Regimen hibrido" ? 3
                : d.tipoRegimen === "Autoritarismo electoral" ? 2
                : d.tipoRegimen === "Dictadura" ? 1
                : 0,
            }))}
            series={[
              { dataKey: "tipoRegimenValor", name: "Calidad democratica", color: "var(--color-chart-1)" },
            ]}
            chartType="area"
            valueFormatter={(v) => {
              const labels = ["Estado fallido", "Dictadura", "Autoritarismo", "R. hibrido", "Dem. defectuosa", "Dem. plena"];
              return labels[Math.round(v)] ?? `${v}`;
            }}
            domain={[0, 5]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
