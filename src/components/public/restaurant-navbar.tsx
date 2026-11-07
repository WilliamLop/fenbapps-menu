import Link from "next/link";
import {
  UtensilsCrossed,
  Sparkles,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import { BrandIcon } from "@/components/public/brand-icon";
import type {
  EnabledModulesConfig,
  TenantBrandIcon,
} from "@/modules/tenant/queries";

interface RestaurantNavbarProps {
  slug: string;
  name: string;
  cuisineType: string | null;
  brandIcon?: TenantBrandIcon;
  isDemo: boolean;
  enabledModules: EnabledModulesConfig;
  activeTab: "site" | "menu" | "events";
}

export function RestaurantNavbar({
  slug,
  name,
  cuisineType,
  brandIcon = "utensils",
  isDemo,
  enabledModules,
  activeTab,
}: RestaurantNavbarProps) {
  const navItemsCount =
    Number(enabledModules.site) +
    Number(enabledModules.menu) +
    Number(enabledModules.events);

  const mobileNavCols =
    navItemsCount <= 1
      ? "grid-cols-1"
      : navItemsCount === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      {isDemo && (
        <div className="border-b border-obsidian-border bg-obsidian px-4 py-2 text-xs text-ivory">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian-card px-2.5 py-0.5 text-xs font-medium text-gold">
                <Sparkles className="size-3 shrink-0" />
                <span>Escenario Demo:</span>
              </span>
              <Link
                href={
                  activeTab === "menu"
                    ? "/casa-brasa/menu"
                    : activeTab === "events"
                      ? "/casa-brasa/eventos"
                      : "/casa-brasa"
                }
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  slug === "casa-brasa"
                    ? "bg-ivory text-obsidian shadow-xs"
                    : "border border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
                }`}
              >
                <span>Casa Brasa (2 Ciudades · 3 Sedes)</span>
              </Link>
              <Link
                href={
                  activeTab === "menu"
                    ? "/botanica-brunch/menu"
                    : activeTab === "events"
                      ? "/botanica-brunch/eventos"
                      : "/botanica-brunch"
                }
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  slug === "botanica-brunch"
                    ? "bg-ivory text-obsidian shadow-xs"
                    : "border border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
                }`}
              >
                <span>Botánica (1 Sede)</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/super-admin"
                className="hidden md:inline-flex items-center rounded-full border border-gold/35 bg-obsidian-card px-3 py-1 text-xs font-semibold text-gold transition hover:bg-gold hover:text-obsidian"
              >
                Super-Admin Planes
              </Link>
              <Link
                href="/"
                className="hidden sm:inline-flex items-center rounded-md px-2 py-1 text-xs text-ivory-muted transition hover:text-ivory"
              >
                Modelos SaaS
              </Link>
              <Link
                href={`/dashboard/${slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian-card px-3 py-1 text-xs font-semibold text-ivory transition hover:border-gold"
              >
                <LayoutDashboard className="size-3.5 shrink-0 text-gold" />
                <span>Consola Operativa</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 sm:px-6 lg:py-3.5">
          <div className="flex min-w-0 items-center justify-between gap-2 lg:flex-1">
            <Link
              href={`/${slug}`}
              className="group flex min-w-0 items-center gap-2.5 sm:gap-3 focus:outline-none"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ember text-ivory shadow-xs transition group-hover:bg-ember-hover sm:size-10">
                <BrandIcon icon={brandIcon} className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0">
                <span className="block truncate font-display text-xl font-semibold leading-tight tracking-tight text-ink sm:text-2xl">
                  {name}
                </span>
                {cuisineType && (
                  <span className="block truncate text-xs font-medium text-ink-muted">
                    {cuisineType}
                  </span>
                )}
              </div>
            </Link>

            {enabledModules.events && (
              <Link
                href={`/${slug}/eventos#solicitud-cotizacion-eventos`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ember/30 bg-surface-accent px-3 py-1.5 text-xs font-semibold text-ember transition hover:bg-ember hover:text-ivory lg:hidden"
              >
                <Sparkles className="size-3.5 shrink-0" />
                <span>Cotizar Evento</span>
              </Link>
            )}
          </div>

          {navItemsCount > 0 && (
            <nav
              aria-label="Navegación principal del restaurante"
              className={`grid ${mobileNavCols} shrink-0 gap-1 rounded-full border border-hairline bg-canvas-muted/75 p-1 lg:flex lg:items-center lg:gap-1.5 lg:border-0 lg:bg-transparent lg:p-0`}
            >
              {enabledModules.site && (
                <Link
                  href={`/${slug}`}
                  className={`inline-flex min-h-9 lg:min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition lg:px-4 lg:py-2 lg:text-sm ${
                    activeTab === "site"
                      ? "bg-ink text-ivory shadow-xs"
                      : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
                  }`}
                >
                  <MapPin className="hidden size-3.5 shrink-0 sm:inline" />
                  <span>El Restaurante</span>
                </Link>
              )}

              {enabledModules.menu && (
                <Link
                  href={`/${slug}/menu`}
                  className={`inline-flex min-h-9 lg:min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition lg:px-4 lg:py-2 lg:text-sm ${
                    activeTab === "menu"
                      ? "bg-ember text-ivory shadow-xs"
                      : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
                  }`}
                >
                  <UtensilsCrossed className="size-3.5 shrink-0" />
                  <span>Carta Digital</span>
                </Link>
              )}

              {enabledModules.events && (
                <Link
                  href={`/${slug}/eventos`}
                  className={`inline-flex min-h-9 lg:min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition lg:px-4 lg:py-2 lg:text-sm ${
                    activeTab === "events"
                      ? "bg-ink text-ivory shadow-xs"
                      : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
                  }`}
                >
                  <Sparkles
                    className={`size-3.5 shrink-0 ${
                      activeTab === "events" ? "text-gold" : "text-ember"
                    }`}
                  />
                  <span className="sm:hidden">Eventos</span>
                  <span className="hidden sm:inline">Eventos & Salones</span>
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
