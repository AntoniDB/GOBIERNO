"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp } from "lucide-react";

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

function getApprovalColor(value: number): string {
  if (value >= 60) return "bg-accent";
  if (value >= 35) return "bg-chart-5";
  return "bg-destructive";
}

export function ApprovalBreakdown() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const classes = gameState.socialClasses;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ThumbsUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Aprobación por clase social
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {classes.map((sc) => {
          const label = CLASS_LABELS[sc.key] ?? sc.key;
          const textColor = CLASS_COLORS[sc.key] ?? "text-muted-foreground";
          const barColor = getApprovalColor(sc.approval);
          const approval = sc.approval;

          return (
            <Card key={sc.key} size="sm">
              <CardContent className="flex flex-col gap-1.5 py-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${textColor}`}>
                    {label}
                  </span>
                  <span className={`text-xs text-muted-foreground`}>
                    {sc.populationPercent.toFixed(0)}% pob.
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {approval.toFixed(0)}%
                </span>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(100, approval)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
