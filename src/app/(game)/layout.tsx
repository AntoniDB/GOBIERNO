import { GameShell } from "@/components/game/game-shell";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GameShell>{children}</GameShell>;
}
