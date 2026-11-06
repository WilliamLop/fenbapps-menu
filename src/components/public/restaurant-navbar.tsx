import Link from "next/link";
import {
  Flame,
  UtensilsCrossed,
  Sparkles,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import type { EnabledModulesConfig } from "@/modules/tenant/queries";

interface RestaurantNavbarProps {
  slug: string;
  name: string;
  cuisineType: string | null;
  isDemo: boolean;
  enabledModules: EnabledModulesConfig;
  activeTab: "site" | "menu" | "events";
}

export function RestaurantNavbar({
  slug,
  name,
  cuisineType,
  isDemo,
  enabledModules,
  activeTab,
}: RestaurantNavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur-md">
      {isDemo && (
        <div className="bg-obsidian text-ivory border-b border-obsidian-border px-4 py-2 text-xs">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/25 px-2.5 py-0.5 font-medium text-ember-glow border border-ember/40">
                <Sparkles className="size-3" />
                Demo Comercial Interactiva
              </span>
              <span className="hidden text-ivory-muted sm:inline">
                Marca gastronómica ficticia para demostración de arquitectura Multi-Tenant.
              </span>
            </div>
            <Link
              href={`/dashboard/${slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-ivory/10 px-2.5 py-1 font-medium text-ivory transition hover:bg-ivory/20"
            >
              <LayoutDashboard className="size-3.5 text-gold" />
              Abrir Dashboard Administrativo
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link
          href={`/${slug}`}
          className="group flex items-center gap-3 focus:outline-none"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-obsidian text-gold border border-obsidian-border transition group-hover:border-ember">
            <Flame className="size-5 text-ember-glow" />
          </div>
          <div>
            <span className="block font-display text-2xl font-semibold tracking-tight text-ink leading-none">
              {name}
            </span>
            {cuisineType && (
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                {cuisineType}
              </span>
            )}
          </div>
        </Link>

        <nav
          aria-label="Navegación principal del restaurante"
          className="flex items-center gap-1 sm:gap-2"
        >
          {enabledModules.site && (
            <Link
              href={`/${slug}`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                activeTab === "site"
                  ? "bg-obsidian text-ivory shadow-sm"
                  : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
              }`}
            >
              <MapPin className="size-4 hidden sm:inline" />
              <span>El Restaurante</span>
            </Link>
          )}

          {enabledModules.menu && (
            <Link
              href={`/${slug}/menu`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                activeTab === "menu"
                  ? "bg-ember text-ivory shadow-sm"
                  : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
              }`}
            >
              <UtensilsCrossed className="size-4" />
              <span>Carta Digital</span>
            </Link>
          )}

          {enabledModules.events && (
            <Link
              href={`/${slug}/eventos`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                activeTab === "events"
                  ? "bg-obsidian text-ivory shadow-sm"
                  : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
              }`}
            >
              <Sparkles className="size-4 text-ember" />
              <span>Eventos & Salones</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
