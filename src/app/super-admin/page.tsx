import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers, ShieldCheck } from "lucide-react";
import { getSuperAdminPortfolio } from "@/modules/admin/queries";
import { PlatformControlCenter } from "@/components/super-admin/platform-control-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Super-Admin Control Plane · Fenbapps Hospitality SaaS",
  description:
    "Consola maestra de planes comerciales (Basic, Standard, Full), niveles de diseño único, Modo Vitrina por impago y licenciamiento multi-sede.",
};

export default async function SuperAdminPage() {
  const portfolio = await getSuperAdminPortfolio();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-obsidian text-ivory">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-gold/30 bg-obsidian-soft text-gold">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold sm:text-2xl">
                  Fenbapps Control Plane · Super-Admin
                </h1>
                <span className="hidden items-center gap-1 rounded-full border border-sage/40 bg-sage/20 px-2.5 py-0.5 text-[11px] font-semibold text-ivory sm:inline-flex">
                  <ShieldCheck className="size-3.5" />
                  <span>PostgreSQL Entitlements</span>
                </span>
              </div>
              <p className="text-xs text-stone">
                Gobierno comercial en tiempo real: Diseño Pago Único + Membresía
                Mensual por Sede + Interruptores de Módulos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian-soft px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:border-gold/50 hover:text-gold"
            >
              <ArrowLeft className="size-3.5" />
              <span>Volver al Showcase SaaS</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <PlatformControlCenter initialTenants={portfolio.tenants} />
      </main>
    </div>
  );
}
