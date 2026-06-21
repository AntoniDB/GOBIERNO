"use client";

import type { MediaState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, Tv, Globe, AlertTriangle, Shield } from "lucide-react";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TV: "Televisión",
  NEWSPAPER: "Periódico",
  DIGITAL: "Digital",
};

const MEDIA_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TV: Tv,
  NEWSPAPER: Radio,
  DIGITAL: Globe,
};

function getAffinityColor(value: number): string {
  if (value > 30) return "text-accent";
  if (value < -30) return "text-destructive";
  return "text-muted-foreground";
}

function getAffinityBg(value: number): string {
  if (value > 30) return "bg-accent";
  if (value < -30) return "bg-destructive";
  return "bg-muted-foreground";
}

function getAffinityLabel(value: number): string {
  if (value > 50) return "Muy afín al gobierno";
  if (value > 20) return "Afín al gobierno";
  if (value > -20) return "Neutral";
  if (value > -50) return "Opositor al gobierno";
  return "Muy opositor al gobierno";
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Activo", className: "bg-accent/20 text-accent border-accent/40" };
    case "CENSORED":
      return { label: "Censurado", className: "bg-chart-5/20 text-chart-5 border-chart-5/40" };
    case "CLOSED":
      return { label: "Clausurado", className: "bg-destructive/20 text-destructive border-destructive/40" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

interface MediaCardProps {
  medium: MediaState;
}

export default function MediaCard({ medium }: MediaCardProps) {
  const setMediaAction = useGameStore((s) => s.setMediaAction);
  const pendingInput = useGameStore((s) => s.pendingInput);
  const Icon = MEDIA_TYPE_ICONS[medium.type] ?? Radio;
  const typeLabel = MEDIA_TYPE_LABELS[medium.type] ?? medium.type;
  const affinityColor = getAffinityColor(medium.governmentAffinity);
  const affinityBg = getAffinityBg(medium.governmentAffinity);
  const affinityLabel = getAffinityLabel(medium.governmentAffinity);
  const statusInfo = getStatusBadge(medium.status);

  const currentAction = pendingInput.mediaActions?.[medium.id];

  return (
    <Card className="border-l-4 border-l-muted/40">
      <CardContent className="flex flex-col gap-4 pt-4">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {medium.name}
              </h3>
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
            </div>
          </div>
          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
        </div>

        {/* Barra de afinidad gubernamental */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Afinidad al gobierno</span>
            <span className={`text-xs font-semibold ${affinityColor}`}>
              {affinityLabel}
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-muted">
            {/* Punto neutro en el centro */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-border" />
            {/* Barra de afinidad */}
            <div
              className={`absolute h-full rounded-full transition-all ${affinityBg}`}
              style={{
                left: "50%",
                width: `${Math.abs(medium.governmentAffinity) / 2}%`,
                transform:
                  medium.governmentAffinity >= 0
                    ? "translateX(0)"
                    : "translateX(-100%)",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Alcance</span>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${medium.reach}%` }}
              />
            </div>
            <span className="text-xs font-medium">{medium.reach}/100</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Credibilidad</span>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${medium.credibility}%` }}
              />
            </div>
            <span className="text-xs font-medium">{medium.credibility}/100</span>
          </div>
        </div>

        {/* Acciones */}
        {medium.status === "ACTIVE" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentAction === "censor"}
              onClick={() => setMediaAction(medium.id, "censor")}
              className="text-xs"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Censurar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentAction === "close"}
              onClick={() => setMediaAction(medium.id, "close")}
              className="text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              Clausurar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentAction === "boost"}
              onClick={() => setMediaAction(medium.id, "boost")}
              className="text-xs"
            >
              Impulsar
            </Button>
            {currentAction && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setMediaAction(medium.id, "none")}
              >
                Cancelar
              </Button>
            )}
          </div>
        )}

        {(medium.status === "CENSORED" || medium.status === "CLOSED") && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentAction === "restore"}
              onClick={() => setMediaAction(medium.id, "restore")}
              className="text-xs"
            >
              <Shield className="h-3 w-3 mr-1" />
              Restaurar medio
            </Button>
            {currentAction && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setMediaAction(medium.id, "none")}
              >
                Cancelar
              </Button>
            )}
          </div>
        )}

        {/* Badge de acción pendiente */}
        {currentAction && currentAction !== "none" && (
          <div className="pt-1">
            <Badge variant="secondary" className="text-xs">
              Acción pendiente: {currentAction === "censor" ? "Censurar" : currentAction === "close" ? "Clausurar" : currentAction === "boost" ? "Impulsar" : "Restaurar"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
