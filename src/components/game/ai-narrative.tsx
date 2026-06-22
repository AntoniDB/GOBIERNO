"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertCircle } from "lucide-react";
import { checkAiAvailability } from "@/app/actions/ai";

let cachedAvailability: boolean | null = null;
let pendingCheck: Promise<void> | null = null;

async function ensureAvailabilityKnown(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;
  if (!pendingCheck) {
    pendingCheck = checkAiAvailability().then((v) => {
      cachedAvailability = v;
      pendingCheck = null;
    });
  }
  await pendingCheck;
  return cachedAvailability ?? false;
}

function checkAiAvailableSync(): boolean {
  // Llamada síncrona — si el cache ya está resuelto, devuelve inmediatamente.
  // Si no, el primer render retorna false y un useEffect lo actualiza.
  return cachedAvailability ?? false;
}

interface AiNarrativeProps {
  gameId: string;
  entityId: string;
  fallbackText: string;
  fetchAction: (
    gameId: string,
    entityId: string,
  ) => Promise<{ narrative: string } | null>;
  buttonLabel?: string;
}

export default function AiNarrative({
  gameId,
  entityId,
  fallbackText,
  fetchAction,
  buttonLabel = "Expandir con IA",
}: AiNarrativeProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    ensureAvailabilityKnown().then(setAvailable);
  }, []);

  if (available === false) return null;
  if (available === null) return null; // loading — no mostrar nada aún

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const result = await fetchAction(gameId, entityId);
      if (result?.narrative) {
        setNarrative(result.narrative);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (narrative) {
    return (
      <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 p-3">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
          {narrative}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="size-3" />
        No se pudo generar la narrativa.
      </div>
    );
  }

  return (
    <div className="mt-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleGenerate}
      >
        <Sparkles className="size-3" />
        {buttonLabel}
      </Button>
    </div>
  );
}
