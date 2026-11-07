import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  UtensilsCrossed,
  Sparkles,
  Camera,
  Users,
  ArrowRight,
  ShieldAlert,
  Layers,
} from "lucide-react";
import {
  getRestaurantBySlug,
  getRequestEffectiveCapabilities,
  resolveEffectiveLocations,
} from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { RestaurantFooter } from "@/components/public/restaurant-footer";
import { LocationsShowcase } from "@/components/public/locations-showcase";
import { LivePlanSimulator } from "@/components/public/live-plan-simulator";
import {
  formatCurrency,
  getAdaptiveThreeColumnGrid,
} from "@/lib/utils";

interface RestaurantPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{ plan?: string }>;
}

export async function generateMetadata({
  params,
}: RestaurantPageProps): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data) {
    return { title: "Restaurante" };
  }

  return {
    title: `${data.restaurant.name} · ${
      data.restaurant.cuisine_type ?? "Carta Digital & Eventos"
    }`,
    description:
      data.restaurant.story_excerpt ??
      data.restaurant.tagline ??
      `Descubre la carta digital, domicilios directos y salones privados de ${data.restaurant.name}.`,
  };
}

export default async function RestaurantCommercialPage({
  params,
  searchParams,
}: RestaurantPageProps) {
  const [{ restaurantSlug }, resolvedSearch] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data) {
    notFound();
  }

  const caps = await getRequestEffectiveCapabilities(data, resolvedSearch.plan);
  const locations = resolveEffectiveLocations(data, caps);
  const visibleLocationIds = new Set(locations.map((l) => l.id));

  const enabledModules = {
    site: caps.siteEnabled,
    menu: caps.menuVitrineEnabled,
    events: caps.eventsEnabled,
  };

  const { restaurant, theme, contact, featuredProducts } = data;
  const eventSpaces = data.eventSpaces.filter(
    (sp) => !sp.location_id || visibleLocationIds.has(sp.location_id)
  );
  const cities = Array.from(
    new Set(locations.map((l) => (l.city || "Bogotá").trim()))
  );

  if (caps.isSuspended) {
    return (
      <div
        data-theme={theme.palette}
        className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4 py-16 text-center text-ink"
      >
        <div className="max-w-lg rounded-3xl border border-hairline bg-canvas-elevated p-8 shadow-lg sm:p-10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-ember">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            {restaurant.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Nuestra experiencia digital se encuentra temporalmente en pausa
            operativa. Para reservas o atención inmediata, comunícate con
            nuestro equipo directo.
          </p>
          {restaurant.is_demo && (
            <div className="mt-6 border-t border-hairline pt-5">
              <Link
                href="/super-admin"
                className="inline-flex items-center gap-2 rounded-full bg-obsidian px-5 py-2.5 text-xs font-semibold text-gold transition hover:bg-ink"
              >
                <Layers className="size-4" />
                <span>Reactivar suscripción en /super-admin</span>
              </Link>
            </div>
          )}
        </div>

        <LivePlanSimulator
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          isDemo={restaurant.is_demo}
          activeSimPreset={caps.simPreset}
          realPlanTier={data.entitlements.planTier}
          realDesignTier={data.entitlements.designTier}
          realSubscriptionStatus={data.entitlements.subscriptionStatus}
        />
      </div>
    );
  }

  const isSunlitHero = theme.heroStyle === "sunlit-editorial";
  const featuredSlice = featuredProducts.slice(0, 3);
  const totalMenuDishes = data.categories.reduce(
    (acc, c) => acc + c.products.length,
    0
  );

  return (
    <div
      data-theme={theme.palette}
      className="min-h-screen flex flex-col bg-canvas text-ink"
    >
      <RestaurantNavbar
        slug={restaurant.slug}
        name={restaurant.name}
        cuisineType={restaurant.cuisine_type}
        brandIcon={theme.brandIcon}
        isDemo={restaurant.is_demo}
        enabledModules={enabledModules}
        activeTab="site"
      />

      <main className="flex-1">
        {/* Adaptive Multi-Tenant Hero: Sunlit Editorial (Botánica) vs. Immersive Dark (Casa Brasa) */}
        <section
          className={
            isSunlitHero
              ? "relative overflow-hidden border-b border-hairline bg-gradient-to-br from-surface-accent/70 via-canvas to-canvas-elevated text-ink"
              : "relative overflow-hidden border-b border-obsidian-border bg-obsidian text-ivory"
          }
        >
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-18">
            <div className="lg:col-span-7">
              {theme.authenticityBadge && (
                <div
                  className={
                    isSunlitHero
                      ? "mb-4 inline-flex items-center gap-2 rounded-full border border-ember/25 bg-canvas-elevated px-3.5 py-1.5 text-xs font-semibold text-ember shadow-2xs"
                      : "mb-4 inline-flex items-center gap-2 rounded-full border border-obsidian-border bg-obsidian-card px-3.5 py-1.5 text-xs font-medium text-gold"
                  }
                >
                  <Camera
                    className={`size-3.5 shrink-0 ${
                      isSunlitHero ? "text-ember" : "text-ember-glow"
                    }`}
                  />
                  <span>{theme.authenticityBadge}</span>
                </div>
              )}

              <h1
                className={`font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl ${
                  isSunlitHero ? "text-ink" : "text-ivory"
                }`}
              >
                {restaurant.tagline ?? restaurant.name}
              </h1>

              {restaurant.story_excerpt && (
                <p
                  className={`mt-5 max-w-xl text-base leading-relaxed sm:text-[17px] ${
                    isSunlitHero ? "text-ink-muted" : "text-ivory-muted"
                  }`}
                >
                  {restaurant.story_excerpt}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {enabledModules.menu && (
                  <Link
                    href={`/${restaurant.slug}/menu`}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-ember px-7 py-3.5 text-sm font-semibold text-ivory shadow-md transition hover:bg-ember-hover"
                  >
                    <UtensilsCrossed className="size-4 shrink-0" />
                    <span>Explorar Carta Digital</span>
                  </Link>
                )}

                {enabledModules.events && (
                  <Link
                    href={`/${restaurant.slug}/eventos`}
                    className={
                      isSunlitHero
                        ? "inline-flex min-h-12 items-center gap-2.5 rounded-full border border-border-strong bg-canvas-elevated px-7 py-3.5 text-sm font-semibold text-ink shadow-2xs transition hover:border-ember hover:text-ember"
                        : "inline-flex min-h-12 items-center gap-2.5 rounded-full border border-obsidian-border bg-obsidian-card px-7 py-3.5 text-sm font-semibold text-ivory transition hover:border-gold hover:text-gold"
                    }
                  >
                    <Sparkles
                      className={`size-4 shrink-0 ${
                        isSunlitHero ? "text-ember" : "text-gold"
                      }`}
                    />
                    <span>Salones Privados & Eventos</span>
                  </Link>
                )}
              </div>

              <div
                className={`mt-10 grid grid-cols-3 gap-4 border-t pt-6 text-xs ${
                  isSunlitHero
                    ? "border-hairline text-ink-muted"
                    : "border-obsidian-border text-ivory-muted"
                }`}
              >
                <div>
                  <span
                    className={`tabular-price block font-sans text-lg font-bold ${
                      isSunlitHero ? "text-ink" : "text-ivory"
                    }`}
                  >
                    {restaurant.slug === "casa-brasa"
                      ? "28 – 45 Días"
                      : `${totalMenuDishes} Creaciones`}
                  </span>
                  <span className="mt-0.5 block">
                    {restaurant.slug === "casa-brasa"
                      ? "Maduración Dry-Aged en casa"
                      : restaurant.cuisine_type ?? "Carta de Autor"}
                  </span>
                </div>
                <div>
                  <span
                    className={`tabular-price block font-sans text-lg font-bold ${
                      isSunlitHero ? "text-ink" : "text-ivory"
                    }`}
                  >
                    {locations.length === 1
                      ? "Casa Única"
                      : cities.length > 1
                      ? `${locations.length} Sedes · ${cities.length} Ciudades`
                      : `${locations.length} Sedes`}
                  </span>
                  <span className="mt-0.5 block">
                    {cities.length > 1
                      ? cities.join(" & ")
                      : locations
                          .map(
                            (l) =>
                              l.neighborhood?.split("·")[0]?.trim() || l.name
                          )
                          .join(" & ")}
                  </span>
                </div>
                <div>
                  <span
                    className={`tabular-price block font-sans text-lg font-bold ${
                      isSunlitHero ? "text-ink" : "text-ivory"
                    }`}
                  >
                    {enabledModules.events && eventSpaces.length > 0
                      ? `${Math.min(
                          ...eventSpaces.map((s) => s.min_guests)
                        )} – ${Math.max(
                          ...eventSpaces.map((s) => s.capacity_seated)
                        )} Inv.`
                      : caps.directOrdersEnabled
                      ? "0% Comisión"
                      : "Carta Editorial"}
                  </span>
                  <span className="mt-0.5 block">
                    {enabledModules.events && eventSpaces.length > 0
                      ? eventSpaces.length === 1
                        ? "1 Salón Privado"
                        : `${eventSpaces.length} Salones Privados`
                      : caps.directOrdersEnabled
                      ? "Mesa QR & Domicilios Directos"
                      : "Lectura Directa en Mesa"}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div
                className={`relative aspect-[4/5] w-full overflow-hidden rounded-3xl border shadow-2xl ${
                  isSunlitHero
                    ? "border-hairline bg-canvas-muted"
                    : "border-obsidian-border bg-obsidian-card"
                }`}
              >
                {theme.heroImage && (
                  <Image
                    src={theme.heroImage}
                    alt={restaurant.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                  />
                )}
                <div
                  className={
                    isSunlitHero
                      ? "absolute inset-0 bg-gradient-to-t from-obsidian/55 via-transparent to-transparent"
                      : "absolute inset-0 bg-gradient-to-t from-obsidian/85 via-transparent to-transparent"
                  }
                />
                {featuredSlice[0] && enabledModules.menu && (
                  <Link
                    href={`/${restaurant.slug}/menu`}
                    className={
                      isSunlitHero
                        ? "group absolute right-4 bottom-4 left-4 rounded-2xl border border-hairline bg-canvas-elevated/95 p-4 text-ink shadow-lg backdrop-blur-md transition hover:border-ember"
                        : "group absolute right-5 bottom-5 left-5 rounded-2xl border border-obsidian-border/80 bg-obsidian/90 p-4 text-ivory backdrop-blur-md transition hover:border-gold"
                    }
                  >
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isSunlitHero ? "text-ember" : "text-ember-glow"
                      }`}
                    >
                      {theme.signatureBadgeLabel} en Carta
                    </span>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="font-display text-xl font-semibold line-clamp-1">
                        {featuredSlice[0].name}
                      </p>
                      <span
                        className={`tabular-price shrink-0 font-mono text-sm font-semibold ${
                          isSunlitHero ? "text-ember" : "text-gold"
                        }`}
                      >
                        {formatCurrency(
                          Number(featuredSlice[0].base_price),
                          restaurant.currency_code
                        )}
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Culinary Creations (Adaptive 1 / 2 / 3 Grid) */}
        {enabledModules.menu && featuredSlice.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-10 flex flex-col justify-between gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">
                  Selección de Nuestra Cocina
                </span>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  Creaciones Protagonistas en Carta
                </h2>
              </div>
              <Link
                href={`/${restaurant.slug}/menu`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember hover:underline"
              >
                <span>Explorar toda la carta y precios</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {featuredSlice.length === 1 && featuredSlice[0] ? (
              <Link
                href={`/${restaurant.slug}/menu`}
                className="group grid grid-cols-1 overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-xs transition hover:border-ember/50 hover:shadow-lg lg:grid-cols-12"
              >
                {featuredSlice[0].image_url && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-canvas-muted lg:col-span-6 lg:aspect-auto lg:min-h-[300px]">
                    <Image
                      src={featuredSlice[0].image_url}
                      alt={featuredSlice[0].image_alt ?? featuredSlice[0].name}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-col justify-center p-7 sm:p-9 lg:col-span-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ember">
                    {theme.signatureBadgeLabel}
                  </span>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-ink transition group-hover:text-ember">
                    {featuredSlice[0].name}
                  </h3>
                  {featuredSlice[0].short_description && (
                    <p className="mt-3 text-base leading-relaxed text-ink-muted">
                      {featuredSlice[0].short_description}
                    </p>
                  )}
                  <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
                    <span className="tabular-price font-mono text-lg font-semibold text-ember">
                      {formatCurrency(
                        Number(featuredSlice[0].base_price),
                        restaurant.currency_code
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:text-ember">
                      <span>Ver en la carta</span>
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div
                className={`grid gap-6 ${getAdaptiveThreeColumnGrid(
                  featuredSlice.length
                )}`}
              >
                {featuredSlice.map((product, idx) => (
                  <Link
                    key={product.id}
                    href={`/${restaurant.slug}/menu`}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated transition hover:-translate-y-1 hover:border-ember/50 hover:shadow-lg"
                  >
                    {product.image_url && (
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas-muted">
                        <Image
                          src={product.image_url}
                          alt={product.image_alt ?? product.name}
                          fill
                          priority={idx < 2}
                          sizes={
                            featuredSlice.length === 2
                              ? "(max-width: 768px) 100vw, 50vw"
                              : "(max-width: 768px) 100vw, 33vw"
                          }
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-display text-2xl font-semibold text-ink transition group-hover:text-ember">
                            {product.name}
                          </h3>
                          <span className="tabular-price shrink-0 font-mono text-sm font-semibold text-ember">
                            {formatCurrency(
                              Number(product.base_price),
                              restaurant.currency_code
                            )}
                          </span>
                        </div>
                        {product.short_description && (
                          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                            {product.short_description}
                          </p>
                        )}
                      </div>
                      {product.portion_label && (
                        <p className="mt-4 border-t border-hairline pt-3 text-xs font-medium text-ink-muted">
                          {product.portion_label}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Private Events & Celebrations Teaser (Adaptive 1 / 2 / 3 Grid + Tenant Atmosphere) */}
        {enabledModules.events && eventSpaces.length > 0 && (
          <section
            className={
              isSunlitHero
                ? "border-y border-hairline bg-surface-accent/50 py-16 text-ink"
                : "border-y border-obsidian-border bg-obsidian py-16 text-ivory"
            }
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <span
                    className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                      isSunlitHero ? "text-ember" : "text-gold"
                    }`}
                  >
                    Eventos Empresariales & Celebraciones Privadas
                  </span>
                  <h2
                    className={`mt-1 font-display text-3xl font-semibold sm:text-4xl ${
                      isSunlitHero ? "text-ink" : "text-ivory"
                    }`}
                  >
                    Salones Diseñados para Grandes Ocasiones
                  </h2>
                </div>
                <Link
                  href={`/${restaurant.slug}/eventos`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
                >
                  <span>Ver paquetes y cotizar fecha</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div
                className={`grid gap-6 ${getAdaptiveThreeColumnGrid(
                  eventSpaces.length
                )}`}
              >
                {eventSpaces.map((space) => (
                  <Link
                    key={space.id}
                    href={`/${restaurant.slug}/eventos?salon=${encodeURIComponent(
                      space.slug
                    )}`}
                    className={
                      isSunlitHero
                        ? "group flex flex-col justify-between overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-xs transition hover:-translate-y-1 hover:border-ember/50 hover:shadow-lg"
                        : "group flex flex-col justify-between overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian-card transition hover:-translate-y-1 hover:border-gold/50"
                    }
                  >
                    <div>
                      {space.cover_image_url && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-canvas-muted">
                          <Image
                            src={space.cover_image_url}
                            alt={space.name}
                            fill
                            sizes={
                              eventSpaces.length === 2
                                ? "(max-width: 768px) 100vw, 50vw"
                                : "(max-width: 768px) 100vw, 33vw"
                            }
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/75 via-transparent to-transparent" />
                          <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 font-mono text-xs text-ivory">
                            <Users className="size-3.5 text-gold" />
                            <span>
                              {space.min_guests} – {space.capacity_seated} personas
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="p-6 pb-0">
                        {!space.cover_image_url && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs ${
                              isSunlitHero
                                ? "border-hairline bg-surface-accent text-ember"
                                : "border-obsidian-border bg-obsidian text-gold"
                            }`}
                          >
                            <Users className="size-3.5" />
                            <span>
                              {space.min_guests} – {space.capacity_seated} personas
                            </span>
                          </span>
                        )}
                        <h3
                          className={`font-display text-2xl font-semibold ${
                            isSunlitHero
                              ? "text-ink group-hover:text-ember"
                              : "text-ivory group-hover:text-gold"
                          }`}
                        >
                          {space.name}
                        </h3>
                        <p
                          className={`mt-2 text-sm leading-relaxed ${
                            isSunlitHero ? "text-ink-muted" : "text-ivory-muted"
                          }`}
                        >
                          {space.description}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`m-6 mt-5 border-t pt-4 ${
                        isSunlitHero
                          ? "border-hairline"
                          : "border-obsidian-border"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold group-hover:underline ${
                          isSunlitHero ? "text-ember" : "text-ember-glow"
                        }`}
                      >
                        <span>Explorar galería, paquetes y disponibilidad</span>
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Multi-Location or Single-Establishment Architectural Showcase */}
        <LocationsShowcase
          restaurantName={restaurant.name}
          restaurantSlug={restaurant.slug}
          locations={locations}
          eventSpaces={eventSpaces}
          enabledModules={{
            menu: enabledModules.menu,
            events: enabledModules.events,
          }}
        />
      </main>

      <RestaurantFooter
        slug={restaurant.slug}
        name={restaurant.name}
        tagline={restaurant.tagline}
        contact={contact}
        locations={locations}
        enabledModules={enabledModules}
      />

      <LivePlanSimulator
        restaurantSlug={restaurant.slug}
        restaurantName={restaurant.name}
        isDemo={restaurant.is_demo}
        activeSimPreset={caps.simPreset}
        realPlanTier={data.entitlements.planTier}
        realDesignTier={data.entitlements.designTier}
        realSubscriptionStatus={data.entitlements.subscriptionStatus}
      />
    </div>
  );
}
