import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { RestaurantFooter } from "@/components/public/restaurant-footer";
import { InteractiveMenuBrowser } from "@/components/public/interactive-menu-browser";

interface MenuPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{
    sede?: string;
    modo?: string;
    mesa?: string;
  }>;
}

export async function generateMetadata({
  params,
}: MenuPageProps): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);
  if (!data) {
    return { title: "Carta Digital" };
  }
  return {
    title: `Carta Digital & Pedidos · ${data.restaurant.name}`,
    description:
      data.menus[0]?.description ??
      `Explora la carta en mesa o pide a domicilio directo en ${data.restaurant.name}.`,
  };
}

export default async function RestaurantMenuPage({
  params,
  searchParams,
}: MenuPageProps) {
  const [{ restaurantSlug }, resolvedSearch] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data || !data.enabledModules.menu) {
    notFound();
  }

  const primaryMenu = data.menus[0];

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
        activeTab="menu"
      />

      <main className="flex-1">
        <InteractiveMenuBrowser
          restaurantId={data.restaurant.id}
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          brandIcon={data.theme.brandIcon}
          searchPlaceholder={data.theme.searchPlaceholder}
          signatureBadgeLabel={data.theme.signatureBadgeLabel}
          menuTitle={primaryMenu?.name ?? "Carta Principal"}
          currencyCode={data.restaurant.currency_code}
          whatsappPhone={data.contact.whatsappPrimary}
          privacyPolicyText={data.contact.privacyPolicyText}
          deliveryConfig={data.delivery}
          authenticityBadge={data.theme.authenticityBadge}
          serviceChargeNote={data.theme.serviceChargeNote}
          scheduleLabel={primaryMenu?.schedule_label}
          serviceNotes={primaryMenu?.service_notes}
          categories={data.categories}
          locations={data.locations}
          initialLocationSlug={resolvedSearch.sede}
          initialMode={resolvedSearch.modo}
          initialTableNumber={resolvedSearch.mesa}
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
