"use client";

import type { MinistryState, OfficialState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { BudgetSlider } from "@/components/game/budget-slider";
import { SubDecisions } from "@/components/game/sub-decisions";
import { MinisterCard } from "@/components/game/minister-card";
import { EfficiencyChart } from "@/components/game/efficiency-chart";
import { Badge } from "@/components/ui/badge";
import {
  HeartPulse,
  GraduationCap,
  DollarSign,
  Shield,
  Lock,
  Scale,
  Wheat,
  Users,
} from "lucide-react";

const MINISTRY_NAMES: Record<string, string> = {
  HEALTH: "Salud",
  EDUCATION: "Educación",
  ECONOMY: "Economía",
  DEFENSE: "Defensa",
  SECURITY: "Seguridad",
  JUSTICE: "Justicia",
  AGRICULTURE: "Agricultura",
  SOCIAL_DEVELOPMENT: "Desarrollo Social",
};

const MINISTRY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  HEALTH: HeartPulse,
  EDUCATION: GraduationCap,
  ECONOMY: DollarSign,
  DEFENSE: Shield,
  SECURITY: Lock,
  JUSTICE: Scale,
  AGRICULTURE: Wheat,
  SOCIAL_DEVELOPMENT: Users,
};

const MINISTRY_COLORS: Record<string, string> = {
  HEALTH: "text-red-400",
  EDUCATION: "text-blue-400",
  ECONOMY: "text-emerald-400",
  DEFENSE: "text-slate-400",
  SECURITY: "text-amber-400",
  JUSTICE: "text-purple-400",
  AGRICULTURE: "text-lime-400",
  SOCIAL_DEVELOPMENT: "text-pink-400",
};

const MINISTRY_DESCRIPTIONS: Record<string, string> = {
  HEALTH:
    "Gestiona hospitales públicos, campañas de vacunación y políticas de salud mental para mantener baja la tasa de enfermedad en la población.",
  EDUCATION:
    "Administra la inversión en educación primaria, secundaria y superior, define el enfoque curricular y otorga becas estudiantiles.",
  ECONOMY:
    "Controla la tasa de interés referencial, el salario mínimo y la política industrial para regular la economía nacional.",
  DEFENSE:
    "Maneja las tropas activas, el gasto en equipamiento militar y las políticas de servicio militar obligatorio para la defensa del país.",
  SECURITY:
    "Coordina el patrullaje urbano y rural, las políticas antidrogas y la inversión en el sistema carcelario para combatir el crimen.",
  JUSTICE:
    "Supervisa jueces y fiscales, prioriza la lucha contra la corrupción y define la dureza del sistema penal.",
  AGRICULTURE:
    "Gestiona subsidios al productor y la inversión en infraestructura rural para garantizar la seguridad alimentaria nacional.",
  SOCIAL_DEVELOPMENT:
    "Define la focalización de programas sociales y prioriza la atención a niñez, adultos mayores y mujeres en situación de vulnerabilidad.",
};

function getEfficiencyColor(value: number) {
  if (value >= 70) return "bg-accent border-accent";
  if (value >= 40) return "bg-chart-5 border-chart-5";
  return "bg-destructive border-destructive";
}

export function MinistryView({ ministry }: { ministry: MinistryState }) {
  const gameState = useGameStore((s) => s.gameState);
  const pendingInput = useGameStore((s) => s.pendingInput);
  const updateBudget = useGameStore((s) => s.updateBudget);
  const updateSubDecision = useGameStore((s) => s.updateSubDecision);

  const name = MINISTRY_NAMES[ministry.key] ?? ministry.key;
  const Icon = MINISTRY_ICONS[ministry.key] ?? Shield;
  const iconColor = MINISTRY_COLORS[ministry.key] ?? "text-muted-foreground";
  const description = MINISTRY_DESCRIPTIONS[ministry.key] ?? "Ministerio del gobierno.";
  const effBadgeColor = getEfficiencyColor(ministry.efficiency);

  const minister: OfficialState | null | undefined = ministry.ministerOfficialId
    ? gameState?.officials.find((o) => o.id === ministry.ministerOfficialId)
    : null;

  const hasPendingBudget =
    pendingInput.budgetAdjustments?.[ministry.key] !== undefined;
  const hasPendingSubDecisions =
    pendingInput.subDecisionChanges?.[ministry.key] !== undefined;
  const hasPendingChanges = hasPendingBudget || hasPendingSubDecisions;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
          <Icon className={`size-7 ${iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <Badge className={`text-xs ${effBadgeColor} bg-transparent border`}>
              Eficiencia: {ministry.efficiency.toFixed(0)}%
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
          {hasPendingChanges && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Cambios pendientes — Avanzar mes para aplicar
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <BudgetSlider
            ministryKey={ministry.key}
            currentBudget={ministry.budgetPercent}
            onBudgetChange={updateBudget}
          />
          <SubDecisions
            ministryKey={ministry.key}
            subDecisions={ministry.subDecisions}
            onSubDecisionChange={updateSubDecision}
          />
        </div>

        <div className="w-80 space-y-6 shrink-0">
          <MinisterCard minister={minister} />
          <EfficiencyChart ministryKey={ministry.key} />
        </div>
      </div>
    </div>
  );
}
