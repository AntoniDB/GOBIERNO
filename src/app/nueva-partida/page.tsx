"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Globe, Check } from "lucide-react";
import { createGame } from "@/app/actions/game";
import type { PresetKey, Difficulty } from "@/lib/game-factory";

const PRESETS: { key: PresetKey; title: string; description: string }[] = [
  {
    key: "estable_democratico",
    title: "Estable Democratico",
    description:
      "Democracia consolidada con instituciones solidas, baja corrupcion y economia estable. El desafio es mantener el equilibrio sin caer en la complacencia.",
  },
  {
    key: "pobre_con_potencial",
    title: "Pobre con Potencial",
    description:
      "Pais en desarrollo con grandes recursos naturales pero alta desigualdad. El desafio es sacar a la poblacion de la pobreza sin romper el tejido social.",
  },
  {
    key: "crisis_economica",
    title: "Crisis Economica",
    description:
      "Recesion profunda, inflacion galopante y desempleo masivo. El desafio es estabilizar la economia antes de que el malestar social desborde.",
  },
  {
    key: "post_conflicto",
    title: "Post-Conflicto",
    description:
      "Pais que emerge de un conflicto armado interno. Instituciones fragiles, corrupcion rampante y heridas abiertas. El desafio es reconstruir sin recaer en la violencia.",
  },
];

const DIFFICULTIES: { key: Difficulty; title: string; description: string }[] = [
  { key: "facil", title: "Facil", description: "Menos eventos negativos, corrupcion inicial baja, mas margen de error." },
  { key: "normal", title: "Normal", description: "Balance estandar de desafios y oportunidades." },
  { key: "dificil", title: "Dificil", description: "Eventos negativos frecuentes, corrupcion alta, poca tolerancia al error." },
];

export default function NuevaPartidaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [countryName, setCountryName] = useState("");
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed1 = countryName.trim().length >= 3;
  const canProceed2 = preset !== null;
  const canCreate = canProceed1 && canProceed2;

  async function handleCreate() {
    if (!canCreate || !preset) return;
    setIsCreating(true);
    setError(null);
    try {
      const gameId = await createGame({
        countryName: countryName.trim(),
        preset,
        difficulty,
      });
      router.push(`/dashboard?id=${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la partida");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Nueva Partida</CardTitle>
          <CardDescription>
            Configura tu pais y comienza a gobernar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paso 1: Nombre del pais */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="countryName">Nombre del pais</Label>
                <div className="flex gap-2">
                  <Globe className="size-5 text-muted-foreground mt-2 shrink-0" />
                  <Input
                    id="countryName"
                    placeholder="Ej: Republica de Aurora"
                    value={countryName}
                    onChange={(e) => setCountryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canProceed1 && setStep(2)}
                    maxLength={40}
                    autoFocus
                  />
                </div>
                {countryName.length > 0 && countryName.length < 3 && (
                  <p className="text-xs text-destructive">Minimo 3 caracteres</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canProceed1}>
                  Siguiente <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Paso 2: Preset */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Elige el escenario inicial de tu pais:</p>
              <div className="space-y-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPreset(p.key)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      preset === p.key
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{p.title}</span>
                      {preset === p.key && <Check className="size-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="size-4 mr-1" /> Atras
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceed2}>
                  Siguiente <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: Dificultad + Confirmar */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Elige la dificultad:</p>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      difficulty === d.key
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{d.title}</span>
                      {difficulty === d.key && <Check className="size-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                  </button>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {error}
                </div>
              )}

              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Resumen</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Pais:</strong> {countryName}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Escenario:</strong> {PRESETS.find((p) => p.key === preset)?.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Dificultad:</strong> {DIFFICULTIES.find((d) => d.key === difficulty)?.title}
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="size-4 mr-1" /> Atras
                </Button>
                <Button onClick={handleCreate} disabled={!canCreate || isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1" />
                      Creando...
                    </>
                  ) : (
                    <>
                      Iniciar Gobierno <ArrowRight className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="flex gap-2 justify-center pt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
