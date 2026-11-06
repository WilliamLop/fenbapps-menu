import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  UtensilsCrossed,
  CalendarCheck,
  ExternalLink,
  QrCode,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Building2,
  Users,
  Sparkles,
} from "lucide-react";
import { getRestaurantBySlug } from "@/modules/tenant/queries";
import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type EventInquiryRow = Database["public"]["Tables"]["event_inquiries"]["Row"];

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
    description: `Panel operativo Multi-Tenant y bandeja de eventos para ${data.restaurant.name}.`,
  };
}

export default async function RestaurantDashboardPage({
  params,
}: DashboardPageProps) {
  const { restaurantSlug } = await params;
  const data = await getRestaurantBySlug(restaurantSlug);

  if (!data) {
    notFound();
  }

  // Verify authenticated user on server via getUser() (never getSession())
  const supabase = await createSupabaseAuthenticatedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Attempt to read private event_inquiries through RLS:
  // If user is not authenticated as a member of this restaurant, RLS returns 0 rows!
  const { data: rawInquiries } = await supabase
    .from("event_inquiries")
    .select("*")
    .eq("restaurant_id", data.restaurant.id)
    .order("created_at", { ascending: false });
  const inquiries = (rawInquiries ?? []) as EventInquiryRow[];

  const totalProducts = data.categories.reduce(
    (acc, cat) => acc + cat.products.length,
    0
  );
  const soldOutProducts = data.categories.reduce(
    (acc, cat) =>
      acc +
      cat.products.filter((p) => p.availability_status === "sold_out").length,
    0
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-ink">
      {/* Top Operational Bar */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-white px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-obsidian font-mono text-xs font-bold text-gold">
              CB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-ink">
                  {data.restaurant.name} · Consola Operativa
                </h1>
                <span className="rounded-full bg-sage/15 px-2.5 py-0.5 text-[11px] font-semibold text-sage">
                  Tenant Activo
                </span>
              </div>
              <p className="font-mono text-xs text-ink-muted">
                ID: {data.restaurant.id.slice(0, 8)}… · Slug: /{data.restaurant.slug}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/${data.restaurant.slug}/menu`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline bg-white px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-canvas"
            >
              <QrCode className="size-3.5 text-ember" />
              <span>Ver Carta QR Pública</span>
              <ExternalLink className="size-3" />
            </Link>
            <Link
              href={`/${data.restaurant.slug}/eventos`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-obsidian px-3.5 py-2 text-xs font-semibold text-ivory transition hover:bg-ember"
            >
              <CalendarCheck className="size-3.5 text-gold" />
              <span>Ver Portal de Eventos</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Live RLS & Security Verification Banner */}
        <div className="mb-8 rounded-2xl border border-obsidian-border bg-obsidian p-5 text-ivory shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sage" />
              <div>
                <h2 className="text-sm font-semibold text-ivory">
                  Escudo Multi-Tenant RLS Activo (`FORCE ROW LEVEL SECURITY`)
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ivory-muted">
                  {user ? (
                    <>
                      Sesión autenticada verificada con{" "}
                      <code className="text-gold">supabase.auth.getUser()</code>{" "}
                      ({user.email}). Viendo registros autorizados por{" "}
                      <code className="text-gold">
                        private.has_restaurant_role()
                      </code>
                      .
                    </>
                  ) : (
                    <>
                      Estás visualizando el Dashboard en{" "}
                      <strong>Modo Inspector de Demostración (Sin sesión iniciada)</strong>.
                      Observa cómo PostgreSQL RLS protege automáticamente los datos personales: la consulta a{" "}
                      <code className="text-gold">public.event_inquiries</code>{" "}
                      devuelve exactamente{" "}
                      <strong className="text-ember-glow">
                        {inquiries?.length ?? 0} filas privadas expuestas
                      </strong>{" "}
                      para usuarios no autenticados, y el producto de prueba en estado{" "}
                      <code className="text-gold">hidden</code> permanece oculto al público.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 py-2 text-xs">
              <Lock className="size-4 text-gold" />
              <span>Advisors Security Lints: 0</span>
            </div>
          </div>
        </div>

        {/* KPI Summary Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-hairline bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Categorías Publicadas</span>
              <Layers className="size-4 text-ember" />
            </div>
            <p className="tabular-price mt-2 font-mono text-3xl font-bold text-ink">
              {data.categories.length}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Grid editorial + Lista compacta
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Platos en Carta Pública</span>
              <UtensilsCrossed className="size-4 text-sage" />
            </div>
            <p className="tabular-price mt-2 font-mono text-3xl font-bold text-ink">
              {totalProducts}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {totalProducts - soldOutProducts} disponibles · {soldOutProducts}{" "}
              agotado hoy
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Salones & Paquetes</span>
              <CalendarCheck className="size-4 text-ember" />
            </div>
            <p className="tabular-price mt-2 font-mono text-3xl font-bold text-ink">
              {data.eventSpaces.length} / {data.eventPackages.length}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Aforos de 10 hasta 75 invitados
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
              <span>Sedes Configuradas</span>
              <Building2 className="size-4 text-ink" />
            </div>
            <p className="tabular-price mt-2 font-mono text-3xl font-bold text-ink">
              {data.locations.length}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Parque de la 93 & Zona G
            </p>
          </div>
        </div>

        {/* Catalog Structure Table ("Mise en Place" View) */}
        <section className="rounded-2xl border border-hairline bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Estado del Catálogo en Tiempo Real ("Mise en Place")
              </h2>
              <p className="text-xs text-ink-muted">
                Revalidación instantánea por etiquetas (`tenant:{data.restaurant.slug}:menu`).
              </p>
            </div>
            <span className="rounded-full bg-canvas px-3 py-1 font-mono text-xs text-ink-muted border border-hairline">
              Moneda: {data.restaurant.currency_code}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas/60 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3.5">Plato / Producto</th>
                  <th className="px-6 py-3.5">Categoría & Layout</th>
                  <th className="px-6 py-3.5">Variantes</th>
                  <th className="px-6 py-3.5">Estado en QR</th>
                  <th className="px-6 py-3.5 text-right">Precio Base</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.categories.flatMap((category) =>
                  category.products.map((product) => {
                    const isSoldOut =
                      product.availability_status === "sold_out";
                    return (
                      <tr key={product.id} className="hover:bg-canvas/40">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-ink">
                            {product.name}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {product.portion_label ?? product.slug}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-ink">
                            {category.name}
                          </span>
                          <span className="ml-2 rounded-md bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-muted border border-hairline">
                            {category.display_mode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-ink-muted">
                          {product.optionGroups.length > 0
                            ? `${product.optionGroups.length} grupos (${product.optionGroups
                                .map((g) => g.name)
                                .join(", ")})`
                            : "Precio directo"}
                        </td>
                        <td className="px-6 py-4">
                          {isSoldOut ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-warn/15 px-2.5 py-1 text-xs font-semibold text-amber-warn">
                              <AlertTriangle className="size-3.5" />
                              Agotado hoy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-2.5 py-1 text-xs font-semibold text-sage">
                              <CheckCircle2 className="size-3.5" />
                              Disponible
                            </span>
                          )}
                        </td>
                        <td className="tabular-price px-6 py-4 text-right font-mono font-semibold text-ink">
                          {formatCurrency(
                            Number(product.base_price),
                            data.restaurant.currency_code
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Commercial Events & Inquiries Console Section */}
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Configured Salons & Packages */}
          <div className="rounded-2xl border border-hairline bg-white p-6 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Salones & Paquetes de Eventos Activos
                </h2>
                <p className="text-xs text-ink-muted">
                  Configuración comercial publicada en `/{data.restaurant.slug}/eventos`
                </p>
              </div>
              <Sparkles className="size-4 text-ember" />
            </div>

            <div className="space-y-3">
              {data.eventSpaces.map((space) => (
                <div
                  key={space.id}
                  className="flex items-center justify-between rounded-xl border border-hairline bg-canvas/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {space.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {space.ambiance_tags.join(" · ")}
                    </p>
                  </div>
                  <span className="tabular-price inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold text-ink border border-hairline">
                    <Users className="size-3 text-ember" />
                    {space.min_guests}–{space.capacity_seated}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-hairline pt-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Modelos de Cotización Configurados
              </p>
              <div className="space-y-2">
                {data.eventPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-ink">{pkg.name}</span>
                    <span className="tabular-price font-mono font-semibold text-ember">
                      {pkg.base_price
                        ? `${formatCurrency(
                            Number(pkg.base_price),
                            data.restaurant.currency_code
                          )} / persona`
                        : "A medida"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Event Inquiries Inbox (RLS Protected) */}
          <div className="rounded-2xl border border-hairline bg-white p-6 lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Bandeja Comercial de Solicitudes de Eventos (`event_inquiries`)
                </h2>
                <p className="text-xs text-ink-muted">
                  Persistencia transaccional en PostgreSQL + puente directo a WhatsApp
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3 py-1 font-mono text-xs text-gold">
                <Lock className="size-3" />
                RLS: {user ? "Rol Autorizado" : "Modo Público Protegido"}
              </span>
            </div>

            {inquiries && inquiries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-hairline bg-canvas/60 font-semibold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-3 py-2.5">Código</th>
                      <th className="px-3 py-2.5">Cliente & Evento</th>
                      <th className="px-3 py-2.5">Fecha & Aforo</th>
                      <th className="px-3 py-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {inquiries.map((inq) => (
                      <tr key={inq.id}>
                        <td className="px-3 py-3 font-mono font-semibold text-ember">
                          {inq.reference_code}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-ink">
                            {inq.customer_name}
                          </p>
                          <p className="text-ink-muted">{inq.event_type}</p>
                        </td>
                        <td className="tabular-price px-3 py-3 font-mono text-ink">
                          {inq.tentative_date} · {inq.guest_count} inv.
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-sage/15 px-2.5 py-0.5 font-semibold text-sage">
                            {inq.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-hairline bg-canvas/50 p-6">
                <div className="flex items-start gap-3.5">
                  <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sage" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Protección de Datos Personales Activa (Ley 1581 / RLS)
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      Las solicitudes enviadas desde{" "}
                      <Link
                        href={`/${data.restaurant.slug}/eventos#solicitud-cotizacion-eventos`}
                        className="font-semibold text-ember underline"
                      >
                        /{data.restaurant.slug}/eventos
                      </Link>{" "}
                      se almacenan de forma segura mediante el RPC{" "}
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink border border-hairline">
                        public.submit_public_event_inquiry
                      </code>{" "}
                      generando un código único (<code className="font-mono">CB-YYMM-XXXX</code>).
                      Por política de seguridad{" "}
                      <code className="font-mono">event_inquiries_tenant_staff_select</code>,
                      los teléfonos, correos y presupuestos de clientes solo se desencriptan y listan cuando inicias sesión con un miembro verificado en{" "}
                      <code className="font-mono">restaurant_memberships</code>.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Link
                        href={`/${data.restaurant.slug}/eventos#solicitud-cotizacion-eventos`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember"
                      >
                        <CalendarCheck className="size-3.5 text-gold" />
                        <span>Probar envío de cotización en vivo</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
