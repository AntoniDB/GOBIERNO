"use client";

import { useGameStore } from "@/lib/store/game-store";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Landmark,
  Scale,
  Users,
  Radio,
  Shield,
  BarChart3,
  LogOut,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Ministerios", icon: Building2, href: "/ministerios" },
  { label: "Congreso", icon: Landmark, href: "/congreso" },
  { label: "Justicia", icon: Scale, href: "/justicia" },
  { label: "Población", icon: Users, href: "/poblacion" },
  { label: "Medios", icon: Radio, href: "/medios" },
  { label: "Régimen", icon: Shield, href: "/regimen" },
  { label: "Reportes", icon: BarChart3, href: "/reportes" },
];

export default function Sidebar() {
  const gameState = useGameStore((s) => s.gameState);
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen flex flex-col bg-card border-r border-border shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-heading font-bold text-primary truncate">
          {gameState?.countryName ?? "Simulador"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Panel de Control</p>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = item.href && pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground opacity-40 cursor-not-allowed border-l-2 border-transparent"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary/20 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground">
          Sesión 7 — Cierre
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="size-3" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
