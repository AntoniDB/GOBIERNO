"use client";

import { useState } from "react";
import type { OfficialState } from "@/lib/engine/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { InvestigationOrder } from "./investigation-order";
import {
  UsersIcon,
  SearchIcon,
  ShieldAlertIcon,
  StarIcon,
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  MINISTER: "Ministro",
  JUDGE: "Juez",
  PROSECUTOR: "Fiscal",
  GENERAL: "General",
  CHIEF_OF_INTELLIGENCE: "Jefe de Inteligencia",
  COMPTROLLER: "Contralor",
  POLITICAL_LEADER: "Lider politico",
};

const ROLE_BADGE: Record<string, string> = {
  MINISTER: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  JUDGE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PROSECUTOR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  GENERAL: "bg-red-500/20 text-red-400 border-red-500/30",
  CHIEF_OF_INTELLIGENCE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  COMPTROLLER: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POLITICAL_LEADER: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  INVESTIGATED: "Investigado",
  INDICTED: "Procesado",
  CONVICTED: "Condenado",
  DISMISSED: "Despedido",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  INVESTIGATED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  INDICTED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CONVICTED: "bg-red-500/20 text-red-400 border-red-500/30",
  DISMISSED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function CorruptionBar({ value }: { value: number }) {
  const pct = Math.round(value);
  const indicatorColor =
    value < 20
      ? "bg-green-500"
      : value < 50
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">Corrupción</span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${indicatorColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0 text-right">{pct}%</span>
    </div>
  );
}

export function OfficialList({
  officials,
  onInvestigate,
}: {
  officials: OfficialState[];
  onInvestigate: (officialId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [investigateTarget, setInvestigateTarget] = useState<OfficialState | null>(null);

  const filtered = officials
    .filter((o) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        (ROLE_LABEL[o.role] ?? o.role).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.corruption - a.corruption);

  if (officials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <UsersIcon className="size-12 opacity-30" />
        <p>No hay funcionarios registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionario por nombre o rol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((o) => {
          const canInvestigate = o.status === "ACTIVE";

          return (
            <Card key={o.id} size="sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="truncate">{o.name}</CardTitle>
                  {canInvestigate && (
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => setInvestigateTarget(o)}
                      className="shrink-0"
                    >
                      <ShieldAlertIcon className="size-3" />
                      Investigar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[o.role] ?? ""}`}>
                    {ROLE_LABEL[o.role] ?? o.role}
                  </Badge>
                  {o.status && (
                    <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[o.status] ?? ""}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  )}
                </div>

                <CorruptionBar value={Math.min(o.corruption, 100)} />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <StarIcon className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Habilidad:</span>
                    <span className="font-medium">{Math.round(o.skill)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UsersIcon className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Reputación:</span>
                    <span className="font-medium">{Math.round(o.reputation)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && officials.length > 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron funcionarios con ese criterio.
        </p>
      )}

      <InvestigationOrder
        open={!!investigateTarget}
        onClose={() => setInvestigateTarget(null)}
        official={investigateTarget}
        onConfirm={(officialId) => {
          onInvestigate(officialId);
          setInvestigateTarget(null);
        }}
      />
    </div>
  );
}
