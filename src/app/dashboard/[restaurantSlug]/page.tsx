import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CalendarCheck,
  ExternalLink,
  QrCode,
  Lock,
} from "lucide-react";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { getOperationalConsoleSnapshot } from "@/modules/admin/queries";
import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import { BrandIcon } from "@/components/public/brand-icon";
import { InteractiveDashboardConsole } from "@/components/admin/interactive-dashboard-console";

interface DashboardPageProps {
  params: Promise<{ restaurantSlug: string }>;
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
    description: `Panel operativo Multi-Tenant, control de carta en vivo, CRM de eventos y generador QR para ${data.restaurant.name}.`,
  };
}

export default async function RestaurantDashboardPage({
  params,
}: DashboardPageProps) {
  const { restaurantSlug } = await params;
  const [data, snapshot, supabase] = await Promise.all([
    getRestaurantBySlug(restaurantSlug),
    getOperationalConsoleSnapshot(restaurantSlug),
    createSupabaseAuthenticatedServerClient(),
  ]);

  if (!data) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <div
      data-theme={data.theme.palette}
      className="min-h-screen bg-canvas text-ink"
    >
      {/* Top Scenario & Demo Bar */}
      <div className="border-b border-obsidian-border bg-obsidian px-4 py-2 text-xs text-ivory">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-obsidian-border bg-obsidian-card px-2.5 py-0.5 font-semibold text-gold">
              Centro de Mando &quot;Mise en Place&quot;
            </span>
            <span className="hidden text-ivory-muted sm:inline">
              Alterna entre el escenario Multi-Sede (2 sedes) y Sede Única (1
              establecimiento):
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/casa-brasa"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                data.restaurant.slug === "casa-brasa"
                  ? "bg-ivory text-obsidian shadow-2xs"
                  : "border border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
              }`}
            >
              Casa Brasa (2 Sedes)
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
                  {data.locations.length === 1
                    ? "Casa Única"
                    : `${data.locations.length} Sedes Activas`}
                </span>
              </div>
              <p className="font-mono text-xs text-ink-muted">
                Tenant: /{data.restaurant.slug} ·{" "}
                {user
                  ? `Sesión: ${user.email}`
                  : "Modo Interactivo Demo (PostgreSQL RPC)"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.enabledModules.site && (
              <Link
                href={`/${data.restaurant.slug}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
              >
                <span>Sitio Web</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            {data.enabledModules.menu && (
              <Link
                href={`/${data.restaurant.slug}/menu`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
              >
                <QrCode className="size-3.5 text-ember" />
                <span>Carta Digital</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            {data.enabledModules.events && (
              <Link
                href={`/${data.restaurant.slug}/eventos`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory shadow-2xs transition hover:bg-ember-hover"
              >
                <CalendarCheck className="size-3.5" />
                <span>Eventos & Salones</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Security & Interactive Mode Banner */}
        <div className="mb-8 rounded-3xl border border-hairline bg-surface-accent/65 p-5 text-ink shadow-2xs">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sage" />
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  Consola Operativa en Tiempo Real · Seguridad Multi-Tenant RLS
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Prueba agotando cualquier plato en 1 clic, cambiando su precio,
                  actualizando el estado de una solicitud de evento o
                  descargando los códigos QR ISO/IEC 18004 escaneables. Todos los
                  cambios se persisten en PostgreSQL con auditoría en{" "}
                  <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs font-semibold text-ember">
                    public.audit_logs
                  </code>{" "}
                  mientras las tablas mantienen{" "}
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
          restaurantSlug={data.restaurant.slug}
          restaurantName={data.restaurant.name}
          currencyCode={data.restaurant.currency_code}
          enabledModules={data.enabledModules}
          deliveryEnabled={
            data.delivery.enabled || data.delivery.pickupEnabled
          }
          initialProducts={snapshot?.products ?? fallbackProducts}
          initialInquiries={snapshot?.inquiries ?? []}
          initialDirectOrders={snapshot?.directOrders ?? []}
          initialAuditLogs={snapshot?.auditLogs ?? []}
          locations={data.locations}
          eventSpaces={data.eventSpaces}
          eventPackages={data.eventPackages}
        />
      </main>
    </div>
  );
}
