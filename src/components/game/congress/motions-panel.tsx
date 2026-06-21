"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollTextIcon, AlertTriangleIcon, GavelIcon } from "lucide-react";
import { useGameStore } from "@/lib/store/game-store";

export function MotionsPanel() {
  const notifications = useGameStore((s) => s.notifications);
  const lastTurnResult = useGameStore((s) => s.lastTurnResult);

  const motionNotifications = notifications.filter(
    (n) => n.type === "case" || n.type === "warning",
  );

  const allNotifications = [...motionNotifications];
  if (lastTurnResult) {
    for (const n of lastTurnResult.notifications) {
      if (
        !allNotifications.find((an) => an.title === n.title && an.description === n.description)
      ) {
        allNotifications.push(n);
      }
    }
  }

  const recentMotions = allNotifications.slice(-10).reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
        <GavelIcon className="size-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="text-foreground font-medium">Mociones del Congreso</p>
          <p className="text-muted-foreground">
            Las mociones de censura y juicios políticos son evaluadas
            automáticamente al avanzar el mes. Los resultados dependen de la
            composición del Congreso y la afinidad ideológica.
          </p>
        </div>
      </div>

      {recentMotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <ScrollTextIcon className="size-12 opacity-30" />
          <p>No hay mociones activas en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {recentMotions.map((notif, idx) => (
            <Card key={idx} size="sm">
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={notif.type === "warning" ? "destructive" : "secondary"}
                    className="gap-1 text-[10px]"
                  >
                    {notif.type === "warning" ? (
                      <AlertTriangleIcon className="size-3" />
                    ) : (
                      <GavelIcon className="size-3" />
                    )}
                    {notif.type === "warning" ? "Censura" : "Juicio Político"}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {notif.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    Pendiente
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {notif.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
