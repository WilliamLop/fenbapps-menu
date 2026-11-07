import Link from "next/link";
import { UtensilsCrossed, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-16 text-center text-ink">
      <div className="max-w-md rounded-3xl border border-hairline bg-canvas-elevated p-8 shadow-lg sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-accent text-ember">
          <UtensilsCrossed className="size-7" />
        </div>

        <span className="mt-4 inline-block font-mono text-xs font-semibold uppercase tracking-widest text-ember">
          Error 404 · Establecimiento No Encontrado
        </span>

        <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Mesa Fuera de Servicio
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          La carta o el restaurante al que intentas acceder no está registrado en
          nuestra plataforma o la dirección fue modificada.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-hairline pt-5">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ember px-5 py-2 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
          >
            <ArrowLeft className="size-3.5" />
            <span>Volver a la portada</span>
          </Link>
          <Link
            href="/super-admin"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-canvas px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
          >
            <span>Super-Admin SaaS</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
