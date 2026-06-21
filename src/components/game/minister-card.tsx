"use client";

import type { OfficialState } from "@/lib/engine/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { User } from "lucide-react";

interface MinisterCardProps {
  minister: OfficialState | null | undefined;
}

function StatBar({
  label,
  value,
  max,
  colorFn,
}: {
  label: string;
  value: number;
  max: number;
  colorFn: (v: number) => string;
}) {
  const color = colorFn(value);
  return (
    <Progress value={value} max={max}>
      <ProgressLabel className="text-xs text-muted-foreground w-20 shrink-0">{label}</ProgressLabel>
      <ProgressTrack>
        <ProgressIndicator className={color} />
      </ProgressTrack>
      <ProgressValue className="text-xs w-10" />
    </Progress>
  );
}

function IdeologyBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const absVal = Math.abs(value);
  const isPositive = value > 0;
  const percent = Math.min((absVal / 100) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground font-medium">{value > 0 ? "+" : ""}{value}</span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-0.5 bg-muted-foreground/30" style={{ left: "50%" }} />
        <div
          className={`h-full rounded-full transition-all ${isPositive ? "bg-destructive/70 ml-auto" : "bg-blue-400 mr-auto"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
    </div>
  );
}

export function MinisterCard({ minister }: MinisterCardProps) {
  if (!minister) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center justify-center gap-2">
          <User className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin ministro asignado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold">{minister.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {minister.role}
            </Badge>
          </div>
        </div>
        <Badge
          variant={minister.status === "active" ? "default" : "outline"}
          className="text-xs mt-1"
        >
          {minister.status === "active" ? "Activo" : minister.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <StatBar
            label="Habilidad"
            value={minister.skill}
            max={100}
            colorFn={(v) => (v >= 70 ? "bg-accent" : v >= 40 ? "bg-chart-5" : "bg-destructive")}
          />
          <StatBar
            label="Corrupción"
            value={minister.corruption}
            max={100}
            colorFn={(v) => (v > 50 ? "bg-destructive" : v > 20 ? "bg-chart-5" : "bg-accent")}
          />
          <StatBar
            label="Lealtad"
            value={minister.loyalty}
            max={100}
            colorFn={(v) => (v >= 70 ? "bg-accent" : v >= 40 ? "bg-chart-5" : "bg-destructive")}
          />
          <StatBar
            label="Reputación"
            value={minister.reputation}
            max={100}
            colorFn={(v) => (v >= 60 ? "bg-accent" : v >= 30 ? "bg-chart-5" : "bg-destructive")}
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ideología</p>
          <IdeologyBar label="Económico" value={minister.ideology.economic} />
          <IdeologyBar label="Social" value={minister.ideology.social} />
          <IdeologyBar label="Autoridad" value={minister.ideology.authority} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Riqueza</span>
          <span className="text-sm font-medium tabular-nums text-foreground">
            {minister.wealth.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
