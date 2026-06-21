"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Heart,
  GraduationCap,
  ThumbsUp,
} from "lucide-react";

const CLASS_LABELS: Record<string, string> = {
  EXTREME_POVERTY: "Extrema Pobreza",
  POVERTY: "Pobreza",
  MIDDLE: "Clase Media",
  ELITE: "Élite",
};

const CLASS_COLORS: Record<string, string> = {
  EXTREME_POVERTY: "text-destructive",
  POVERTY: "text-chart-5",
  MIDDLE: "text-accent",
  ELITE: "text-primary",
};

const CLASS_BG: Record<string, string> = {
  EXTREME_POVERTY: "bg-destructive/10",
  POVERTY: "bg-chart-5/10",
  MIDDLE: "bg-accent/10",
  ELITE: "bg-primary/10",
};

function getApprovalColor(value: number): string {
  if (value >= 60) return "text-accent";
  if (value >= 35) return "text-chart-5";
  return "text-destructive";
}

export default function PoblacionPage() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const classes = gameState.socialClasses;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Población</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {classes.map((sc) => {
          const label = CLASS_LABELS[sc.key] ?? sc.key;
          const colorClass = CLASS_COLORS[sc.key] ?? "text-muted-foreground";
          const bgClass = CLASS_BG[sc.key] ?? "bg-muted";
          const approvalColor = getApprovalColor(sc.approval);

          return (
            <Card key={sc.key} className={`border-l-4 ${colorClass.replace("text-", "border-")}/${40}`}>
              <CardContent className="flex flex-col gap-3 pt-4">
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${colorClass}`}>
                    {label}
                  </h3>
                  <Badge className={bgClass}>
                    {sc.populationPercent.toFixed(1)}% de la población
                  </Badge>
                </div>

                {/* Barra de población */}
                <div className="space-y-1">
                  <div className="h-2.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${colorClass.replace("text-", "bg-")}`}
                      style={{ width: `${sc.populationPercent}%` }}
                    />
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Aprobación */}
                  <div className="flex items-center gap-2">
                    <ThumbsUp className={`h-4 w-4 ${approvalColor}`} />
                    <span className="text-sm text-muted-foreground">Aprobación</span>
                    <span className={`text-sm font-bold ml-auto ${approvalColor}`}>
                      {sc.approval.toFixed(1)}%
                    </span>
                  </div>

                  {/* Ingreso */}
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ingreso</span>
                    <span className="text-sm font-bold ml-auto">
                      ${sc.averageIncome.toLocaleString("es-ES")}
                    </span>
                  </div>

                  {/* Educación */}
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Educación</span>
                    <span className="text-sm font-bold ml-auto">
                      {sc.educationLevel.toFixed(0)}/100
                    </span>
                  </div>

                  {/* Salud */}
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Salud</span>
                    <span className="text-sm font-bold ml-auto">
                      {sc.healthAccess.toFixed(0)}/100
                    </span>
                  </div>
                </div>

                {/* Demandas */}
                {sc.demands.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1.5">Demandas:</p>
                    <div className="flex flex-wrap gap-1">
                      {sc.demands.map((d) => (
                        <Badge key={d} variant="outline" className="text-xs">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
