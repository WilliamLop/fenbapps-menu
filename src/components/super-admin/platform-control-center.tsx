"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Crown,
  ExternalLink,
  Layers,
  Lock,
  MapPin,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { superAdminUpdateEntitlementsAction } from "@/modules/admin/actions";
import type { SuperAdminTenantItem } from "@/modules/admin/queries";
import {
  DESIGN_TIERS_META,
  FEATURE_FLAGS_META,
  PLAN_TIERS_META,
  SUBSCRIPTION_STATUS_META,
  computeTenantMrr,
  resolveEffectiveCapabilities,
  type DesignTier,
  type FeatureFlagKey,
  type SaasPlanTier,
  type SubscriptionStatus,
} from "@/lib/saas-entitlements";
import { formatCurrency, sanitizeNumericInput } from "@/lib/utils";

interface PlatformControlCenterProps {
  initialTenants: SuperAdminTenantItem[];
}

interface EditableTenantDraft {
  planTier: SaasPlanTier;
  designTier: DesignTier;
  subscriptionStatus: SubscriptionStatus;
  maxLocations: string;
  setupOneTimeFee: string;
  monthlyBaseFee: string;
  extraLocationFee: string;
  featureOverrides: Partial<Record<FeatureFlagKey, boolean>>;
}

function createInitialDraft(t: SuperAdminTenantItem): EditableTenantDraft {
  return {
    planTier: t.plan_tier,
    designTier: t.design_tier,
    subscriptionStatus: t.subscription_status,
    maxLocations: String(t.max_locations),
    setupOneTimeFee: String(Math.round(Number(t.setup_one_time_fee))),
    monthlyBaseFee: String(Math.round(Number(t.monthly_base_fee))),
    extraLocationFee: String(Math.round(Number(t.extra_location_fee))),
    featureOverrides: { ...(t.feature_overrides ?? {}) },
  };
}

