"use client";

import { useState } from "react";
import type { LawCatalogEntry, SenatorState, PartyState } from "@/lib/engine/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SearchIcon,
  PlusIcon,
  CheckIcon,
  DollarSignIcon,
} from "lucide-react";
import { LawProposalModal } from "./law-proposal-modal";

export function LawCatalogLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-1">
              <Skeleton className="h-1.5 w-16 rounded-full" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IdeologyBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const clamped = Math.max(-100, Math.min(100, value));

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground w-12 text-right">
        {label}
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-muted relative overflow-hidden">
        <div className="absolute top-0 left-1/2 w-px h-full bg-border z-10" />
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.abs(clamped) / 2}%`,
            marginLeft: clamped >= 0 ? "50%" : `${50 - Math.abs(clamped) / 2}%`,
            background: clamped >= 0
              ? `oklch(${0.55 + Math.abs(clamped) / 300} 0.25 ${25 - clamped / 10})`
              : `oklch(${0.55 + Math.abs(clamped) / 300} 0.22 ${240 + clamped / 2})`,
          }}
        />
      </div>
    </div>
  );
}

function getClassLabel(key: string): string {
  const map: Record<string, string> = {
    EXTREME_POVERTY: "Extrema",
    POVERTY: "Pobre",
    MIDDLE: "Media",
    ELITE: "Élite",
  };
  return map[key] ?? key;
}

export function LawCatalog({
  laws,
  proposedLaws,
  activeLaws,
  onPropose,
  senators,
  parties,
  approval,
}: {
  laws: LawCatalogEntry[];
  proposedLaws: string[];
  activeLaws: string[];
  onPropose: (lawKey: string) => void;
  senators: SenatorState[];
  parties: PartyState[];
  approval: number;
}) {
  const [search, setSearch] = useState("");
  const [modalLaw, setModalLaw] = useState<LawCatalogEntry | null>(null);

  const filtered = laws.filter((law) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      law.name.toLowerCase().includes(q) ||
      law.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar leyes por nombre o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((law) => {
          const isProposed = proposedLaws.includes(law.key);
          const isActive = activeLaws.includes(law.key);

          return (
            <Card key={law.key} size="sm" className="flex flex-col">
              <CardContent className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {law.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {law.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <IdeologyBar value={law.idealIdeology.economic} label="Econ" />
                  <IdeologyBar value={law.idealIdeology.social} label="Social" />
                  <IdeologyBar value={law.idealIdeology.authority} label="Autor" />
                </div>

                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const effects = law.effectsJson;
                    const badges: React.ReactNode[] = [];

                    for (const [key, val] of Object.entries(effects)) {
                      if (key === "approval" && typeof val === "object" && val !== null) {
                        for (const [cls, change] of Object.entries(val as Record<string, number>)) {
                          if (change === 0) continue;
                          const sign = change > 0 ? "+" : "";
                          badges.push(
                            <Badge
                              key={`${key}-${cls}`}
                              variant={change > 0 ? "default" : "destructive"}
                              className="text-[10px]"
                            >
                              {getClassLabel(cls)}: {sign}{change}
                            </Badge>
                          );
                        }
                      } else if (typeof val === "number" && val !== 0 && key !== "cost") {
                        const sign = val > 0 ? "+" : "";
                        badges.push(
                          <Badge
                            key={key}
                            variant={val > 0 ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {key}: {sign}{val}
                          </Badge>
                        );
                      }
                    }
                    return badges;
                  })()}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSignIcon className="size-3.5" />
                    {law.cost <= 0
                      ? "Sin costo"
                      : `M$ ${(law.cost / 1_000_000).toFixed(0)}`}
                  </span>
                  {isActive ? (
                    <Badge variant="default" className="gap-1 bg-accent/20 text-accent border-accent/30">
                      <CheckIcon className="size-3" />
                      Activa
                    </Badge>
                  ) : isProposed ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckIcon className="size-3" />
                      Propuesta
                    </Badge>
                  ) : (
                    <Button
                      size="xs"
                      onClick={() => setModalLaw(law)}
                      className="gap-1"
                    >
                      <PlusIcon className="size-3" />
                      Proponer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron leyes con ese criterio de búsqueda.
        </p>
      )}

      {modalLaw && (
        <LawProposalModal
          open={!!modalLaw}
          onClose={() => setModalLaw(null)}
          lawKey={modalLaw.key}
          lawName={modalLaw.name}
          lawDescription={modalLaw.description}
          senators={senators}
          parties={parties}
          approval={approval}
          onConfirm={() => {
            onPropose(modalLaw.key);
            setModalLaw(null);
          }}
        />
      )}
    </div>
  );
}
