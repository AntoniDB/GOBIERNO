"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportChart, type ChartSeries } from "@/components/game/report-chart";
import { getSnapshots } from "@/app/actions/game";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthSnapshotData } from "@/lib/engine/types";

const REASON_TITLES: Record<string, string> = {
  golpe_estado: "Golpe de Estado",
  juicio_politico: "Juicio Politico",
  renuncia_forzada: "Renuncia Forzada",
  perdida_electoral: "Perdida Electoral",
  fin_mandato: "Fin de Mandato",
  asesinato: "Asesinato",
  estado_fallido: "Estado Fallido",
};

export default function FinPage() {
  const router = useRouter();
  const gameState = useGameStore((s) => s.gameState);
  const gameOver = useGameStore((s) => s.gameOver);
  const gameId = useGameStore((s) => s.gameId);
  const setSnapshots = useGameStore((s) => s.setSnapshots);
  const snapshots = useGameStore((s) => s.snapshots);
  const [chartSnapshots, setChartSnapshots] = useState<MonthSnapshotData[]>([]);

  useEffect(() => {
    if (!gameOver) {
      router.push("/dashboard");
      return;
    }
    if (gameId) {
      getSnapshots(gameId).then((s) => {
        if (s && s.length > 0) {
          setSnapshots(s);
          setChartSnapshots(s);
        }
      });
    } else if (snapshots.length > 0) {
      setChartSnapshots(snapshots);
    }
  }, [gameOver, gameId, router, setSnapshots, snapshots]);

  if (!gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-64 w-96 rounded-xl" />
      </div>
    );
  }

  const yearsInPower = gameState
    ? `${gameState.currentYear} año(s) y ${gameState.currentMonth} mes(es)`
    : "Desconocido";

  const chartData = chartSnapshots.map((s: MonthSnapshotData) => ({
    label: `A${s.year}M${s.month}`,
    aprobacion: s.approval,
    corrupcion: s.corruption,
    pib: s.gdp,
    tesoreria: s.treasury,
  }));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-destructive">Fin de la Partida</h1>
          <div className="inline-block px-4 py-1.5 bg-destructive/10 text-destructive rounded-full text-sm font-medium">
            {REASON_TITLES[gameOver.reason] ?? gameOver.reason}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {gameOver.description}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Tiempo en el poder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{yearsInPower}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Regimen final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{gameOver.regimeType}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Aprobacion final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{gameOver.approval.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                PIB final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">
                ${(gameOver.gdp / 1_000_000_000).toFixed(1)}B
              </p>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 1 && (
          <ReportChart
            title="Evolucion historica de la partida"
            data={chartData}
            series={[
              { dataKey: "aprobacion", name: "Aprobacion (%)", color: "var(--color-chart-2)" },
              { dataKey: "corrupcion", name: "Corrupcion (%)", color: "var(--color-destructive)" },
            ]}
            chartType="line"
            valueFormatter={(v) => `${v.toFixed(1)}%`}
            domain={[0, 100]}
            height={200}
          />
        )}

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => router.push("/nueva-partida")}
          >
            Nueva Partida
          </Button>
        </div>
      </div>
    </main>
  );
}
