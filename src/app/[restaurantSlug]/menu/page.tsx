import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Layers, ShieldAlert } from "lucide-react";
import {
  getRestaurantBySlug,
  getRequestEffectiveCapabilities,
  resolveEffectiveLocations,
} from "@/modules/tenant/queries";
import { RestaurantNavbar } from "@/components/public/restaurant-navbar";
import { RestaurantFooter } from "@/components/public/restaurant-footer";
import { InteractiveMenuBrowser } from "@/components/public/interactive-menu-browser";
import { LivePlanSimulator } from "@/components/public/live-plan-simulator";

interface MenuPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{
    sede?: string;
    modo?: string;
    mesa?: string;
    plan?: string;
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

  if (!data) {
    notFound();
  }

  const caps = await getRequestEffectiveCapabilities(data, resolvedSearch.plan);
  const locations = resolveEffectiveLocations(data, caps);

  if (caps.isSuspended || !caps.menuVitrineEnabled) {
    if (!data.restaurant.is_demo) {
      notFound();
    }
    return (
      <div
        data-theme={data.theme.palette}
        className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4 py-16 text-center text-ink"
      >
        <div className="max-w-lg rounded-3xl border border-hairline bg-canvas-elevated p-8 shadow-lg sm:p-10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-ember">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            Carta Digital en Pausa Operativa
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            La suscripción de {data.restaurant.name} está suspendida. Puedes
            reactivarla o cambiarla a Modo Vitrina desde la Consola Super-Admin.
          </p>
          <div className="mt-6 border-t border-hairline pt-5">
            <Link
              href="/super-admin"
              className="inline-flex items-center gap-2 rounded-full bg-obsidian px-5 py-2.5 text-xs font-semibold text-gold transition hover:bg-ink"
            >
              <Layers className="size-4" />
              <span>Abrir /super-admin</span>
            </Link>
          </div>
        </div>
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

  const enabledModules = {
    site: caps.siteEnabled,
    menu: caps.menuVitrineEnabled,
    events: caps.eventsEnabled,
  };

  const effectiveDelivery = {
    ...data.delivery,
    enabled: caps.directOrdersEnabled && data.delivery.enabled,
    pickupEnabled: caps.directOrdersEnabled && data.delivery.pickupEnabled,
  };

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
        enabledModules={enabledModules}
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
          deliveryConfig={effectiveDelivery}
          tableShortlistEnabled={caps.tableShortlistEnabled}
          directOrdersEnabled={caps.directOrdersEnabled}
          isVitrineOnly={caps.isVitrineOnly}
          authenticityBadge={data.theme.authenticityBadge}
          serviceChargeNote={data.theme.serviceChargeNote}
          scheduleLabel={primaryMenu?.schedule_label}
          serviceNotes={primaryMenu?.service_notes}
          categories={data.categories}
          locations={locations}
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
