"use client";

import { useState } from "react";
import type { OrganismState, OfficialState } from "@/lib/engine/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateOrganism } from "./create-organism";
import {
  Building2Icon,
  UserIcon,
  DollarSignIcon,
  UsersIcon,
  PlusIcon,
  ShieldIcon,
} from "lucide-react";

const ORGANISM_TYPE_LABEL: Record<string, string> = {
  COMPTROLLER: "Contraloría General",
  ANTICORRUPTION_PROSECUTION: "Fiscalía Anticorrupción",
  INTELLIGENCE: "Servicio de Inteligencia",
  OMBUDSMAN: "Defensoría del Pueblo",
  ELECTORAL_COURT: "Tribunal Electoral",
};

function findOfficial(id: string | null, officials: OfficialState[]): OfficialState | undefined {
  if (!id) return undefined;
  return officials.find((o) => o.id === id);
}

function formatBudget(amount: number): string {
  return `M$ ${(amount / 1_000_000).toFixed(1)}`;
}

export function OrganismList({
  organisms,
  officials,
}: {
  organisms: OrganismState[];
  officials: OfficialState[];
}) {
  const [showCreate, setShowCreate] = useState(false);

  if (organisms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
        <Building2Icon className="size-12 opacity-30" />
        <p>No hay organismos creados. Puedes crearlos desde el apartado de gobierno.</p>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4" />
          Crear organismo
        </Button>
        <CreateOrganism
          open={showCreate}
          onClose={() => setShowCreate(false)}
          officials={officials}

        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4" />
          Crear organismo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organisms.map((org) => {
          const titular = findOfficial(org.headOfficialId, officials);
          const isDissolved = org.effectiveness <= 0;

          return (
            <Card
              key={org.id}
              size="sm"
              className={isDissolved ? "opacity-50" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-1">
                      {ORGANISM_TYPE_LABEL[org.type] ?? org.type}
                    </Badge>
                    <CardTitle className="text-sm">{org.name}</CardTitle>
                  </div>
                  {isDissolved && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      Disuelto
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <UserIcon className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Titular:</span>
                  <span className="font-medium truncate">
                    {titular?.name ?? "Vacante"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <DollarSignIcon className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Presupuesto mensual:</span>
                  <span className="font-medium">{formatBudget(org.monthlyBudget)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <UsersIcon className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Staff:</span>
                    <span className="font-medium">{org.staff}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Efectividad</span>
                    <Progress value={Math.min(org.effectiveness, 100)} className="flex-1" />
                    <span className="text-xs tabular-nums w-10 shrink-0 text-right">
                      {Math.round(org.effectiveness)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Autonomía</span>
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          org.autonomyLevel > 70 ? "bg-green-500" : org.autonomyLevel >= 40 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(org.autonomyLevel, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-10 shrink-0 text-right">
                      {Math.round(org.autonomyLevel)}%
                    </span>
                  </div>
                </div>
              </CardContent>
              {!isDissolved && (
                <CardFooter>
                  <Button variant="outline" size="xs" className="w-full">
                    <ShieldIcon className="size-3" />
                    Disolver
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>

      <CreateOrganism
        open={showCreate}
        onClose={() => setShowCreate(false)}
        officials={officials}
      />
    </div>
  );
}
