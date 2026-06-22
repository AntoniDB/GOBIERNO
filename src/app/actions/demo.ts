"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { GameState } from "@/lib/engine/types";

/**
 * Obtiene el ID del juego activo del usuario autenticado.
 * Si no tiene juegos, retorna null. Si tiene varios, retorna el mas reciente.
 */
export async function getUserActiveGameId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const game = await prisma.game.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return game?.id ?? null;
}

/**
 * Obtiene todos los juegos del usuario autenticado (activos primero).
 */
export async function getUserGames(): Promise<{ id: string; countryName: string; status: string; currentYear: number; currentMonth: number }[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesion no encontrada");

  const games = await prisma.game.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, countryName: true, status: true, currentYear: true, currentMonth: true },
  });

  return games;
}

// Legacy export para compatibilidad temporal durante la transicion
export { getUserActiveGameId as getDemoGameId };
