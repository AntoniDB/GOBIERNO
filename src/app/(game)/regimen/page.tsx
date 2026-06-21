"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle } from "lucide-react";

interface MetricDef {
  key: string;
  label: string;
  description: string;
  higherBetter: boolean;
}

const METRICS: MetricDef[] = [
  {
    key: "powerConcentration",
    label: "Concentración de poder",
    description: "Cuánto poder acumula el ejecutivo frente a otros poderes",
    higherBetter: false,
  },
  {
    key: "pressFreedom",
    label: "Libertad de prensa",
    description: "Grado de independencia y libertad de los medios",
    higherBetter: true,
  },
  {
    key: "judicialIndependence",
    label: "Independencia judicial",
    description: "Autonomía del Poder Judicial frente al ejecutivo",
    higherBetter: true,
  },
  {
    key: "politicalPluralism",
    label: "Pluralismo político",
    description: "Diversidad y competencia de partidos políticos",
    higherBetter: true,
  },
  {
    key: "civilLiberties",
    label: "Libertades civiles",
    description: "Protección de derechos individuales y colectivos",
    higherBetter: true,
  },
  {
    key: "transparency",
    label: "Transparencia",
    description: "Acceso a la información y rendición de cuentas",
    higherBetter: true,
  },
  {
    key: "militarySubordination",
    label: "Subordinación militar",
    description: "Control civil sobre las fuerzas armadas",
    higherBetter: true,
  },
];

function getRegimeBadgeClass(regimeType: string): string {
  switch (regimeType) {
    case "Democracia plena":
      return "bg-accent/20 text-accent border-accent/40";
    case "Democracia defectuosa":
      return "bg-chart-5/20 text-chart-5 border-chart-5/40";
    case "Régimen híbrido":
      return "bg-orange-400/20 text-orange-400 border-orange-400/40";
    case "Autoritarismo electoral":
      return "bg-destructive/20 text-destructive border-destructive/40";
    case "Dictadura":
      return "bg-destructive text-destructive-foreground";
    case "Estado fallido":
      return "bg-destructive/80 text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getMetricColor(value: number, higherBetter: boolean): string {
  if (higherBetter) {
    if (value >= 70) return "bg-accent";
    if (value >= 40) return "bg-chart-5";
    return "bg-destructive";
  }
  // Para concentración de poder: más bajo = mejor
  if (value <= 30) return "bg-accent";
  if (value <= 55) return "bg-chart-5";
  return "bg-destructive";
}

export default function RegimenPage() {
  const gameState = useGameStore((s) => s.gameState);
  const lastTurnResult = useGameStore((s) => s.lastTurnResult);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const metrics = gameState.regimeMetrics;
  const snapshot = lastTurnResult?.monthSnapshot;
  const regimeType = snapshot?.regimeType ?? "—";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Régimen Político</h1>
      </div>

      {/* Badge del tipo de régimen */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Clasificación actual:</span>
        <Badge className={`text-sm px-3 py-1 ${getRegimeBadgeClass(regimeType)}`}>
          {regimeType}
        </Badge>
        {regimeType === "Dictadura" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Riesgo de sanciones internacionales y fuga de capitales
          </span>
        )}
        {regimeType === "Estado fallido" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Posible game over: regiones se autonomizan, grupos armados emergen
          </span>
        )}
      </div>

      {/* 7 métricas con barras */}
      <div className="space-y-3">
        {METRICS.map((metric) => {
          const rawValue = metrics[metric.key as keyof typeof metrics];
          const value = typeof rawValue === "number" ? rawValue : 0;
          const colorClass = getMetricColor(value, metric.higherBetter);

          return (
            <Card key={metric.key} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {metric.label}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {metric.description}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${colorClass.replace("bg-", "text-")}`}>
                    {value.toFixed(0)}/100
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${colorClass}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                {/* Marcadores de umbral */}
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
