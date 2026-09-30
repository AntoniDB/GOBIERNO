"use client";

import type { OfficialState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { candidateHireCost } from "@/lib/engine/candidates";
import {
  UserPlus,
  Star,
  ShieldAlert,
  HeartHandshake,
  Clock,
  Briefcase,
  TrendingUp,
  Users2,
  Gavel,
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  JUDGE: "Juez",
  PROSECUTOR: "Fiscal",
  MINISTER: "Ministro",
  GENERAL: "General",
};

function computeHireCost(official: OfficialState, allOfficials: OfficialState[], population: number): number {
  const sameRoleActive = allOfficials.filter(
    (o) => o.role === official.role && o.status === "ACTIVE"
  ).length;
  return candidateHireCost(sameRoleActive, population);
}

function computeAgeMonths(official: OfficialState): number | null {
  const parts = official.id.split("-");
  if (parts.length < 3) return null;
  return parseInt(parts[2], 10);
}

export function CandidatesPanel() {
  const gameState = useGameStore((s) => s.gameState);
  const hireCandidate = useGameStore((s) => s.hireCandidate);
  const pendingInput = useGameStore((s) => s.pendingInput);

  if (!gameState) return null;

  const candidates = gameState.officials.filter((o) => o.status === "CANDIDATE");
  const pendingHires = pendingInput.hireCandidateIds ?? [];

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <UserPlus className="size-12 opacity-30" />
        <p>No hay candidatos disponibles en este momento.</p>
        <p className="text-xs">
          Cada 6 meses surgiran nuevos candidatos segun el nivel educativo del pais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {candidates.length} candidato(s) disponible(s). Contratalos para ampliar tu equipo de gobierno.
        El costo depende del rol y de cuantos funcionarios activos haya del mismo tipo.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => {
          const cost = computeHireCost(c, gameState.officials, gameState.population);
          const isPending = pendingHires.includes(c.id);
          const treasury = gameState.treasury;
          const canAfford = treasury >= cost;

          return (
            <Card key={c.id} size="sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{c.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {ROLE_LABEL[c.role] ?? c.role}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Clock className="size-2.5" />
                    Candidato
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="size-3 text-amber-400" />
                    <span className="text-muted-foreground">Hab</span>
                    <span className="tabular-nums">{Math.round(c.skill)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldAlert className={`size-3 ${c.corruption > 40 ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className="text-muted-foreground">Corr</span>
                    <span className="tabular-nums">{Math.round(c.corruption)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <HeartHandshake className="size-3 text-blue-400" />
                    <span className="text-muted-foreground">Leal</span>
                    <span className="tabular-nums">{Math.round(c.loyalty)}</span>
                  </div>
                </div>

                <Progress value={c.skill} max={100} />

                {/* Ideologia */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="size-2.5" />
                    Eco: {c.ideology.economic > 0 ? "+" : ""}{c.ideology.economic}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="size-2.5" />
                    Soc: {c.ideology.social > 0 ? "+" : ""}{c.ideology.social}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gavel className="size-2.5" />
                    Aut: {c.ideology.authority > 0 ? "+" : ""}{c.ideology.authority}
                  </span>
                </div>

                {/* Hire button */}
                {isPending ? (
                  <Badge variant="secondary" className="w-full justify-center text-xs">
                    Contratacion pendiente — Avanzar mes
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={canAfford ? "default" : "outline"}
                    disabled={!canAfford}
                    className="w-full gap-1 text-xs"
                    onClick={() => hireCandidate(c.id)}
                  >
                    <Briefcase className="size-3" />
                    Contratar (M$ {(cost / 1_000_000).toFixed(1)})
                    {!canAfford && " — Fondos insuficientes"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
