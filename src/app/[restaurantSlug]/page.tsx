import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  UtensilsCrossed,
  Sparkles,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Camera,
  Users,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { getRestaurantBySlug, type OpeningHourSlot } from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";

interface RestaurantPageProps {
  params: Promise<{ restaurantSlug: string }>;
}

export default async function RestaurantCommercialPage({
  params,
}: RestaurantPageProps) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data) {
    notFound();
  }

  const {
    restaurant,
    theme,
    contact,
    enabledModules,
    locations,
    featuredProducts,
    eventSpaces,
  } = data;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <RestaurantNavbar
        slug={restaurant.slug}
        name={restaurant.name}
        cuisineType={restaurant.cuisine_type}
        isDemo={restaurant.is_demo}
        enabledModules={enabledModules}
        activeTab="site"
      />

      <main className="flex-1">
        {/* Hero Editorial Section (Obsidian Night Atmosphere) */}
        <section className="relative overflow-hidden bg-obsidian text-ivory border-b border-obsidian-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-7">
              {theme.authenticityBadge && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-obsidian-border bg-obsidian-card px-3.5 py-1.5 text-xs font-medium text-gold">
                  <Camera className="size-3.5 text-ember-glow" />
                  <span>{theme.authenticityBadge}</span>
                </div>
              )}

              <h1 className="font-display text-4xl font-semibold leading-[1.06] tracking-tight text-ivory sm:text-6xl">
                {restaurant.tagline ?? restaurant.name}
              </h1>

              {restaurant.story_excerpt && (
                <p className="mt-5 max-w-xl text-base leading-relaxed text-ivory-muted">
                  {restaurant.story_excerpt}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                {enabledModules.menu && (
                  <Link
                    href={`/${restaurant.slug}/menu`}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-ember px-7 py-3.5 text-sm font-semibold text-ivory shadow-lg transition hover:bg-ember-hover"
                  >
                    <UtensilsCrossed className="size-4" />
                    <span>Explorar Carta Digital</span>
                  </Link>
                )}

                {enabledModules.events && (
                  <Link
                    href={`/${restaurant.slug}/eventos`}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-obsidian-border bg-obsidian-card px-7 py-3.5 text-sm font-semibold text-ivory transition hover:border-gold hover:text-gold"
                  >
                    <Sparkles className="size-4 text-gold" />
                    <span>Salones Privados & Eventos</span>
                  </Link>
                )}
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-obsidian-border pt-6 text-xs text-ivory-muted">
                <div>
                  <span className="tabular-price block font-mono text-lg font-semibold text-ivory">
                    28 – 45 Días
                  </span>
                  <span>Maduración Dry-Aged en casa</span>
                </div>
                <div>
                  <span className="tabular-price block font-mono text-lg font-semibold text-ivory">
                    {locations.length} Sedes
                  </span>
                  <span>Parque de la 93 & Zona G</span>
                </div>
                <div>
                  <span className="tabular-price block font-mono text-lg font-semibold text-ivory">
                    10 – 75 Inv.
                  </span>
                  <span>Salones y Cava Privada</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian-card shadow-2xl">
                <Image
                  src={theme.heroImage ?? "/demo/casa-brasa/hero-steak.jpg"}
                  alt={restaurant.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-obsidian-border/80 bg-obsidian/90 p-4 backdrop-blur-md">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-ember-glow">
                    Corte Insignia en Carta
                  </span>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className="font-display text-xl font-semibold text-ivory">
                      Ribeye Ojo de Bife · 35 Días
                    </p>
                    <span className="tabular-price font-mono text-sm font-semibold text-gold">
                      $ 128.000
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Culinary Creations */}
        {enabledModules.menu && featuredProducts.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-10 flex flex-col justify-between gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
                  Selección del Chef Ejecutivo
                </span>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  Platos & Coctelería Protagonista
                </h2>
              </div>
              <Link
                href={`/${restaurant.slug}/menu`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember hover:underline"
              >
                <span>Ver la carta completa con precios y términos</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {featuredProducts.slice(0, 3).map((product, idx) => (
                <Link
                  key={product.id}
                  href={`/${restaurant.slug}/menu`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated transition hover:-translate-y-1 hover:border-ember/50 hover:shadow-lg"
                >
                  {product.image_url && (
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-obsidian">
                      <Image
                        src={product.image_url}
                        alt={product.image_alt ?? product.name}
                        fill
                        priority={idx === 0}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-2xl font-semibold text-ink group-hover:text-ember transition">
                          {product.name}
                        </h3>
                        <span className="tabular-price shrink-0 font-mono text-sm font-semibold text-ink">
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
          </section>
        )}

        {/* Private Events & Celebrations Teaser */}
        {enabledModules.events && eventSpaces.length > 0 && (
          <section className="border-y border-obsidian-border bg-obsidian py-16 text-ivory">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                    Eventos Empresariales & Celebraciones Privadas
                  </span>
                  <h2 className="mt-1 font-display text-3xl font-semibold text-ivory sm:text-4xl">
                    Salones Diseñados para Grandes Ocasiones
                  </h2>
                </div>
                <Link
                  href={`/${restaurant.slug}/eventos`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-ivory transition hover:bg-ember-hover"
                >
                  <span>Ver paquetes y cotizar fecha</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {eventSpaces.map((space) => (
                  <div
                    key={space.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian-card"
                  >
                    <div>
                      {space.cover_image_url && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian">
                          <Image
                            src={space.cover_image_url}
                            alt={space.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-transparent to-transparent" />
                          <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-obsidian/90 px-3 py-1 font-mono text-xs text-gold border border-obsidian-border">
                            <Users className="size-3.5 text-ember-glow" />
                            {space.min_guests} – {space.capacity_seated} personas
                          </span>
                        </div>
                      )}
                      <div className="p-6 pb-0">
                        {!space.cover_image_url && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3 py-1 font-mono text-xs text-gold border border-obsidian-border">
                            <Users className="size-3.5 text-ember-glow" />
                            {space.min_guests} – {space.capacity_seated} personas
                          </span>
                        )}
                        <h3 className="font-display text-2xl font-semibold text-ivory">
                          {space.name}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-ivory-muted">
                          {space.description}
                        </p>
                      </div>
                    </div>
                    <div className="m-6 mt-5 border-t border-obsidian-border pt-4">
                      <Link
                        href={`/${restaurant.slug}/eventos`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-glow hover:underline"
                      >
                        <span>Consultar paquetes y condiciones</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Multi-Location Directory & Hours */}
        {locations.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-10 border-b border-hairline pb-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
                Ubicaciones & Contacto Directo
              </span>
              <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
                Nuestras Sedes y Horarios de Atención
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {locations.map((loc) => {
                const hours = Array.isArray(loc.opening_hours)
                  ? (loc.opening_hours as unknown as OpeningHourSlot[])
                  : [];
                const waUrl = loc.whatsapp_phone
                  ? buildWhatsAppUrl(
                      loc.whatsapp_phone,
                      `Hola ${restaurant.name} (${loc.name}), quisiera hacer una consulta.`
                    )
                  : null;

                return (
                  <div
                    key={loc.id}
                    className="flex flex-col justify-between rounded-3xl border border-hairline bg-canvas-elevated p-6 sm:p-8"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-ember">
                          {loc.neighborhood ?? loc.city}
                        </span>
                        {loc.is_primary && (
                          <span className="rounded-full bg-obsidian px-3 py-0.5 text-[11px] font-medium text-ivory">
                            Sede Principal
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 font-display text-3xl font-semibold text-ink">
                        {loc.name}
                      </h3>

                      <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
                        <MapPin className="size-4 shrink-0 text-ember" />
                        <span>
                          {loc.address_line} · {loc.city}
                        </span>
                      </p>

                      {loc.highlights.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {loc.highlights.map((hl) => (
                            <span
                              key={hl}
                              className="rounded-full bg-canvas-muted px-3 py-1 text-xs font-medium text-ink"
                            >
                              {hl}
                            </span>
                          ))}
                        </div>
                      )}

                      {hours.length > 0 && (
                        <div className="mt-6 border-t border-hairline pt-4">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink">
                            <Clock className="size-3.5 text-ember" />
                            <span>Horarios de servicio</span>
                          </p>
                          <div className="flex flex-col gap-1.5 text-xs text-ink-muted">
                            {hours.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between"
                              >
                                <span className="font-medium text-ink">
                                  {slot.days}
                                </span>
                                <span className="tabular-price font-mono">
                                  {slot.hours}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-obsidian px-5 py-2.5 text-xs font-semibold text-ivory transition hover:bg-ember"
                        >
                          <MessageCircle className="size-4 text-ember-glow" />
                          <span>WhatsApp {loc.name}</span>
                        </a>
                      )}
                      {loc.contact_phone && (
                        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs font-mono text-ink-muted">
                          <Phone className="size-3.5 text-ember" />
                          {loc.contact_phone}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-hairline bg-canvas-elevated py-8 text-xs text-ink-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div>
            <p className="font-semibold text-ink">
              {restaurant.name} · {restaurant.tagline}
            </p>
            <p className="mt-0.5">
              {contact.instagramHandle} · {contact.eventsEmail}
            </p>
          </div>
          <div className="flex items-center gap-2 text-ink-muted">
            <ShieldCheck className="size-4 text-sage" />
            <span>
              Plataforma Multi-Tenant con Aislamiento RLS · Cumplimiento Ley 1581
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
