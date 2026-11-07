export type SaasPlanTier = "basic" | "standard" | "full";
export type DesignTier = "basic" | "standard" | "premium";
export type SubscriptionStatus =
  | "active"
  | "past_due_grace"
  | "vitrine_only"
  | "suspended";

export type SimPlanPreset =
  | "real"
  | "full"
  | "standard"
  | "basic"
  | "vitrine_only";

export type FeatureFlagKey =
  | "table_shortlist"
  | "direct_orders"
  | "promotions"
  | "events_crm"
  | "multi_location"
  | "catalog_mutations";

export interface RestaurantEntitlementsConfig {
  planTier: SaasPlanTier;
  designTier: DesignTier;
  subscriptionStatus: SubscriptionStatus;
  maxLocations: number;
  setupOneTimeFee: number;
  monthlyBaseFee: number;
  extraLocationFee: number;
  featureOverrides: Partial<Record<FeatureFlagKey, boolean>>;
}

export interface EffectiveCapabilities {
  planTier: SaasPlanTier;
  designTier: DesignTier;
  subscriptionStatus: SubscriptionStatus;
  isSimulated: boolean;
  simPreset: SimPlanPreset;
  isVitrineOnly: boolean;
  isSuspended: boolean;
  siteEnabled: boolean;
  menuVitrineEnabled: boolean;
  tableShortlistEnabled: boolean;
  catalogMutationsEnabled: boolean;
  directOrdersEnabled: boolean;
  promotionsEnabled: boolean;
  eventsEnabled: boolean;
  multiLocationEnabled: boolean;
}

export interface DeliveryParameters {
  enabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  estimatedDeliveryMinutes: string;
  estimatedPickupMinutes: string;
  transferInstructions: string;
}

export interface ProductLocationRecord {
  location_id: string;
  is_offered: boolean;
  availability_status: string;
  price_override: number | null;
}

export const SIM_PLAN_COOKIE_NAME = "fenbapps_sim_plan";

export const PLAN_TIERS_META: Record<
  SaasPlanTier,
  {
    label: string;
    shortLabel: string;
    referenceMonthlyCop: number;
    referenceExtraLocationCop: number;
    summary: string;
    includedHighlights: string[];
  }
> = {
  basic: {
    label: "Plan Basic · Carta Viva & Mesa QR",
    shortLabel: "Basic",
    referenceMonthlyCop: 149000,
    referenceExtraLocationCop: 89000,
    summary:
      "Carta digital editorial con buscador, Modo Mesa QR (división de cuenta y propina) y control de agotados/precios en vivo.",
    includedHighlights: [
      "Carta Digital con buscador y filtros dietarios",
      "Modo Mesa QR: pre-selección y división de cuenta (1–30 pax)",
      "Consola Operativa: agotar platos en 1 clic y cambio de precios",
      "Generador de códigos QR de mesa ISO/IEC 18004",
    ],
  },
  standard: {
    label: "Plan Standard · Domicilios 0% Comisión & Promos",
    shortLabel: "Standard",
    referenceMonthlyCop: 249000,
    referenceExtraLocationCop: 129000,
    summary:
      "Suma el motor propio de Pedidos a Domicilio y Para Recoger sin comisiones, bandeja de despacho en vivo y promociones.",
    includedHighlights: [
      "Todo lo incluido en Plan Basic",
      "Checkout Directo a Domicilio & Para Recoger (0% comisión)",
      "Efectivo con cálculo de vueltas, Datáfono y Transferencia/Bre-B",
      "Bandeja operativa de Pedidos & Domicilios en tiempo real",
      "Motor de Promociones & Combos",
    ],
  },
  full: {
    label: "Plan Full · Hospitality Suite & Multi-Sede",
    shortLabel: "Full",
    referenceMonthlyCop: 389000,
    referenceExtraLocationCop: 169000,
    summary:
      "Ecosistema integral con Dossier de Salones Privados, Cotizador de Eventos, Mini-CRM Comercial y aislamiento Multi-Ciudad/Sede.",
    includedHighlights: [
      "Todo lo incluido en Plan Standard",
      "Dossier de Salones Privados, Paquetes y Cotizador Interactivo",
      "Mini-CRM de Eventos con estados comerciales y notas internas",
      "Operación Multi-Ciudad y Multi-Sede aislada sin mezcla en CRM",
      "Bitácora forense de auditoría (audit_logs por sede)",
    ],
  },
};

