"use client";

import { useState, useMemo } from "react";
import type { OfficialState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { BALANCE } from "@/lib/balance";
import { costScaleFactor } from "@/lib/engine/cost-scale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2Icon, InfoIcon } from "lucide-react";

const ORGANISM_TYPES = [
  { key: "COMPTROLLER", label: "Contraloría General" },
  { key: "ANTICORRUPTION_PROSECUTION", label: "Fiscalía Anticorrupción" },
  { key: "INTELLIGENCE", label: "Servicio de Inteligencia" },
] as const;

const ORGANISM_ROLE_MAP: Record<string, string> = {
  COMPTROLLER: "COMPTROLLER",
  ANTICORRUPTION_PROSECUTION: "PROSECUTOR",
  INTELLIGENCE: "CHIEF_OF_INTELLIGENCE",
};

const FALLBACK_ROLES = ["MINISTER", "JUDGE", "PROSECUTOR", "GENERAL"];

const ROLE_LABEL: Record<string, string> = {
  COMPTROLLER: "Contralor",
  PROSECUTOR: "Fiscal",
  CHIEF_OF_INTELLIGENCE: "Jefe de Inteligencia",
  MINISTER: "Ministro",
  JUDGE: "Juez",
  GENERAL: "General",
};

function formatBudget(amount: number): string {
  return `M$ ${(amount / 1_000_000).toFixed(0)}`;
}

export function CreateOrganism({
  open,
  onClose,
  officials,
}: {
  open: boolean;
  onClose: () => void;
  officials: OfficialState[];
}) {
  const [type, setType] = useState<string>("COMPTROLLER");
  const [name, setName] = useState("");
  // El rango del presupuesto (M$ 50-500 para un país de 50M) escala con la población
  const population = useGameStore((s) => s.gameState?.population) ?? BALANCE.LAW_COST_REFERENCE_POPULATION;
  const budgetFactor = costScaleFactor(population, BALANCE.LAW_COST_REFERENCE_POPULATION);
  const budgetMin = Math.max(1, Math.round(50 * budgetFactor));
  const budgetMax = Math.max(budgetMin + 1, Math.round(500 * budgetFactor));
  const budgetStep = Math.max(1, Math.round(10 * budgetFactor));
  const [chosenBudget, setChosenBudget] = useState<number | null>(null);
  const monthlyBudget = chosenBudget ?? budgetMin;
  const [staff, setStaff] = useState(10);
  const [headOfficialId, setHeadOfficialId] = useState<string>("");
  const [autonomyLevel, setAutonomyLevel] = useState(70);

  const eligibleOfficials = useMemo(() => {
    const requiredRole = ORGANISM_ROLE_MAP[type];
    // Primero buscar oficiales con el rol exacto requerido
    const exactMatch = officials.filter(
      (o) => o.role === requiredRole && o.status === "ACTIVE"
    );
    if (exactMatch.length > 0) return exactMatch;

    // Si no hay rol exacto, permitir cualquiera de los roles alternativos
    return officials.filter(
      (o) => FALLBACK_ROLES.includes(o.role) && o.status === "ACTIVE"
    );
  }, [officials, type]);

  const hasExactRole = useMemo(() => {
    const requiredRole = ORGANISM_ROLE_MAP[type];
    return officials.some((o) => o.role === requiredRole && o.status === "ACTIVE");
  }, [officials, type]);

  const handleCreate = () => {
    // La clave debe coincidir con el enum OrganismType (MAYÚSCULAS)
    const key = type;

    useGameStore.setState({
      pendingInput: {
        ...useGameStore.getState().pendingInput,
        newOrganisms: {
          ...useGameStore.getState().pendingInput.newOrganisms,
          [key]: {
            name: name || (ORGANISM_TYPES.find((t) => t.key === type)?.label ?? type),
            monthlyBudget: monthlyBudget * 1_000_000,
            headOfficialId: headOfficialId || undefined,
          },
        },
      },
    });

    setName("");
    setChosenBudget(null);
    setStaff(10);
    setHeadOfficialId("");
    setAutonomyLevel(70);
    onClose();
  };

  const handleBudgetChange = (value: number | readonly number[]) => {
    setChosenBudget(Array.isArray(value) ? value[0] : value);
  };

  const handleAutonomyChange = (value: number | readonly number[]) => {
    setAutonomyLevel(Array.isArray(value) ? value[0] : value);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2Icon className="size-5 text-primary" />
            Crear organismo
          </DialogTitle>
          <DialogDescription>
            El organismo se creará al avanzar el mes y tendrá costo mensual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de organismo</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANISM_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nombre</Label>
            <Input
              id="org-name"
              placeholder={ORGANISM_TYPES.find((t) => t.key === type)?.label ?? "Nombre del organismo"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-titular">Titular {eligibleOfficials.length > 0 ? "" : "(opcional)"}</Label>
            {eligibleOfficials.length > 0 ? (
              <Select
                value={headOfficialId}
                onValueChange={(v) => v && setHeadOfficialId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={hasExactRole ? "Seleccionar titular..." : "Seleccionar titular (roles alternativos)..."} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOfficials.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({ROLE_LABEL[o.role] ?? o.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground p-2 rounded-md border border-border bg-muted/30">
                No hay funcionarios activos disponibles. El organismo se puede crear sin titular y designar uno despues.
              </p>
            )}
            {!hasExactRole && eligibleOfficials.length > 0 && (
              <p className="text-xs text-muted-foreground">
                No hay funcionarios con el rol exacto. Se muestran roles alternativos disponibles.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Presupuesto mensual</Label>
              <span className="text-sm font-medium tabular-nums">
                {formatBudget(monthlyBudget * 1_000_000)}
              </span>
            </div>
            <Slider
              value={[monthlyBudget]}
              onValueChange={handleBudgetChange}
              min={budgetMin}
              max={budgetMax}
              step={budgetStep}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>M$ {budgetMin}</span>
              <span>M$ {budgetMax}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-staff">Personal</Label>
            <Input
              id="org-staff"
              type="number"
              min={5}
              max={50}
              value={staff}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setStaff(Math.max(5, Math.min(50, v)));
              }}
            />
            <p className="text-[10px] text-muted-foreground">Entre 5 y 50 funcionarios</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Nivel de autonomía</Label>
              <span className="text-sm font-medium tabular-nums">
                {autonomyLevel}%
              </span>
            </div>
            <Slider
              value={[autonomyLevel]}
              onValueChange={handleAutonomyChange}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            <InfoIcon className="size-4 shrink-0 mt-0.5 text-primary" />
            <p>
              El organismo se creará al avanzar el mes y comenzará a operar con
              el presupuesto y personal asignados. Su efectividad dependerá de la
              autonomía y los recursos disponibles.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
