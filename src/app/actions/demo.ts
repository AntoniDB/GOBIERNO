"use server";

import { prisma } from "@/lib/prisma";

export async function getDemoGameId(): Promise<string | null> {
  const game = await prisma.game.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  return game?.id ?? null;
}
