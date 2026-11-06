import Link from "next/link";
import { ShieldCheck, MapPin } from "lucide-react";
import type {
  EnabledModulesConfig,
  LocationRow,
  RestaurantContactConfig,
} from "@/modules/tenant/queries";

interface RestaurantFooterProps {
  slug: string;
  name: string;
  tagline: string | null;
  contact: RestaurantContactConfig;
  locations: LocationRow[];
  enabledModules: EnabledModulesConfig;
}

export function RestaurantFooter({
  slug,
  name,
  tagline,
  contact,
  locations,
  enabledModules,
}: RestaurantFooterProps) {
  const primaryLocation = locations[0];

  return (
    <footer className="border-t border-hairline bg-canvas-elevated py-10 text-sm text-ink-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="max-w-md">
            <p className="font-display text-2xl font-semibold text-ink">
              {name}
            </p>
            {tagline && <p className="mt-1 text-sm text-ink-muted">{tagline}</p>}
            {primaryLocation && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                <MapPin className="size-3.5 shrink-0 text-ember" />
                <span>
                  {locations.length === 1
                    ? `${primaryLocation.address_line} · ${primaryLocation.city}`
                    : `${locations.length} sedes en ${primaryLocation.city}: ${locations
                        .map((l) => l.name)
                        .join(" · ")}`}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-ink">
            {enabledModules.site && (
              <Link href={`/${slug}`} className="transition hover:text-ember">
                El Restaurante
              </Link>
            )}
            {enabledModules.menu && (
              <Link
                href={`/${slug}/menu`}
                className="transition hover:text-ember"
              >
                Carta Digital & Pedidos
              </Link>
            )}
            {enabledModules.events && (
              <Link
                href={`/${slug}/eventos`}
                className="transition hover:text-ember"
              >
                Eventos & Salones
              </Link>
            )}
            <Link
              href={`/dashboard/${slug}`}
              className="text-ink-muted transition hover:text-ember"
            >
              Consola Operativa
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-hairline pt-5 text-xs text-ink-muted sm:flex-row sm:items-center">
          <p>
            {[contact.instagramHandle, contact.eventsEmail]
              .filter(Boolean)
              .join(" · ") || name}
          </p>
          <div className="flex items-center gap-2 text-ink-muted">
            <ShieldCheck className="size-4 shrink-0 text-sage" />
            <span>
              Canal oficial directo sin recargos · Datos protegidos (Ley 1581 de
              2012)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
