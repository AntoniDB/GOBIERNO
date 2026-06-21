"use client";

import { useParams } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { MinistryView } from "@/components/game/ministry-view";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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

export default function MinistryDetailPage() {
  const params = useParams();
  const key = params.key as string;
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="w-80 space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const ministry = gameState.ministries.find((m) => m.key === key);

  if (!ministry) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-muted-foreground">Ministerio no encontrado</p>
      </div>
    );
  }

  const ministryName = MINISTRY_NAMES[key] ?? key;

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/ministerios">Ministerios</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ministryName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <MinistryView ministry={ministry} />
    </div>
  );
}
