import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CalendarCheck,
  ExternalLink,
  QrCode,
  Lock,
  Layers,
  Crown,
} from "lucide-react";
import {
  getRestaurantBySlug,
  getRequestEffectiveCapabilities,
  resolveEffectiveLocations,
} from "@/modules/tenant/queries";
import { getOperationalConsoleSnapshot } from "@/modules/admin/queries";
import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import { PLAN_TIERS_META, DESIGN_TIERS_META } from "@/lib/saas-entitlements";
import { BrandIcon } from "@/components/public/brand-icon";
import { LivePlanSimulator } from "@/components/public/live-plan-simulator";
import { InteractiveDashboardConsole } from "@/components/admin/interactive-dashboard-console";

interface DashboardPageProps {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{
    sede?: string;
    plan?: string;
    tab?: string;
  }>;
}

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);
  if (!data) {
    return { title: "Consola Operativa | Fenbapps" };
  }
  return {
    title: `Consola Operativa · ${data.restaurant.name}`,
    description: `Panel operativo Multi-Tenant y Multi-Ciudad, control de carta en vivo, domicilios 0% comisión, CRM de eventos y generador QR para ${data.restaurant.name}.`,
  };
}

export default async function RestaurantDashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const [{ restaurantSlug }, resolvedSearch] = await Promise.all([
    params,
    searchParams,
  ]);

  const [data, supabase] = await Promise.all([
    getRestaurantBySlug(restaurantSlug),
    createSupabaseAuthenticatedServerClient(),
  ]);

  if (!data) {
    notFound();
  }

  const caps = await getRequestEffectiveCapabilities(data, resolvedSearch.plan);
  const effectiveLocations = resolveEffectiveLocations(data, caps);

  const requestedLocation = resolvedSearch.sede
    ? effectiveLocations.find(
        (loc) =>
          loc.slug === resolvedSearch.sede || loc.id === resolvedSearch.sede
      ) ?? null
    : null;

  // If multi-location is disabled on a multi-branch tenant (e.g. simulating Basic),
  // scope the snapshot to the primary active house so branches never mix.
  const implicitSingleLocation =
    !caps.multiLocationEnabled && data.allLocations.length > 1
      ? effectiveLocations[0] ?? null
      : null;

  const snapshotLocation = requestedLocation ?? implicitSingleLocation;

  const [snapshot, authResult] = await Promise.all([
    getOperationalConsoleSnapshot(restaurantSlug, snapshotLocation?.id ?? null),
    supabase.auth.getUser(),
  ]);

  const user = authResult.data.user;

  const scopedEventSpaces = snapshotLocation
    ? data.eventSpaces.filter(
        (space) =>
          !space.location_id || space.location_id === snapshotLocation.id
      )
    : data.eventSpaces;

  const uniqueCities = Array.from(
    new Set(effectiveLocations.map((l) => l.city).filter(Boolean))
  );

  const fallbackCategories = data.categories.map((cat, idx) => ({
    id: cat.id,
    menu_id: cat.menu_id,
    slug: cat.slug,
    name: cat.name,
    subtitle: cat.subtitle,
    description: cat.description,
    display_mode: cat.display_mode as
      | "editorial_grid"
      | "compact_list"
      | "featured_cards",
    is_active: cat.is_active,
    sort_order: cat.sort_order ?? idx + 1,
    products_count: cat.products.length,
  }));

  const fallbackProducts = data.categories.flatMap((cat) =>
    cat.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      short_description: p.short_description,
      base_price: Number(p.base_price),
      availability_status: p.availability_status as
        | "available"
        | "sold_out"
        | "hidden",
      is_featured: p.is_featured,
      is_chef_choice: p.is_chef_choice,
      portion_label: p.portion_label,
      image_url: p.image_url,
      category_id: cat.id,
      category_name: cat.name,
      exclusive_location_name: null,
      updated_at: p.updated_at,
    }))
  );

  const planQuerySuffix =
    caps.isSimulated && caps.simPreset !== "real"
      ? `?plan=${encodeURIComponent(caps.simPreset)}`
      : "";

  const menuLinkHref = requestedLocation
    ? `/${data.restaurant.slug}/menu?sede=${encodeURIComponent(
        requestedLocation.slug
      )}${
        caps.isSimulated && caps.simPreset !== "real"
          ? `&plan=${encodeURIComponent(caps.simPreset)}`
          : ""
      }`
    : `/${data.restaurant.slug}/menu${planQuerySuffix}`;

  const eventsLinkHref = requestedLocation
    ? `/${data.restaurant.slug}/eventos?sede=${encodeURIComponent(
        requestedLocation.slug
      )}${
        caps.isSimulated && caps.simPreset !== "real"
          ? `&plan=${encodeURIComponent(caps.simPreset)}`
          : ""
      }`
    : `/${data.restaurant.slug}/eventos${planQuerySuffix}`;

  return (
    <div
      data-theme={data.theme.palette}
      className="min-h-screen bg-canvas text-ink"
    >
      {/* Top Scenario & SaaS Control Bar */}
      <div className="border-b border-obsidian-border bg-obsidian px-4 py-2 text-xs text-ivory">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-obsidian-border bg-obsidian-card px-2.5 py-0.5 font-semibold text-gold">
              Centro de Mando &quot;Mise en Place&quot;
            </span>
            <span className="hidden text-ivory-muted lg:inline">
              Alterna entre cadena Multi-Ciudad (Bogotá &amp; Medellín), Sede
              Única o Control Comercial SaaS:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/casa-brasa"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                data.restaurant.slug === "casa-brasa"
                  ? "bg-ivory text-obsidian shadow-2xs"
                  : "border border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
              }`}
            >
              Casa Brasa (2 Ciudades · 3 Sedes)
            </Link>
            <Link
              href="/dashboard/botanica-brunch"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                data.restaurant.slug === "botanica-brunch"
                  ? "bg-ivory text-obsidian shadow-2xs"
                  : "border border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
              }`}
            >
              Botánica (1 Sede)
            </Link>
            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-obsidian-card px-3 py-1 text-xs font-semibold text-gold transition hover:border-gold hover:bg-obsidian"
            >
              <Layers className="size-3.5" />
              <span>Super-Admin SaaS</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Operational Header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-ember text-ivory shadow-xs">
              <BrandIcon icon={data.theme.brandIcon} className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                  {data.restaurant.name} · Consola Operativa
                </h1>
                <span className="rounded-full border border-sage/30 bg-sage/12 px-2.5 py-0.5 text-xs font-semibold text-sage">
                  {effectiveLocations.length === 1
                    ? "Casa Única"
                    : `${effectiveLocations.length} Sedes · ${uniqueCities.length} ${
                        uniqueCities.length === 1 ? "Ciudad" : "Ciudades"
                      }`}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    caps.isVitrineOnly || caps.isSuspended
                      ? "border-crimson/35 bg-crimson/10 text-crimson"
                      : "border-ember/30 bg-surface-accent text-ember"
                  }`}
                >
                  <Crown className="size-3" />
                  <span>
                    {caps.isVitrineOnly
                      ? "Modo Vitrina Estática"
                      : caps.isSuspended
                        ? "Suscripción Suspendida"
                        : `${PLAN_TIERS_META[caps.planTier].shortLabel} · ${
                            DESIGN_TIERS_META[caps.designTier].shortLabel
                          }`}
                    {caps.isSimulated ? " (Simulación)" : ""}
                  </span>
                </span>
              </div>
              <p className="font-mono text-xs text-ink-muted">
                Tenant: /{data.restaurant.slug}
                {requestedLocation
                  ? ` · Sede aislada: ${requestedLocation.city} (${requestedLocation.name})`
                  : ""}{" "}
                ·{" "}
                {user
                  ? `Sesión: ${user.email}`
                  : "Modo Interactivo Demo (PostgreSQL RPC)"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {caps.siteEnabled && (
              <Link
                href={`/${data.restaurant.slug}${planQuerySuffix}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
              >
                <span>Sitio Web</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            {caps.menuVitrineEnabled && (
              <Link
                href={menuLinkHref}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
              >
                <QrCode className="size-3.5 text-ember" />
                <span>Carta Digital</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            {caps.eventsEnabled && (
              <Link
                href={eventsLinkHref}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory shadow-2xs transition hover:bg-ember-hover"
              >
                <CalendarCheck className="size-3.5" />
                <span>Eventos &amp; Salones</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Security & Interactive Mode Banner */}
        <div className="mb-6 rounded-3xl border border-hairline bg-surface-accent/65 p-5 text-ink shadow-2xs">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sage" />
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Consola Operativa Aislada por Ciudad/Sede · Seguridad
                  Multi-Tenant RLS
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Cada sede puede operar su propio stock, precios regionales,
                  bandeja de domicilios y solicitudes de eventos sin mezclar
                  ciudades ni cajas. Todos los cambios se persisten en
                  PostgreSQL con auditoría en{" "}
                  <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs font-semibold text-ember">
                    public.audit_logs
                  </code>{" "}
                  bajo{" "}
                  <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs font-semibold text-ember">
                    FORCE ROW LEVEL SECURITY
                  </code>
                  .
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-ink">
              <Lock className="size-4 text-sage" />
              <span>Advisors Security Lints: 0</span>
            </div>
          </div>
        </div>

        <InteractiveDashboardConsole
          key={`${data.restaurant.slug}:${requestedLocation?.id ?? "global"}:${caps.simPreset}:${caps.planTier}:${caps.subscriptionStatus}`}
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          currencyCode={data.restaurant.currency_code}
          capabilities={caps}
          selectedLocation={requestedLocation}
          initialTab={resolvedSearch.tab}
          deliveryEnabled={
            caps.directOrdersEnabled &&
            (data.delivery.enabled || data.delivery.pickupEnabled)
          }
          initialCategories={
            snapshot?.categories && snapshot.categories.length > 0
              ? snapshot.categories
              : fallbackCategories
          }
          initialProducts={snapshot?.products ?? fallbackProducts}
          initialInquiries={snapshot?.inquiries ?? []}
          initialDirectOrders={snapshot?.directOrders ?? []}
          initialAuditLogs={snapshot?.auditLogs ?? []}
          locations={effectiveLocations}
          eventSpaces={scopedEventSpaces}
          eventPackages={data.eventPackages}
        />
      </main>

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