export const DESIGN_TIERS_META: Record<
  DesignTier,
  {
    label: string;
    shortLabel: string;
    referenceSetupCop: number;
    description: string;
  }
> = {
  basic: {
    label: "Diseño Basic (Pago Único)",
    shortLabel: "Diseño Basic",
    referenceSetupCop: 1200000,
    description:
      "Adaptación cromática a la marca, tipografía curada, estructura editorial limpia y carga inicial de carta.",
  },
  standard: {
    label: "Diseño Standard (Pago Único)",
    shortLabel: "Diseño Standard",
    referenceSetupCop: 1950000,
    description:
      "Dirección de arte personalizada, hero editorial a medida, curaduría visual de salones y optimización fotográfica.",
  },
  premium: {
    label: "Diseño Premium Bespoke (Pago Único)",
    shortLabel: "Diseño Premium",
    referenceSetupCop: 3200000,
    description:
      "Arquitectura visual de autor para grupos gastronómicos multi-sede/ciudad, storytelling exclusivo y curaduría integral.",
  },
};

export const SUBSCRIPTION_STATUS_META: Record<
  SubscriptionStatus,
  {
    label: string;
    shortLabel: string;
    badgeTone: "sage" | "amber" | "ember" | "muted";
    description: string;
  }
> = {
  active: {
    label: "Activa · Al Día",
    shortLabel: "Activa",
    badgeTone: "sage",
    description: "Membresía mensual activa con todos los módulos contratados operativos.",
  },
  past_due_grace: {
    label: "En Periodo de Gracia (Mora Reciente)",
    shortLabel: "En Gracia",
    badgeTone: "amber",
    description:
      "Mantiene operación activa temporalmente mientras muestra recordatorio de pago en el CRM.",
  },
  vitrine_only: {
    label: "Modo Vitrina Estática (Sin Mensualidad)",
    shortLabel: "Solo Vitrina",
    badgeTone: "ember",
    description:
      "Conserva el diseño web y lectura de carta congelada (QRs sin error 404), pero bloquea carrito, domicilios, eventos y edición en CRM.",
  },
  suspended: {
    label: "Suspendida Totalmente",
    shortLabel: "Suspendida",
    badgeTone: "muted",
    description:
      "Pausa completa del sitio y de la consola operativa mostrando aviso neutro de mantenimiento.",
  },
};

export const FEATURE_FLAGS_META: {
  key: FeatureFlagKey;
  label: string;
  defaultMinPlan: string;
  description: string;
}[] = [
  {
    key: "table_shortlist",
    label: "Modo Mesa QR & División de Cuenta",
    defaultMinPlan: "Basic+",
    description: "Permite armar selección en mesa, calcular propina y dividir entre comensales.",
  },
  {
    key: "catalog_mutations",
    label: "Edición de Precios & Agotados en Vivo",
    defaultMinPlan: "Basic+",
    description: "Habilita cambios de disponibilidad y precios desde la Consola Operativa.",
  },
  {
    key: "direct_orders",
    label: "Domicilios & Recoger (0% Comisión)",
    defaultMinPlan: "Standard+",
    description: "Checkout directo con cálculo de envío, vueltas en efectivo, datáfono y Bre-B.",
  },
  {
    key: "promotions",
    label: "Motor de Promociones & Combos",
    defaultMinPlan: "Standard+",
    description: "Precios antes/ahora, combos armables y campañas promocionales.",
  },
  {
    key: "events_crm",
    label: "Salones Privados, Paquetes & CRM Eventos",
    defaultMinPlan: "Full",
    description: "Dossier comercial de eventos, calculadora referencial y bandeja Mini-CRM.",
  },
  {
    key: "multi_location",
    label: "Operación Multi-Ciudad / Multi-Sede",
    defaultMinPlan: "Full",
    description: "Selector Ciudad → Sede, precios/agotados independientes por sede y bandejas aisladas.",
  },
];

