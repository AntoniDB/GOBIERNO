"use client";

import type { TurnNotification, EventState } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import AiNarrative from "./ai-narrative";
import { generateEventNarrative } from "@/app/actions/ai";
import {
  Biohazard,
  AlertTriangle,
  Users,
  ShieldOff,
  Swords,
  CloudRain,
  TrendingDown,
  Bell,
  Info,
  Scroll,
  Scale,
  AlertCircle,
  History,
} from "lucide-react";

const EVENT_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  EPIDEMIC: Biohazard,
  SCANDAL: AlertTriangle,
  PROTEST: Users,
  CRIME_SURGE: ShieldOff,
  COUP_ATTEMPT: Swords,
  DISASTER: CloudRain,
  ECONOMIC_CRISIS: TrendingDown,
};

const NOTIFICATION_ICONS: Record<TurnNotification["type"], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  event: Bell,
  warning: AlertTriangle,
  info: Info,
  law: Scroll,
  case: Scale,
  crisis: AlertCircle,
};

function getEventColor(type: string) {
  switch (type) {
    case "EPIDEMIC":
    case "DISASTER":
      return "destructive";
    case "SCANDAL":
    case "CRIME_SURGE":
      return "secondary";
    case "PROTEST":
      return "outline";
    case "COUP_ATTEMPT":
    case "ECONOMIC_CRISIS":
      return "destructive";
    default:
      return "ghost";
  }
}

function renderNotifIcon(type: TurnNotification["type"], className?: string) {
  const IconComponent = NOTIFICATION_ICONS[type] ?? Bell;
  return <IconComponent className={className} />;
}

function getNotifColor(type: TurnNotification["type"]) {
  switch (type) {
    case "crisis":
    case "warning":
      return "text-destructive";
    case "event":
      return "text-chart-5";
    case "law":
      return "text-accent";
    case "case":
      return "text-secondary";
    default:
      return "text-muted-foreground";
  }
}

function renderEventBadgeIcon(type: string) {
  const IconComponent = EVENT_ICONS[type] ?? History;
  return <IconComponent className="size-3" />;
}

function EventRow({ event, gameId }: { event: EventState; gameId: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
      <Badge variant={getEventColor(event.type) as "destructive" | "secondary" | "outline"} className="mt-0.5 shrink-0">
        {renderEventBadgeIcon(event.type)}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{event.description}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Año {event.year}, Mes {event.month}
          </span>
          {event.severity > 0 && (
            <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              Severidad {event.severity}/10
            </span>
          )}
        </div>
        <AiNarrative
          gameId={gameId}
          entityId={event.id}
          fallbackText={event.description}
          fetchAction={generateEventNarrative}
          buttonLabel="Expandir crónica"
        />
      </div>
    </div>
  );
}

function NotificationRow({ notification }: { notification: TurnNotification }) {
  const colorClass = getNotifColor(notification.type);
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2">
      {renderNotifIcon(notification.type, `mt-0.5 size-3.5 shrink-0 ${colorClass}`)}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground">{notification.description}</p>
        {notification.severity != null && (
          <span className="mt-0.5 inline-block rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
            Severidad {notification.severity}/10
          </span>
        )}
      </div>
    </div>
  );
}

export function EventFeed() {
  const gameState = useGameStore((s) => s.gameState);
  const gameId = useGameStore((s) => s.gameId);
  const notifications = useGameStore((s) => s.notifications);

  if (!gameState) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const events = [...gameState.events].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sucesos recientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notificaciones del turno
            </h4>
            {notifications.map((n, i) => (
              <NotificationRow key={i} notification={n} />
            ))}
            <Separator />
          </div>
        )}
        <ScrollArea className="max-h-80">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay sucesos registrados aún.
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <EventRow key={event.id} event={event} gameId={gameId ?? ""} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
