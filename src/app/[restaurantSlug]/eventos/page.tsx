import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Lock, MessageCircle, UtensilsCrossed } from "lucide-react";
import {
  getRestaurantBySlug,
  getRequestEffectiveCapabilities,
  resolveEffectiveLocations,
} from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { RestaurantFooter } from "@/components/public/restaurant-footer";
import { EventInquiryComposer } from "@/components/public/event-inquiry-composer";
import { LivePlanSimulator } from "@/components/public/live-plan-simulator";
import { buildWhatsAppUrl } from "@/lib/utils";

interface EventsPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{
    sede?: string;
    salon?: string;
    paquete?: string;
    plan?: string;
  }>;
}

export async function generateMetadata({
  params,
}: EventsPageProps): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);
  if (!data) {
    return { title: "Eventos & Salones" };
  }
  return {
    title: `Eventos Privados & Celebraciones · ${data.restaurant.name}`,
    description: `Conoce los salones privados, paquetes empresariales y celebraciones en ${data.restaurant.name}.`,
  };
}

export default async function RestaurantEventsPage({
  params,
  searchParams,
}: EventsPageProps) {
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

  if (!caps.eventsEnabled) {
    const waFallback = data.contact.whatsappPrimary
      ? buildWhatsAppUrl(
          data.contact.whatsappPrimary,
          `Hola ${data.restaurant.name}, quisiera información para reservar una celebración o grupo.`
        )
      : null;

    return (
      <div
        data-theme={data.theme.palette}
        className="min-h-screen flex flex-col bg-canvas text-ink"
      >
        <RestaurantNavbar
          slug={data.restaurant.slug}
          name={data.restaurant.name}
          cuisineType={data.restaurant.cuisine_type}
          brandIcon={data.theme.brandIcon}
          isDemo={data.restaurant.is_demo}
          enabledModules={enabledModules}
          activeTab="site"
        />

        <main className="mx-auto flex flex-1 max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <div className="w-full rounded-3xl border border-hairline bg-canvas-elevated p-8 shadow-sm sm:p-10">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-ember">
              <Lock className="size-5" />
            </div>
            <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-ember">
              Atención de Reservas Directa
            </span>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
              Cotizador en Línea No Habilitado en Este Plan
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
              El dossier interactivo de Salones Privados y Mini-CRM de Eventos
              forma parte del <strong>Plan Full</strong>. Puedes explorar
              nuestra carta digital o comunicarte directamente por WhatsApp.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {enabledModules.menu && (
                <Link
                  href={`/${data.restaurant.slug}/menu`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                >
                  <UtensilsCrossed className="size-4" />
                  <span>Ir a la Carta Digital</span>
                </Link>
              )}
              {waFallback && (
                <a
                  href={waFallback}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-canvas px-6 py-2.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                >
                  <MessageCircle className="size-4 text-ember" />
                  <span>Consultar por WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </main>

        <RestaurantFooter
          slug={data.restaurant.slug}
          name={data.restaurant.name}
          tagline={data.restaurant.tagline}
          contact={data.contact}
          locations={locations}
          enabledModules={enabledModules}
        />

        <LivePlanSimulator
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          isDemo={data.restaurant.is_demo}
          activeSimPreset={caps.simPreset}
          realPlanTier={data.entitlements.planTier}
          realDesignTier={data.entitlements.designTier}
          realSubscriptionStatus={data.entitlements.subscriptionStatus}
        />
      </div>
    );
  }

  const isSunlitHero = data.theme.heroStyle === "sunlit-editorial";
  const visibleSpaces = data.eventSpaces.filter(
    (sp) => !sp.location_id || visibleLocationIds.has(sp.location_id)
  );

  return (
    <div
      data-theme={data.theme.palette}
      className="min-h-screen flex flex-col bg-canvas text-ink"
    >
      <RestaurantNavbar
        slug={data.restaurant.slug}
        name={data.restaurant.name}
        cuisineType={data.restaurant.cuisine_type}
        brandIcon={data.theme.brandIcon}
        isDemo={data.restaurant.is_demo}
        enabledModules={enabledModules}
        activeTab="events"
      />

      {/* Adaptive Editorial Header for Events Dossier */}
      <section
        className={
          isSunlitHero
            ? "border-b border-hairline bg-gradient-to-br from-surface-accent/70 via-canvas to-canvas-elevated py-12 text-ink sm:py-16"
            : "border-b border-obsidian-border bg-obsidian py-12 text-ivory sm:py-16"
        }
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.18em] ${
              isSunlitHero ? "text-ember" : "text-gold"
            }`}
          >
            Dossier de Hospitalidad & Reservas de Grupos
          </span>
          <h1
            className={`mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl ${
              isSunlitHero ? "text-ink" : "text-ivory"
            }`}
          >
            Eventos Corporativos, Cumpleaños & Celebraciones en{" "}
            {data.restaurant.name}
          </h1>
          <p
            className={`mt-3 max-w-2xl text-base leading-relaxed ${
              isSunlitHero ? "text-ink-muted" : "text-ivory-muted"
            }`}
          >
            Compara nuestros salones privados, revisa las experiencias
            gastronómicas con precios claros por invitado y solicita tu reserva
            de fecha en menos de 90 segundos.
          </p>
        </div>
      </section>

      <main className="flex-1">
        <EventInquiryComposer
          restaurantId={data.restaurant.id}
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          currencyCode={data.restaurant.currency_code}
          whatsappPhone={data.contact.whatsappPrimary ?? ""}
          privacyPolicyText={
            data.contact.privacyPolicyText ??
            "Autorizo el tratamiento de mis datos personales para gestionar esta solicitud conforme a la Ley 1581 de 2012."
          }
          locations={locations}
          spaces={visibleSpaces}
          packages={data.eventPackages}
          initialLocationSlug={resolvedSearch.sede}
          initialSpaceSlug={resolvedSearch.salon}
          initialPackageSlug={resolvedSearch.paquete}
        />
      </main>

      <RestaurantFooter
        slug={data.restaurant.slug}
        name={data.restaurant.name}
        tagline={data.restaurant.tagline}
        contact={data.contact}
        locations={locations}
        enabledModules={enabledModules}
      />

      <LivePlanSimulator
        restaurantSlug={data.restaurant.slug}
        restaurantName={data.restaurant.name}
        isDemo={data.restaurant.is_demo}
        activeSimPreset={caps.simPreset}
        realPlanTier={data.entitlements.planTier}
        realDesignTier={data.entitlements.designTier}
        realSubscriptionStatus={data.entitlements.subscriptionStatus}
      />
    </div>
  );
}