export function parseSimPlanPreset(raw?: string | null): SimPlanPreset {
  if (
    raw === "full" ||
    raw === "standard" ||
    raw === "basic" ||
    raw === "vitrine_only"
  ) {
    return raw;
  }
  return "real";
}

export function resolveEffectiveCapabilities(
  entitlements: RestaurantEntitlementsConfig,
  rawEnabledModules: { site: boolean; menu: boolean; events: boolean },
  simPreset: SimPlanPreset = "real"
): EffectiveCapabilities {
  const isSimulated = simPreset !== "real";

  const effectivePlan: SaasPlanTier =
    simPreset === "basic" || simPreset === "standard" || simPreset === "full"
      ? simPreset
      : entitlements.planTier;

  const effectiveStatus: SubscriptionStatus =
    simPreset === "vitrine_only"
      ? "vitrine_only"
      : isSimulated
      ? "active"
      : entitlements.subscriptionStatus;

  const isSuspended = effectiveStatus === "suspended";
  const isVitrineOnly = effectiveStatus === "vitrine_only";

  // When simulating a clean plan preset in a sales call, evaluate pure tier defaults;
  // when running in "real" mode, honor explicit Super-Admin feature_overrides.
  const evalFeature = (key: FeatureFlagKey, tierDefault: boolean): boolean => {
    if (isSuspended || isVitrineOnly) return false;
    if (!isSimulated && typeof entitlements.featureOverrides[key] === "boolean") {
      return Boolean(entitlements.featureOverrides[key]);
    }
    return tierDefault;
  };

  const siteEnabled = !isSuspended && rawEnabledModules.site !== false;
  const menuVitrineEnabled = !isSuspended && rawEnabledModules.menu !== false;

  const tableShortlistEnabled =
    menuVitrineEnabled &&
    evalFeature(
      "table_shortlist",
      effectivePlan === "basic" ||
        effectivePlan === "standard" ||
        effectivePlan === "full"
    );

  const catalogMutationsEnabled = evalFeature(
    "catalog_mutations",
    effectivePlan === "basic" ||
      effectivePlan === "standard" ||
      effectivePlan === "full"
  );

  const directOrdersEnabled =
    menuVitrineEnabled &&
    evalFeature(
      "direct_orders",
      effectivePlan === "standard" || effectivePlan === "full"
    );

  const promotionsEnabled =
    menuVitrineEnabled &&
    evalFeature(
      "promotions",
      effectivePlan === "standard" || effectivePlan === "full"
    );

  const eventsEnabled =
    !isSuspended &&
    rawEnabledModules.events !== false &&
    evalFeature("events_crm", effectivePlan === "full");

  const multiLocationEnabled = evalFeature(
    "multi_location",
    effectivePlan === "full"
  );

  return {
    planTier: effectivePlan,
    designTier: entitlements.designTier,
    subscriptionStatus: effectiveStatus,
    isSimulated,
    simPreset,
    isVitrineOnly,
    isSuspended,
    siteEnabled,
    menuVitrineEnabled,
    tableShortlistEnabled,
    catalogMutationsEnabled,
    directOrdersEnabled,
    promotionsEnabled,
    eventsEnabled,
    multiLocationEnabled,
  };
}

export function computeTenantMrr(
  monthlyBaseFee: number,
  extraLocationFee: number,
  activeLocationsCount: number,
  subscriptionStatus: SubscriptionStatus = "active"
): {
  baseFee: number;
  extraLocationsCount: number;
  extraLocationsTotal: number;
  contractedMrr: number;
  collectibleMrr: number;
} {
  const safeLocs = Math.max(1, activeLocationsCount);
  const extraLocationsCount = Math.max(0, safeLocs - 1);
  const extraLocationsTotal = extraLocationsCount * Math.max(0, extraLocationFee);
  const contractedMrr = Math.max(0, monthlyBaseFee) + extraLocationsTotal;
  const collectibleMrr =
    subscriptionStatus === "active" || subscriptionStatus === "past_due_grace"
      ? contractedMrr
      : 0;

  return {
    baseFee: Math.max(0, monthlyBaseFee),
    extraLocationsCount,
    extraLocationsTotal,
    contractedMrr,
    collectibleMrr,
  };
}

