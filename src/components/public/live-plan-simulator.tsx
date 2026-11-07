"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronUp,
  Crown,
  Eye,
  Layers,
  Lock,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { setSimPlanCookieAction } from "@/modules/admin/actions";
import type {
  DesignTier,
  SaasPlanTier,
  SimPlanPreset,
  SubscriptionStatus,
} from "@/lib/saas-entitlements";

interface LivePlanSimulatorProps {
  restaurantSlug: string;
  restaurantName: string;
  isDemo: boolean;
  activeSimPreset: SimPlanPreset;
  realPlanTier: SaasPlanTier;
  realDesignTier: DesignTier;
  realSubscriptionStatus: SubscriptionStatus;
}

const SIM_OPTIONS: {
  id: SimPlanPreset;
  title: string;
  badge: string;
  summary: string;
  includesEvents: boolean;
}[] = [
  {
    id: "real",
    title: "Configuración Real (BD)",
    badge: "PostgreSQL",
    summary: "Usa exactamente el plan y estado guardados en /super-admin.",
    includesEvents: true,
  },
  {
    id: "full",
    title: "Simular Plan Full",
    badge: "$389k/mes ref.",
    summary: "Carta + Mesa QR + Domicilios 0% + Eventos CRM + Multi-Sede.",
    includesEvents: true,
  },
  {
    id: "standard",
    title: "Simular Plan Standard",
    badge: "$249k/mes ref.",
    summary: "Carta + Mesa QR + Domicilios/Recoger 0% Comisión (sin Eventos).",
    includesEvents: false,
  },
  {
    id: "basic",
    title: "Simular Plan Basic",
    badge: "$149k/mes ref.",
    summary: "Carta Digital + Modo Mesa QR y agotados (sin Domicilios ni Eventos).",
    includesEvents: false,
  },
  {
    id: "vitrine_only",
    title: "Simular Impago (Modo Vitrina)",
    badge: "$0 mensualidad",
    summary:
      "Conserva diseño web y lectura de carta, pero congela carrito, pedidos y CRM.",
    includesEvents: false,
  },
];

export function LivePlanSimulator({
  restaurantSlug,
  restaurantName,
  isDemo,
  activeSimPreset,
  realPlanTier,
  realDesignTier,
  realSubscriptionStatus,
}: LivePlanSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isDemo) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key.toLowerCase() === "p") {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDemo]);

  if (!isDemo) {
    return null;
  }

  const activeLabel =
    activeSimPreset === "real"
      ? realSubscriptionStatus === "vitrine_only"
        ? "BD: Solo Vitrina"
        : `BD: Plan ${realPlanTier.toUpperCase()}`
      : activeSimPreset === "vitrine_only"
      ? "Sim: Solo Vitrina"
      : `Sim: Plan ${activeSimPreset.toUpperCase()}`;

  function handleSelectPreset(nextPreset: SimPlanPreset) {
    const opt = SIM_OPTIONS.find((o) => o.id === nextPreset);
    const willHaveEvents =
      nextPreset === "real"
        ? realSubscriptionStatus !== "vitrine_only" &&
          realSubscriptionStatus !== "suspended" &&
          realPlanTier === "full"
        : Boolean(opt?.includesEvents);

    startTransition(async () => {
      const res = await setSimPlanCookieAction(nextPreset, restaurantSlug);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cambiar el plan simulado.");
        return;
      }

      setIsOpen(false);

      if (pathname?.endsWith("/eventos") && !willHaveEvents) {
        toast.info(
          "Este nivel no incluye el módulo de Eventos: mostrando Carta Digital en vivo."
        );
        router.push(`/${restaurantSlug}/menu`);
        router.refresh();
        return;
      }

      toast.success(
        nextPreset === "real"
          ? "Mostrando configuración real de PostgreSQL"
          : `Vista comercial actualizada: ${opt?.title ?? nextPreset}`
      );
      router.refresh();
    });
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {isOpen ? (
        <div
          role="dialog"
          aria-label="Simulador comercial de planes SaaS"
          className="w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-border-strong bg-canvas-elevated text-ink shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-hairline bg-obsidian px-4 py-3.5 text-ivory">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-gold" />
              <div>
                <p className="text-xs font-bold tracking-wide uppercase">
                  Simulador Comercial en Vivo
                </p>
                <p className="text-[11px] text-stone">
                  {restaurantName} · Diseño {realDesignTier.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar simulador"
              className="rounded-full p-1 text-stone transition hover:bg-obsidian-soft hover:text-ivory"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3.5">
            <p className="px-1 text-xs leading-relaxed text-ink-muted">
              Cambia en 1 clic cómo se comporta el restaurante según su membresía
              mensual (solo en tu navegador, sin afectar otros visitantes):
            </p>

            {SIM_OPTIONS.map((opt) => {
              const selected = activeSimPreset === opt.id;
              const isVitrine = opt.id === "vitrine_only";
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSelectPreset(opt.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selected
                      ? "border-ember bg-surface-accent shadow-2xs"
                      : "border-hairline bg-canvas hover:border-border-strong"
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                      {isVitrine ? (
                        <Lock className="size-3.5 text-ember" />
                      ) : opt.id === "full" ? (
                        <Crown className="size-3.5 text-ember" />
                      ) : (
                        <Sparkles className="size-3.5 text-ember" />
                      )}
                      <span>{opt.title}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                        selected
                          ? "bg-ember text-ivory"
                          : "border border-hairline bg-canvas-elevated text-ink-muted"
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-ink-muted">
                    {opt.summary}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-hairline bg-canvas px-4 py-3 text-xs">
            <span className="text-[11px] text-ink-muted">
              Atajo rápido: <kbd className="font-mono font-semibold">Shift+P</kbd>
            </span>
            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
            >
              <Layers className="size-3.5" />
              <span>Abrir /super-admin</span>
            </Link>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition ${
            activeSimPreset === "vitrine_only" ||
            (activeSimPreset === "real" &&
              realSubscriptionStatus === "vitrine_only")
              ? "border-ember bg-ember text-ivory"
              : activeSimPreset !== "real"
              ? "border-gold/50 bg-obsidian text-gold"
              : "border-obsidian-border bg-obsidian/92 text-ivory hover:border-gold/50"
          }`}
        >
          {activeSimPreset === "vitrine_only" ? (
            <ShieldAlert className="size-3.5" />
          ) : (
            <Eye className="size-3.5 text-gold" />
          )}
          <span>{activeLabel}</span>
          <ChevronUp className="size-3.5 opacity-80" />
        </button>
      )}
    </div>
  );
}
