import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { RestaurantFooter } from "@/components/public/restaurant-footer";
import { EventInquiryComposer } from "@/components/public/event-inquiry-composer";

interface EventsPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{
    sede?: string;
    salon?: string;
    paquete?: string;
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

  if (!data || !data.enabledModules.events) {
    notFound();
  }

  const isSunlitHero = data.theme.heroStyle === "sunlit-editorial";

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
        enabledModules={data.enabledModules}
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
          locations={data.locations}
          spaces={data.eventSpaces}
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
        locations={data.locations}
        enabledModules={data.enabledModules}
      />
    </div>
  );
}
