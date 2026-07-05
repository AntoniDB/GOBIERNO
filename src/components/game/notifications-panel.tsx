"use client";

import type { TurnNotification } from "@/lib/engine/types";
import { useGameStore } from "@/lib/store/game-store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  AlertTriangle,
  Info,
  Scroll,
  Scale,
  AlertCircle,
} from "lucide-react";

const ICON_MAP: Record<TurnNotification["type"], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  event: Bell,
  warning: AlertTriangle,
  info: Info,
  law: Scroll,
  case: Scale,
  crisis: AlertCircle,
};

function renderNotifIcon(type: TurnNotification["type"], className?: string) {
  const IconComponent = ICON_MAP[type] ?? Info;
  return <IconComponent className={className} />;
}

function getIconColor(type: TurnNotification["type"]) {
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

interface NotificationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsPanel({ open, onOpenChange }: NotificationsPanelProps) {
  const gameState = useGameStore((s) => s.gameState);
  const notifications = useGameStore((s) => s.notifications);
  const sorted = [...notifications].reverse();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[400px] flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Resultado del Mes {gameState?.currentMonth ?? "?"}
          </SheetTitle>
          <SheetDescription>
            Resumen de lo ocurrido durante el último turno.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <ScrollArea className="-mx-4 flex-1 overflow-y-auto px-4">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones pendientes.
            </p>
          ) : (
            <div className="space-y-3 pr-2">
              {sorted.map((notif, i) => {
                const colorClass = getIconColor(notif.type);
                return (
                  <div key={i} className="flex gap-3 rounded-lg border border-border/50 p-3">
                    {renderNotifIcon(notif.type, `mt-0.5 size-4 shrink-0 ${colorClass}`)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.description}</p>
                      {notif.severity != null && (
                        <span className="mt-1 inline-block rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                          Severidad {notif.severity}/100
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
