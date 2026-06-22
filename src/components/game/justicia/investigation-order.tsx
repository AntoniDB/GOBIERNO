"use client";

import type { OfficialState } from "@/lib/engine/types";
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
import { ShieldAlertIcon, AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  MINISTER: "Ministro",
  JUDGE: "Juez",
  PROSECUTOR: "Fiscal",
  GENERAL: "General",
  CHIEF_OF_INTELLIGENCE: "Jefe de Inteligencia",
  COMPTROLLER: "Contralor",
  OMBUDSMAN: "Defensor del Pueblo",
  CENTRAL_BANK_PRESIDENT: "Presidente del Banco Central",
  POLITICAL_LEADER: "Lider politico",
};

export function InvestigationOrder({
  open,
  onClose,
  official,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  official: OfficialState | null;
  onConfirm: (officialId: string) => void;
}) {
  const regimeMetrics = useGameStore((s) => s.gameState?.regimeMetrics);

  if (!official) return null;

  const judicialIndependence = regimeMetrics?.judicialIndependence ?? 60;
  const isPoliticalRisk = judicialIndependence < 40;

  const handleConfirm = () => {
    toast.info(`Investigacion ordenada contra ${official.name}. Se abrira un caso al avanzar el mes.`);
    onConfirm(official.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlertIcon className="size-5 text-amber-500" />
            Ordenar investigación
          </DialogTitle>
          <DialogDescription>
            Al ordenar una investigación, se abrirá un caso judicial contra este
            funcionario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Funcionario:</span>
              <span className="font-medium">{official.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rol:</span>
              <Badge variant="outline" className="text-[10px]">
                {ROLE_LABEL[official.role] ?? official.role}
              </Badge>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Nivel de corrupción
              </span>
              <div className="flex items-center gap-2">
                <Progress value={Math.min(official.corruption, 100)} className="flex-1" />
                <span className="text-xs tabular-nums shrink-0">
                  {Math.round(official.corruption)}%
                </span>
              </div>
            </div>
          </div>

          {isPoliticalRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
              <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
              <p>
                La independencia judicial es baja ({judicialIndependence}/100).
                Las investigaciones pueden percibirse como persecución política
                y dañar la credibilidad del sistema.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
