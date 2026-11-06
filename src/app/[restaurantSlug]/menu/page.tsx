import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { InteractiveMenuBrowser } from "@/components/public/interactive-menu-browser";

interface MenuPageProps {
  params: Promise<{ restaurantSlug: string }>;
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
    title: `Carta Digital · ${data.restaurant.name}`,
    description:
      data.menus[0]?.description ??
      `Explora la carta actualizada de ${data.restaurant.name}.`,
  };
}

export default async function RestaurantMenuPage({ params }: MenuPageProps) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data || !data.enabledModules.menu) {
    notFound();
  }

  const primaryMenu = data.menus[0];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <RestaurantNavbar
        slug={data.restaurant.slug}
        name={data.restaurant.name}
        cuisineType={data.restaurant.cuisine_type}
        isDemo={data.restaurant.is_demo}
        enabledModules={data.enabledModules}
        activeTab="menu"
      />

      <main className="flex-1">
        <InteractiveMenuBrowser
          restaurantName={data.restaurant.name}
          currencyCode={data.restaurant.currency_code}
          authenticityBadge={data.theme.authenticityBadge}
          serviceChargeNote={data.theme.serviceChargeNote}
          scheduleLabel={primaryMenu?.schedule_label}
          serviceNotes={primaryMenu?.service_notes}
          categories={data.categories}
        />
      </main>
    </div>
  );
}
