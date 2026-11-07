import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Flame,
  Layers,
  LayoutDashboard,
  Leaf,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

export default function PlatformShowcasePage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* Top Executive Bar */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-obsidian text-gold shadow-xs">
              <UtensilsCrossed className="size-5 text-ember-glow" />
            </div>
            <div>
              <span className="block font-display text-xl font-semibold leading-none text-ink sm:text-2xl">
                Fenbapps Hospitality Suite
              </span>
              <span className="mt-0.5 block text-xs font-medium text-ink-muted">
                Carta Digital · Domicilios 0% Comisión · Eventos CRM · Multi-Ciudad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/super-admin"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-gold shadow-xs transition hover:bg-ink"
            >
              <Layers className="size-3.5" />
              <span>Consola Super-Admin</span>
            </Link>
            <Link
              href="/casa-brasa"
              className="hidden md:inline-flex min-h-10 items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
            >
              <span>Multi-Ciudad (3 Sedes)</span>
            </Link>
            <Link
              href="/botanica-brunch"
              className="hidden sm:inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
            >
              <span>Sede Única</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Header */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-ember/25 bg-surface-accent px-3.5 py-1.5 text-xs font-semibold text-ember">
              <Sparkles className="size-3.5" />
              <span>Arquitectura Multi-Marca, Multi-Ciudad & Planes SaaS en Tiempo Real</span>
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
              Diseño editorial de pago único y motor operativo SaaS recurrente.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Explora cómo la suite adapta diseño a medida, operación aislada por
              ciudad y sede, carta en mesa/domicilio 0% comisión y control en vivo
              de planes comerciales (`Basic`, `Standard`, `Full` y `Modo Vitrina`).
            </p>
          </div>

          {/* Dual Live Scenario Cards */}
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Scenario 1: Casa Brasa (Multi-Ciudad · Bogotá & Medellín · 3 Sedes) */}
            <article className="flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-md transition hover:shadow-xl">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-canvas-muted">
                <Image
                  src="/demo/casa-brasa/hero-steak.jpg"
                  alt="Casa Brasa · Escenario Multi-Ciudad"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/25 to-transparent" />
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/90 px-3 py-1 text-xs font-semibold text-gold backdrop-blur-xs">
                    <Flame className="size-3.5 text-ember-glow" />
                    <span>Multi-Ciudad (Bogotá & Medellín · 3 Sedes)</span>
                  </span>
                  <span className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                    Plan Full + Diseño Premium
                  </span>
                </div>
                <div className="absolute right-5 bottom-4 left-5 text-ivory">
                  <h2 className="font-display text-3xl font-semibold">
                    Casa Brasa · Fuego, Cava & Autor
                  </h2>
                  <p className="mt-0.5 text-sm text-ivory/90">
                    Bogotá (Parque 93 & Zona G) + Medellín (Provenza) · 4 salones privados
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
                <ul className="space-y-2.5 text-sm text-ink-muted">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                    <span>
                      <strong className="font-semibold text-ink">
                        Aislamiento total por ciudad y sede:
                      </strong>{" "}
                      agotados regionales, precio diferencial por sede, tarifa de domicilio y cuenta Bre-B independiente sin mezclar comandas en el CRM.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                    <span>
                      <strong className="font-semibold text-ink">
                        4 Salones en 2 ciudades & Simulador en vivo:
                      </strong>{" "}
                      prueba el cambio instantáneo entre Plan Full, Standard, Basic y Modo Vitrina con el botón flotante (`Shift+P`).
                    </span>
                  </li>
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-hairline pt-5 sm:grid-cols-4">
                  <Link
                    href="/casa-brasa"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ember px-3 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                  >
                    Sitio Marca
                  </Link>
                  <Link
                    href="/casa-brasa/menu"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    Carta & Pedidos
                  </Link>
                  <Link
                    href="/casa-brasa/eventos"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    Salones
                  </Link>
                  <Link
                    href="/dashboard/casa-brasa"
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-obsidian px-3 py-2 text-xs font-semibold text-ivory transition hover:bg-ink"
                  >
                    <LayoutDashboard className="size-3.5 text-gold" />
                    <span>CRM Multi-Sede</span>
                  </Link>
                </div>
              </div>
            </article>

            {/* Scenario 2: Botánica (Single-Location · Sunlit Greenhouse Editorial) */}
            <article
              data-theme="botanica-huerta"
              className="flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated text-ink shadow-md transition hover:shadow-xl"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-canvas-muted">
                <Image
                  src="/demo/botanica-brunch/hero-greenhouse-brunch.jpg"
                  alt="Botánica · Escenario Sede Única"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-obsidian/20 to-transparent" />
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas-elevated/95 px-3 py-1 text-xs font-semibold text-ember shadow-xs">
                    <Leaf className="size-3.5 text-ember" />
                    <span>Escenario Sede Única (1 Casa)</span>
                  </span>
                  <span className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                    Tema: Botánica Luminosa
                  </span>
                </div>
                <div className="absolute right-5 bottom-4 left-5 text-ivory">
                  <h2 className="font-display text-3xl font-semibold">
                    Botánica · Huerta & Invernadero
                  </h2>
                  <p className="mt-0.5 text-sm text-ivory/90">
                    Casona Usaquén · Brunch de masa madre, huerta orgánica y 2 salones internos
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
                <ul className="space-y-2.5 text-sm text-ink-muted">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                    <span>
                      <strong className="font-semibold text-ink">
                        Interfaz purificada para 1 sede:
                      </strong>{" "}
                      elimina selectores redundantes, despliega vitrina arquitectónica horizontal 60/40 y balancea grillas de 2 salones y 2 paquetes al 100%.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                    <span>
                      <strong className="font-semibold text-ink">
                        Atmósfera editorial luminosa:
                      </strong>{" "}
                      paleta salvia ciprés y lino cálido con lectura de alto contraste WCAG AA/AAA y franja de Brunch matutino.
                    </span>
                  </li>
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-hairline pt-5 sm:grid-cols-4">
                  <Link
                    href="/botanica-brunch"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ember px-3 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                  >
                    Sitio Marca
                  </Link>
                  <Link
                    href="/botanica-brunch/menu"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    Carta & Brunch
                  </Link>
                  <Link
                    href="/botanica-brunch/eventos"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    Invernadero
                  </Link>
                  <Link
                    href="/dashboard/botanica-brunch"
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-obsidian px-3 py-2 text-xs font-semibold text-ivory transition hover:bg-ink"
                  >
                    <LayoutDashboard className="size-3.5 text-gold" />
                    <span>Consola</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Commercial Architecture Strip: 2-Axis SaaS & Super-Admin CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian p-6 text-ivory shadow-xl sm:p-9">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-obsidian-card px-3 py-1 text-xs font-semibold text-gold">
                  <Crown className="size-3.5" />
                  <span>Modelo de Negocio B2B · Fenbapps Control Plane</span>
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ivory sm:text-4xl">
                  Gobierna Diseño Único + Membresía SaaS por Sede desde /super-admin
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-ivory-muted sm:text-base">
                  Activa o desactiva módulos en tiempo real (`Basic`, `Standard`, `Full`), calcula el MRR automático por sede adicional y protege tu recurrencia con el{" "}
                  <strong className="font-semibold text-gold">
                    Modo Vitrina Estática
                  </strong>{" "}
                  (respeta la web pagada sin errores 404 en códigos QR, pero congela carrito, domicilios y CRM en PostgreSQL ante impago mensual).
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-ivory-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian-card px-3 py-1.5">
                    <MapPin className="size-3.5 text-ember-glow" />
                    <span>Cobro aditivo por sede activa</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian-card px-3 py-1.5">
                    <Lock className="size-3.5 text-gold" />
                    <span>Bloqueo Zero-Trust en RPCs PostgreSQL</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:col-span-4 lg:items-end">
                <Link
                  href="/super-admin"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-obsidian shadow-md transition hover:opacity-95 sm:w-auto"
                >
                  <Layers className="size-4" />
                  <span>Abrir Super-Admin de Planes</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Pillar Strip */}
        <section className="border-t border-hairline bg-canvas-elevated py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-hairline bg-canvas p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-accent text-ember">
                  <QrCode className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                  QR Real en Mesa & Divisor de Cuenta
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Códigos QR ISO/IEC 18004 escaneables por sede y mesa que abren directo en Modo Mesa con cálculo de propina y división exacta entre comensales.
                </p>
              </div>

              <div className="rounded-2xl border border-hairline bg-canvas p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-accent text-ember">
                  <ShoppingBag className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                  Domicilios & Recogida 0% Comisión
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Canal propio desde casa con logística independiente por ciudad/sede, efectivo con vueltas exactas, datáfono o transferencia con copia en 1 clic.
                </p>
              </div>

              <div className="rounded-2xl border border-hairline bg-canvas p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-surface-accent text-ember">
                  <ShieldCheck className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">
                  CRM Multi-Sede & Aislamiento RLS
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Cada administrador de sede opera sus propios agotados, pedidos y eventos sin mezclar ciudades, con vista consolidada ejecutiva para el dueño.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
