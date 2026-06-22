"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/game-store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sparkles, AlertCircle, Brain } from "lucide-react";
import { consultAdvisor } from "@/app/actions/advisor";
import type { AdvisorReport } from "@/app/actions/advisor";

type PanelState = "idle" | "loading" | "ready" | "error";

interface AiAdvisorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  currentYear: number;
  currentMonth: number;
}

function isReportStale(
  report: AdvisorReport,
  currentYear: number,
  currentMonth: number,
): boolean {
  return (
    report.turnYear !== currentYear ||
    report.turnMonth !== currentMonth
  );
}

export function AiAdvisorPanel({
  open,
  onOpenChange,
  gameId,
  currentYear,
  currentMonth,
}: AiAdvisorPanelProps) {
  const pendingInput = useGameStore((s) => s.pendingInput);
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const showCached =
    panelState === "ready" &&
    report &&
    !report.error &&
    !isReportStale(report, currentYear, currentMonth);
  const effectiveState = showCached ? "ready" : panelState === "ready" ? "idle" : panelState;

  const handleConsult = async () => {
    setPanelState("loading");
    setErrorMsg("");
    try {
      const result = await consultAdvisor(gameId, pendingInput);
      if (result?.error) {
        setErrorMsg(result.error);
        setPanelState("error");
        return;
      }
      if (result) {
        setReport(result);
        setPanelState("ready");
      } else {
        setErrorMsg("El servicio de IA no está disponible. Configúralo en .env.local con AI_PROVIDER y la API key.");
        setPanelState("error");
      }
    } catch {
      setErrorMsg("Error de conexión. Revisa tu red e intenta de nuevo.");
      setPanelState("error");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onOpenChange(false);
      return;
    }
    // Al abrir, si hay reporte stale, volver a idle
    if (report && isReportStale(report, currentYear, currentMonth)) {
      setPanelState("idle");
    }
    onOpenChange(true);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Asesor de Gobierno
          </SheetTitle>
          <SheetDescription>
            Análisis estratégico de la situación del país
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <ScrollArea className="-mx-4 flex-1 px-4 mt-4 h-[calc(100vh-140px)]">
          {effectiveState === "idle" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Tu Jefe de Gabinete está listo para analizar la situación del país. Presiona el botón para recibir un informe completo.
              </p>
              <Button onClick={handleConsult} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Consultar asesor
              </Button>
            </div>
          )}

          {effectiveState === "loading" && (
            <div className="space-y-4 py-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <div className="pt-4">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
              <div className="pt-4">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          )}

          {effectiveState === "ready" && report && (
            <div className="py-4 space-y-4">
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                {report.markdown}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Análisis del Mes {report.turnMonth}, Año {report.turnYear}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConsult}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  Refrescar análisis
                </Button>
              </div>
            </div>
          )}

          {effectiveState === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive/50" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  No se pudo generar el análisis
                </p>
                {errorMsg && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {errorMsg}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConsult}
                className="gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                Reintentar
              </Button>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