export function resolveLocationDeliveryConfig(
  rawLocDelivery: unknown,
  fallbackDelivery: DeliveryParameters,
  directOrdersEnabled: boolean
): DeliveryParameters {
  if (!directOrdersEnabled) {
    return {
      ...fallbackDelivery,
      enabled: false,
      pickupEnabled: false,
    };
  }

  const raw =
    typeof rawLocDelivery === "object" &&
    rawLocDelivery !== null &&
    !Array.isArray(rawLocDelivery)
      ? (rawLocDelivery as Record<string, unknown>)
      : null;

  if (!raw) {
    return fallbackDelivery;
  }

  return {
    enabled:
      typeof raw.enabled === "boolean" ? raw.enabled : fallbackDelivery.enabled,
    pickupEnabled:
      typeof raw.pickupEnabled === "boolean"
        ? raw.pickupEnabled
        : fallbackDelivery.pickupEnabled,
    deliveryFee:
      typeof raw.deliveryFee === "number"
        ? raw.deliveryFee
        : fallbackDelivery.deliveryFee,
    freeDeliveryThreshold:
      typeof raw.freeDeliveryThreshold === "number"
        ? raw.freeDeliveryThreshold
        : fallbackDelivery.freeDeliveryThreshold,
    minOrderAmount:
      typeof raw.minOrderAmount === "number"
        ? raw.minOrderAmount
        : fallbackDelivery.minOrderAmount,
    estimatedDeliveryMinutes:
      typeof raw.estimatedDeliveryMinutes === "string"
        ? raw.estimatedDeliveryMinutes
        : fallbackDelivery.estimatedDeliveryMinutes,
    estimatedPickupMinutes:
      typeof raw.estimatedPickupMinutes === "string"
        ? raw.estimatedPickupMinutes
        : fallbackDelivery.estimatedPickupMinutes,
    transferInstructions:
      typeof raw.transferInstructions === "string"
        ? raw.transferInstructions
        : fallbackDelivery.transferInstructions,
  };
}

export function resolveProductForLocation(
  product: {
    base_price: number;
    availability_status: string;
    exclusive_location_id: string | null;
    productLocations?: ProductLocationRecord[];
  },
  selectedLocationId: string | "all"
): {
  isOffered: boolean;
  availabilityStatus: "available" | "sold_out" | "hidden";
  effectivePrice: number;
  hasPriceOverride: boolean;
} {
  const basePrice = Number(product.base_price);

  if (!selectedLocationId || selectedLocationId === "all") {
    return {
      isOffered: true,
      availabilityStatus:
        product.availability_status === "sold_out"
          ? "sold_out"
          : product.availability_status === "hidden"
          ? "hidden"
          : "available",
      effectivePrice: basePrice,
      hasPriceOverride: false,
    };
  }

  if (
    product.exclusive_location_id &&
    product.exclusive_location_id !== selectedLocationId
  ) {
    return {
      isOffered: false,
      availabilityStatus: "hidden",
      effectivePrice: basePrice,
      hasPriceOverride: false,
    };
  }

  const override = product.productLocations?.find(
    (pl) => pl.location_id === selectedLocationId
  );

  if (!override) {
    return {
      isOffered: true,
      availabilityStatus:
        product.availability_status === "sold_out"
          ? "sold_out"
          : product.availability_status === "hidden"
          ? "hidden"
          : "available",
      effectivePrice: basePrice,
      hasPriceOverride: false,
    };
  }

  if (!override.is_offered || override.availability_status === "hidden") {
    return {
      isOffered: false,
      availabilityStatus: "hidden",
      effectivePrice:
        override.price_override != null
          ? Number(override.price_override)
          : basePrice,
      hasPriceOverride: override.price_override != null,
    };
  }

  const effectiveStatus =
    product.availability_status === "sold_out" ||
    override.availability_status === "sold_out"
      ? "sold_out"
      : "available";

  return {
    isOffered: true,
    availabilityStatus: effectiveStatus,
    effectivePrice:
      override.price_override != null
        ? Number(override.price_override)
        : basePrice,
    hasPriceOverride:
      override.price_override != null &&
      Number(override.price_override) !== basePrice,
  };
}
