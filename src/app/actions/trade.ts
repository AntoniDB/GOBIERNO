// ─── Acciones de comercio exterior (Salud-3B-i) ──────────────────────────────
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getTransactionOptions } from "@/lib/db-config";
import { revalidatePath } from "next/cache";

/**
 * Actualiza las sub-decisiones de TradeFlow del jugador.
 * El jugador controla el mix de importaciones (ej: % genéricos vs marca)
 * modificando targetVolume de cada TradeFlow IMPORT activo.
 *
 * decisions: { tradeFlowId: { targetVolume: number } }
 */
export async function updateTradeFlowDecisions(
  gameId: string,
  decisions: Record<string, { targetVolume: number }>,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { userId: true },
  });
  if (!game || game.userId !== session.user.id) {
    throw new Error("No tienes acceso a esta partida.");
  }

  await prisma.$transaction(async (tx) => {
    for (const [tradeFlowId, cfg] of Object.entries(decisions)) {
      await tx.tradeFlow.update({
        where: { id: tradeFlowId },
        data: {
          targetVolume: Math.max(0, cfg.targetVolume),
        },
      });
    }
  }, getTransactionOptions());

  revalidatePath(`/ministerios/HEALTH`);
}
