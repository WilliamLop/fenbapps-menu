import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { EventInquiryComposer } from "@/components/public/event-inquiry-composer";

interface EventsPageProps {
  params: Promise<{ restaurantSlug: string }>;
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
}: EventsPageProps) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data || !data.enabledModules.events) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <RestaurantNavbar
        slug={data.restaurant.slug}
        name={data.restaurant.name}
        cuisineType={data.restaurant.cuisine_type}
        isDemo={data.restaurant.is_demo}
        enabledModules={data.enabledModules}
        activeTab="events"
      />

      {/* Editorial Dark Header for Events Dossier */}
      <section className="border-b border-obsidian-border bg-obsidian py-12 text-ivory sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Dossier de Hospitalidad & Reservas de Grupos
          </span>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ivory sm:text-5xl">
            Eventos Corporativos, Cumpleaños & Celebraciones en{" "}
            {data.restaurant.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ivory-muted">
            Compara nuestros salones privados, revisa los paquetes gastronómicos con precios transparentes por invitado y registra tu solicitud de fecha en menos de 90 segundos.
          </p>
        </div>
      </section>

      <main className="flex-1">
        <EventInquiryComposer
          restaurantId={data.restaurant.id}
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          currencyCode={data.restaurant.currency_code}
          whatsappPhone={data.contact.whatsappPrimary ?? "+573105550193"}
          privacyPolicyText={
            data.contact.privacyPolicyText ??
            "Autorizo el tratamiento de mis datos personales para gestionar esta solicitud conforme a la Ley 1581 de 2012."
          }
          locations={data.locations}
          spaces={data.eventSpaces}
          packages={data.eventPackages}
        />
      </main>
    </div>
  );
}