export function PlatformControlCenter({
  initialTenants,
}: PlatformControlCenterProps) {
  const [tenants, setTenants] = useState<SuperAdminTenantItem[]>(initialTenants);
  const [drafts, setDrafts] = useState<Record<string, EditableTenantDraft>>(
    () =>
      Object.fromEntries(
        initialTenants.map((t) => [t.id, createInitialDraft(t)])
      )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function updateDraft(
    tenantId: string,
    updater: (prev: EditableTenantDraft) => EditableTenantDraft
  ) {
    setDrafts((curr) => {
      const existing = curr[tenantId];
      if (!existing) return curr;
      return {
        ...curr,
        [tenantId]: updater(existing),
      };
    });
  }

  function handleSelectPlanPreset(tenant: SuperAdminTenantItem, nextPlan: SaasPlanTier) {
    const meta = PLAN_TIERS_META[nextPlan];
    updateDraft(tenant.id, (prev) => ({
      ...prev,
      planTier: nextPlan,
      monthlyBaseFee: String(meta.referenceMonthlyCop),
      extraLocationFee: String(meta.referenceExtraLocationCop),
      maxLocations:
        nextPlan === "full"
          ? String(Math.max(Number(prev.maxLocations || "1"), tenant.active_locations_count, 3))
          : "1",
    }));
  }

  function handleSelectDesignPreset(tenantId: string, nextDesign: DesignTier) {
    const meta = DESIGN_TIERS_META[nextDesign];
    updateDraft(tenantId, (prev) => ({
      ...prev,
      designTier: nextDesign,
      setupOneTimeFee: String(meta.referenceSetupCop),
    }));
  }

  function cycleFeatureOverride(tenantId: string, key: FeatureFlagKey) {
    updateDraft(tenantId, (prev) => {
      const nextOverrides = { ...prev.featureOverrides };
      const currentVal = nextOverrides[key];
      if (currentVal === undefined) {
        nextOverrides[key] = true;
      } else if (currentVal === true) {
        nextOverrides[key] = false;
      } else {
        delete nextOverrides[key];
      }
      return {
        ...prev,
        featureOverrides: nextOverrides,
      };
    });
  }

  function handleSaveTenant(tenant: SuperAdminTenantItem) {
    const draft = drafts[tenant.id];
    if (!draft) return;

    const maxLocationsNum = Math.max(1, Number(draft.maxLocations || "1"));
    const setupFeeNum = Math.max(0, Number(draft.setupOneTimeFee || "0"));
    const monthlyBaseNum = Math.max(0, Number(draft.monthlyBaseFee || "0"));
    const extraLocNum = Math.max(0, Number(draft.extraLocationFee || "0"));

    setSavingId(tenant.id);
    startTransition(async () => {
      const res = await superAdminUpdateEntitlementsAction({
        restaurantId: tenant.id,
        restaurantSlug: tenant.slug,
        planTier: draft.planTier,
        designTier: draft.designTier,
        subscriptionStatus: draft.subscriptionStatus,
        maxLocations: maxLocationsNum,
        setupOneTimeFee: setupFeeNum,
        monthlyBaseFee: monthlyBaseNum,
        extraLocationFee: extraLocNum,
        featureOverrides: draft.featureOverrides as Record<string, boolean>,
      });

      setSavingId(null);

      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar la configuración.");
        return;
      }

      setTenants((curr) =>
        curr.map((item) =>
          item.id === tenant.id
            ? {
                ...item,
                plan_tier: draft.planTier,
                design_tier: draft.designTier,
                subscription_status: draft.subscriptionStatus,
                max_locations: maxLocationsNum,
                setup_one_time_fee: setupFeeNum,
                monthly_base_fee: monthlyBaseNum,
                extra_location_fee: extraLocNum,
                feature_overrides: draft.featureOverrides,
              }
            : item
        )
      );

      toast.success(
        `Plan y permisos de "${tenant.name}" actualizados en PostgreSQL en tiempo real.`
      );
    });
  }

  // Compute global portfolio metrics from current drafts so founder can simulate live pricing
  const portfolioTotals = tenants.reduce(
    (acc, t) => {
      const d = drafts[t.id] ?? createInitialDraft(t);
      const mrr = computeTenantMrr(
        Number(d.monthlyBaseFee || "0"),
        Number(d.extraLocationFee || "0"),
        t.active_locations_count,
        d.subscriptionStatus
      );
      acc.totalLocations += t.active_locations_count;
      acc.totalSetupFees += Number(d.setupOneTimeFee || "0");
      acc.contractedMrr += mrr.contractedMrr;
      acc.collectibleMrr += mrr.collectibleMrr;
      return acc;
    },
    {
      totalLocations: 0,
      totalSetupFees: 0,
      contractedMrr: 0,
      collectibleMrr: 0,
    }
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Portfolio KPI Summary */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-ink-muted uppercase">
            <span>Marcas & Sedes Activas</span>
            <Building2 className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink">
            {tenants.length}{" "}
            <span className="text-base font-medium text-ink-muted">
              marcas · {portfolioTotals.totalLocations} sedes
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Cobro escalable por sede física activa
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-ink-muted uppercase">
            <span>Setup Diseño (Pago Único)</span>
            <Palette className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink">
            {formatCurrency(portfolioTotals.totalSetupFees, "COP")}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Suma de implementaciones Basic / Standard / Premium
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-ink-muted uppercase">
            <span>MRR Mensual Activo</span>
            <Wallet className="size-4 text-sage" />
          </div>
          <p className="tabular-price mt-2 font-sans text-3xl font-bold text-sage">
            {formatCurrency(portfolioTotals.collectibleMrr, "COP")}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Facturación mensual recurrente cobrable hoy
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-ink-muted uppercase">
            <span>Blindaje RLS & Planes</span>
            <ShieldCheck className="size-4 text-sage" />
          </div>
          <p className="mt-2 font-sans text-xl font-bold text-ink">
            PostgreSQL Enforced
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Modo Vitrina congela CRM y checkout en BD
          </p>
        </div>
      </section>

      {/* Commercial Reference Matrix */}
      <section className="mb-8 rounded-3xl border border-hairline bg-canvas-elevated p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-wider text-ember uppercase">
              Modelo Comercial de 2 Ejes · Fenbapps Hospitality
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
              Diseño Web (Pago Único) + Motor SaaS Mensual por Sede
            </h2>
          </div>
          <span className="rounded-full border border-sage/30 bg-sage/10 px-3.5 py-1 text-xs font-semibold text-sage">
            Sin mensualidad = Modo Vitrina Congelada (0% motor, 0% CRM)
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["basic", "standard", "full"] as SaasPlanTier[]).map((tier) => {
            const meta = PLAN_TIERS_META[tier];
            return (
              <div
                key={tier}
                className={`rounded-2xl border p-4 ${
                  tier === "full"
                    ? "border-ember/40 bg-surface-accent"
                    : "border-hairline bg-canvas"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {meta.label}
                  </span>
                  {tier === "full" && <Crown className="size-4 text-ember" />}
                </div>
                <p className="tabular-price mt-2 font-mono text-lg font-bold text-ember">
                  {formatCurrency(meta.referenceMonthlyCop, "COP")}
                  <span className="font-sans text-xs font-normal text-ink-muted">
                    {" "}
                    / mes (1ra sede) +{" "}
                    {formatCurrency(meta.referenceExtraLocationCop, "COP")}/sede
                    extra
                  </span>
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
                  {meta.includedHighlights.map((hl) => (
                    <li key={hl} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sage" />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tenant Control Cards */}
      <section className="space-y-8">
        {tenants.map((tenant) => {
          const draft = drafts[tenant.id] ?? createInitialDraft(tenant);
          const isSaving = savingId === tenant.id;
          const cities = Array.from(
            new Set(tenant.locations.map((l) => l.city || "Bogotá"))
          );

          const mrr = computeTenantMrr(
            Number(draft.monthlyBaseFee || "0"),
            Number(draft.extraLocationFee || "0"),
            tenant.active_locations_count,
            draft.subscriptionStatus
          );

          const effectiveCaps = resolveEffectiveCapabilities(
            {
              planTier: draft.planTier,
              designTier: draft.designTier,
              subscriptionStatus: draft.subscriptionStatus,
              maxLocations: Math.max(1, Number(draft.maxLocations || "1")),
              setupOneTimeFee: Number(draft.setupOneTimeFee || "0"),
              monthlyBaseFee: Number(draft.monthlyBaseFee || "0"),
              extraLocationFee: Number(draft.extraLocationFee || "0"),
              featureOverrides: draft.featureOverrides,
            },
            { site: true, menu: true, events: true },
            "real"
          );

          const statusMeta = SUBSCRIPTION_STATUS_META[draft.subscriptionStatus];

          return (
            <article
              key={tenant.id}
              className="overflow-hidden rounded-3xl border border-border-strong bg-canvas-elevated shadow-sm"
            >
              {/* Tenant Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-hairline bg-canvas px-6 py-5 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                      {tenant.name}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                        statusMeta.badgeTone === "sage"
                          ? "bg-sage/15 text-sage"
                          : statusMeta.badgeTone === "amber"
                          ? "bg-amber-warn/15 text-amber-warn"
                          : statusMeta.badgeTone === "ember"
                          ? "bg-ember text-ivory"
                          : "bg-canvas-muted text-ink-muted"
                      }`}
                    >
                      {statusMeta.label}
                    </span>
                    <span className="rounded-full border border-hairline bg-canvas-elevated px-2.5 py-0.5 font-mono text-xs text-ink-muted">
                      /{tenant.slug}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      <MapPin className="size-3.5 text-ember" />
                      {tenant.active_locations_count}{" "}
                      {tenant.active_locations_count === 1 ? "sede" : "sedes"} en{" "}
                      {cities.join(" · ")}
                    </span>
                    <span>{tenant.products_count} platos</span>
                    <span>{tenant.direct_orders_count} pedidos registrados</span>
                    <span>
                      {tenant.event_inquiries_count} solicitudes eventos
                    </span>
                  </div>
                </div>

                {/* Live Tenant Links */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${tenant.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    <span>Sitio Web</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                  <Link
                    href={`/${tenant.slug}/menu`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    <span>Carta Digital</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                  <Link
                    href={`/dashboard/${tenant.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember"
                  >
                    <span>Consola CRM</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
                {/* Left 7 Cols: Plan Tier, Design Tier & Subscription Status */}
                <div className="space-y-6 lg:col-span-7">
                  {/* 1. Subscription Status (Commitment Enforcement) */}
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-ink uppercase">
                      1. Estado de Membresía Mensual (Control de Impago)
                    </label>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          "active",
                          "past_due_grace",
                          "vitrine_only",
                          "suspended",
                        ] as SubscriptionStatus[]
                      ).map((st) => {
                        const meta = SUBSCRIPTION_STATUS_META[st];
                        const active = draft.subscriptionStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              updateDraft(tenant.id, (prev) => ({
                                ...prev,
                                subscriptionStatus: st,
                              }))
                            }
                            className={`rounded-2xl border p-3 text-left transition ${
                              active
                                ? "border-ember bg-surface-accent shadow-2xs"
                                : "border-hairline bg-canvas hover:border-border-strong"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-ink">
                                {meta.label}
                              </span>
                              {st === "vitrine_only" && (
                                <Lock className="size-3.5 text-ember" />
                              )}
                            </div>
                            <p className="mt-1 text-[11px] leading-snug text-ink-muted">
                              {meta.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Monthly SaaS Plan Tier */}
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-ink uppercase">
                      2. Plan Mensual de Funcionalidades SaaS
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["basic", "standard", "full"] as SaasPlanTier[]).map(
                        (tier) => {
                          const meta = PLAN_TIERS_META[tier];
                          const active = draft.planTier === tier;
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => handleSelectPlanPreset(tenant, tier)}
                              className={`rounded-2xl border p-3 text-left transition ${
                                active
                                  ? "border-ember bg-surface-accent shadow-2xs"
                                  : "border-hairline bg-canvas hover:border-border-strong"
                              }`}
                            >
                              <p className="text-xs font-bold text-ink">
                                Plan {meta.shortLabel}
                              </p>
                              <p className="tabular-price mt-0.5 font-mono text-xs font-semibold text-ember">
                                {formatCurrency(meta.referenceMonthlyCop, "COP")}
                              </p>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* 3. One-Time Web Design Tier */}
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-ink uppercase">
                      3. Nivel de Diseño & Branding Web (Pago Único)
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["basic", "standard", "premium"] as DesignTier[]).map(
                        (dTier) => {
                          const meta = DESIGN_TIERS_META[dTier];
                          const active = draft.designTier === dTier;
                          return (
                            <button
                              key={dTier}
                              type="button"
                              onClick={() =>
                                handleSelectDesignPreset(tenant.id, dTier)
                              }
                              className={`rounded-2xl border p-3 text-left transition ${
                                active
                                  ? "border-ember bg-surface-accent shadow-2xs"
                                  : "border-hairline bg-canvas hover:border-border-strong"
                              }`}
                            >
                              <p className="text-xs font-bold text-ink">
                                {meta.shortLabel}
                              </p>
                              <p className="tabular-price mt-0.5 font-mono text-xs font-semibold text-ink-muted">
                                {formatCurrency(meta.referenceSetupCop, "COP")}
                              </p>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* 4. Pricing & Multi-Location Billing Inputs */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted">
                        Setup Único (COP)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.setupOneTimeFee}
                        onChange={(e) =>
                          updateDraft(tenant.id, (prev) => ({
                            ...prev,
                            setupOneTimeFee: sanitizeNumericInput(
                              e.target.value
                            ),
                          }))
                        }
                        className="tabular-price mt-1 h-10 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-sm font-semibold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted">
                        Base Mensual (1ra Sede)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.monthlyBaseFee}
                        onChange={(e) =>
                          updateDraft(tenant.id, (prev) => ({
                            ...prev,
                            monthlyBaseFee: sanitizeNumericInput(
                              e.target.value
                            ),
                          }))
                        }
                        className="tabular-price mt-1 h-10 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-sm font-semibold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted">
                        Sede Extra / Mes
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.extraLocationFee}
                        onChange={(e) =>
                          updateDraft(tenant.id, (prev) => ({
                            ...prev,
                            extraLocationFee: sanitizeNumericInput(
                              e.target.value
                            ),
                          }))
                        }
                        className="tabular-price mt-1 h-10 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-sm font-semibold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted">
                        Cupo Máx. Sedes
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.maxLocations}
                        onChange={(e) =>
                          updateDraft(tenant.id, (prev) => ({
                            ...prev,
                            maxLocations: sanitizeNumericInput(e.target.value),
                          }))
                        }
                        className="tabular-price mt-1 h-10 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-sm font-semibold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right 5 Cols: Granular Feature Flags & Live Billing Breakdown */}
                <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-canvas p-5 lg:col-span-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-ink uppercase">
                        <SlidersHorizontal className="size-3.5 text-ember" />
                        <span>Interruptores por Funcionalidad</span>
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        Clic para alternar override
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {FEATURE_FLAGS_META.map((feat) => {
                        const overrideVal = draft.featureOverrides[feat.key];
                        const isCurrentlyActive =
                          feat.key === "table_shortlist"
                            ? effectiveCaps.tableShortlistEnabled
                            : feat.key === "catalog_mutations"
                            ? effectiveCaps.catalogMutationsEnabled
                            : feat.key === "direct_orders"
                            ? effectiveCaps.directOrdersEnabled
                            : feat.key === "promotions"
                            ? effectiveCaps.promotionsEnabled
                            : feat.key === "events_crm"
                            ? effectiveCaps.eventsEnabled
                            : effectiveCaps.multiLocationEnabled;

                        return (
                          <button
                            key={feat.key}
                            type="button"
                            onClick={() =>
                              cycleFeatureOverride(tenant.id, feat.key)
                            }
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas-elevated px-3 py-2.5 text-left transition hover:border-border-strong"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-ink">
                                {feat.label}
                              </p>
                              <p className="text-[11px] text-ink-muted">
                                Base: {feat.defaultMinPlan}
                                {overrideVal !== undefined && (
                                  <span className="ml-1.5 font-semibold text-ember">
                                    · Override manual
                                  </span>
                                )}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                isCurrentlyActive
                                  ? "bg-sage/15 text-sage"
                                  : "bg-canvas-muted text-ink-muted"
                              }`}
                            >
                              {isCurrentlyActive ? "ACTIVO" : "APAGADO"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Per-Location MRR Summary & Save Action */}
                  <div className="mt-5 border-t border-hairline pt-4">
                    <div className="rounded-2xl border border-ember/25 bg-surface-accent p-3.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">
                          Liquidación Mensual ({tenant.active_locations_count}{" "}
                          {tenant.active_locations_count === 1
                            ? "sede"
                            : "sedes"}
                          ):
                        </span>
                        <span className="tabular-price font-mono text-base font-bold text-ember">
                          {formatCurrency(mrr.collectibleMrr, "COP")}/mes
                        </span>
                      </div>
                      {mrr.extraLocationsCount > 0 && (
                        <p className="mt-1 text-[11px] text-ink-muted">
                          1ra sede:{" "}
                          {formatCurrency(mrr.baseFee, "COP")} +{" "}
                          {mrr.extraLocationsCount} sede(s) extra:{" "}
                          {formatCurrency(mrr.extraLocationsTotal, "COP")}
                        </p>
                      )}
                      {draft.subscriptionStatus === "vitrine_only" && (
                        <p className="mt-1 text-[11px] font-semibold text-ember">
                          En Modo Vitrina: motor SaaS y CRM bloqueados hasta
                          recibir pago de{" "}
                          {formatCurrency(mrr.contractedMrr, "COP")}.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveTenant(tenant)}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ivory shadow-xs transition hover:bg-ember-deep disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Sparkles className="size-4 animate-spin" />
                          <span>Aplicando en PostgreSQL...</span>
                        </>
                      ) : (
                        <>
                          <Save className="size-4" />
                          <span>Guardar Plan & Funcionalidades en Vivo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
