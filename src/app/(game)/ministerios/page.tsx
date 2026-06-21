"use client";

import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
import Link from "next/link";
import type { MinistryState } from "@/lib/engine/types";

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

const MINISTRY_BG_COLORS: Record<string, string> = {
  HEALTH: "bg-red-400",
  EDUCATION: "bg-blue-400",
  ECONOMY: "bg-emerald-400",
  DEFENSE: "bg-slate-400",
  SECURITY: "bg-amber-400",
  JUSTICE: "bg-purple-400",
  AGRICULTURE: "bg-lime-400",
  SOCIAL_DEVELOPMENT: "bg-pink-400",
};

function getEfficiencyColor(value: number) {
  if (value >= 70) return "bg-accent";
  if (value >= 40) return "bg-chart-5";
  return "bg-destructive";
}

function MiniProgress({ value, colorClass }: { value: number; colorClass: string }) {
  const percent = Math.min(Math.max(value, 0), 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function MinistryCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MinisteriosPage() {
  const gameState = useGameStore((s) => s.gameState);

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Ministerios</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-bold text-foreground">Ministerios del Gobierno</h1>

      {!gameState ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MinistryCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {gameState.ministries.map((ministry) => (
            <MinistryCard
              key={ministry.id}
              ministry={ministry}
              officials={gameState.officials}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MinistryCard({
  ministry,
  officials,
}: {
  ministry: MinistryState;
  officials: { id: string; name: string }[];
}) {
  const name = MINISTRY_NAMES[ministry.key] ?? ministry.key;
  const Icon = MINISTRY_ICONS[ministry.key] ?? Shield;
  const iconColor = MINISTRY_COLORS[ministry.key] ?? "text-muted-foreground";
  const bgColor = MINISTRY_BG_COLORS[ministry.key] ?? "bg-muted-foreground";
  const effColor = getEfficiencyColor(ministry.efficiency);
  const minister = officials.find((o) => o.id === ministry.ministerOfficialId);

  return (
    <Link href={`/ministerios/${ministry.key}`}>
      <Card size="sm" className="cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 hover:bg-card/80">
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon className={`size-8 ${iconColor}`} />
            <span className="font-heading text-base font-medium text-foreground">
              {name}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Eficiencia</span>
              <span className="tabular-nums text-foreground">{ministry.efficiency.toFixed(0)}%</span>
            </div>
            <MiniProgress value={ministry.efficiency} colorClass={effColor} />
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <span className={`mr-1 inline-block size-2 rounded-full ${bgColor}`} />
              {ministry.budgetPercent.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {minister ? minister.name : "Sin ministro"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
