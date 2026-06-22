"use client";

import { useState, useMemo } from "react";
import type { OfficialState, MinistryState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  UserPlus,
  Star,
  ShieldAlert,
  HeartHandshake,
  Briefcase,
  Building2,
  Coins,
  TrendingUp,
  Users2,
  Gavel,
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  MINISTER: "Ministro",
  JUDGE: "Juez",
  PROSECUTOR: "Fiscal",
  GENERAL: "General",
  CHIEF_OF_INTELLIGENCE: "Jefe de Inteligencia",
  COMPTROLLER: "Contralor",
  OMBUDSMAN: "Defensor del Pueblo",
  CENTRAL_BANK_PRESIDENT: "Presidente Banco Central",
  POLITICAL_LEADER: "Lider politico",
};

const MINISTRY_NAMES: Record<string, string> = {
  HEALTH: "Salud",
  EDUCATION: "Educacion",
  ECONOMY: "Economia",
  DEFENSE: "Defensa",
  SECURITY: "Seguridad",
  JUSTICE: "Justicia",
  AGRICULTURE: "Agricultura",
  SOCIAL_DEVELOPMENT: "Desarrollo Social",
};

interface MinisterSelectorProps {
  open: boolean;
  onClose: () => void;
  ministry: MinistryState;
}

function getCurrentAssignment(
  official: OfficialState,
  ministries: MinistryState[],
  parties: { id: string; name: string }[]
): string {
  if (official.ministryId) {
    const m = ministries.find((m) => m.id === official.ministryId);
    if (m) return `Ministro de ${MINISTRY_NAMES[m.key] ?? m.key}`;
    return "Ministro (sin ministerio)";
  }
  if (official.role === "POLITICAL_LEADER" && official.partyId) {
    const p = parties.find((p) => p.id === official.partyId);
    if (p) return `Lider de ${p.name}`;
  }
  return ROLE_LABEL[official.role] ?? official.role;
}

function getPartyName(
  official: OfficialState,
  parties: { id: string; name: string }[]
): string {
  if (!official.partyId) return "Independiente";
  const p = parties.find((p) => p.id === official.partyId);
  return p?.name ?? "Independiente";
}

export function MinisterSelector({ open, onClose, ministry }: MinisterSelectorProps) {
  const gameState = useGameStore((s) => s.gameState);
  const appointMinister = useGameStore((s) => s.appointMinister);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (!gameState) return [];
    return gameState.officials.filter(
      (o) => o.status === "ACTIVE"
    );
  }, [gameState]);

  if (!gameState) return null;

  const currentMinister = ministry.ministerOfficialId
    ? gameState.officials.find((o) => o.id === ministry.ministerOfficialId)
    : null;

  function handleConfirm() {
    if (selectedId) {
      appointMinister(ministry.key, selectedId);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Cambiar ministro de {MINISTRY_NAMES[ministry.key] ?? ministry.key}
          </DialogTitle>
          <DialogDescription>
            {currentMinister
              ? `Titular actual: ${currentMinister.name}. Selecciona un reemplazo entre todos los funcionarios activos.`
              : "Sin titular. Selecciona un funcionario para el cargo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              official={c}
              isCurrent={c.id === ministry.ministerOfficialId}
              isSelected={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
              ministries={gameState.ministries}
              parties={gameState.parties}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Confirmar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidateRow({
  official,
  isCurrent,
  isSelected,
  onClick,
  ministries,
  parties,
}: {
  official: OfficialState;
  isCurrent: boolean;
  isSelected: boolean;
  onClick: () => void;
  ministries: MinistryState[];
  parties: { id: string; name: string }[];
}) {
  const partyName = getPartyName(official, parties);
  const assignment = getCurrentAssignment(official, ministries, parties);

  return (
    <button
      onClick={onClick}
      disabled={isCurrent}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary"
          : isCurrent
          ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <div className="space-y-2">
        {/* Nombre + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{official.name}</span>
          {isCurrent && (
            <Badge variant="outline" className="text-[10px]">Actual</Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">{partyName}</Badge>
        </div>

        {/* Cargo actual */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Briefcase className="size-3 shrink-0" />
          <span>{assignment}</span>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Star className="size-3 text-amber-400 shrink-0" />
            <span className="text-muted-foreground">Hab</span>
            <span className="tabular-nums font-medium">{Math.round(official.skill)}</span>
          </div>
          <div className="flex items-center gap-1">
            <ShieldAlert className={`size-3 shrink-0 ${official.corruption > 40 ? "text-destructive" : "text-muted-foreground"}`} />
            <span className="text-muted-foreground">Corr</span>
            <span className={`tabular-nums font-medium ${official.corruption > 40 ? "text-destructive" : ""}`}>
              {Math.round(official.corruption)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <HeartHandshake className="size-3 text-blue-400 shrink-0" />
            <span className="text-muted-foreground">Leal</span>
            <span className="tabular-nums font-medium">{Math.round(official.loyalty)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="size-3 text-emerald-400 shrink-0" />
            <span className="text-muted-foreground">${(official.wealth / 1000).toFixed(0)}K</span>
          </div>
        </div>

        {/* Barra de habilidad */}
        <Progress value={official.skill} max={100} />

        {/* Ideologia compacta */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="size-2.5" />
            Eco: {official.ideology.economic > 0 ? "+" : ""}{official.ideology.economic}
          </span>
          <span className="flex items-center gap-1">
            <Users2 className="size-2.5" />
            Soc: {official.ideology.social > 0 ? "+" : ""}{official.ideology.social}
          </span>
          <span className="flex items-center gap-1">
            <Gavel className="size-2.5" />
            Aut: {official.ideology.authority > 0 ? "+" : ""}{official.ideology.authority}
          </span>
        </div>
      </div>
    </button>
  );
}
