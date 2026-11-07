import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  parseSimPlanPreset,
  resolveEffectiveCapabilities,
  SIM_PLAN_COOKIE_NAME,
  type DesignTier,
  type EffectiveCapabilities,
  type FeatureFlagKey,
  type ProductLocationRecord,
  type RestaurantEntitlementsConfig,
  type SaasPlanTier,
  type SimPlanPreset,
  type SubscriptionStatus,
} from "@/lib/saas-entitlements";
import type { Database } from "@/types/database.types";

export type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];
export type LocationRow = Database["public"]["Tables"]["locations"]["Row"];
export type MenuRow = Database["public"]["Tables"]["menus"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductLocationRow =
  Database["public"]["Tables"]["product_locations"]["Row"];
export type ProductOptionGroupRow =
  Database["public"]["Tables"]["product_option_groups"]["Row"];
export type ProductOptionRow =
  Database["public"]["Tables"]["product_options"]["Row"];
export type EventSpaceRow = Database["public"]["Tables"]["event_spaces"]["Row"];
export type EventPackageRow =
  Database["public"]["Tables"]["event_packages"]["Row"];

export interface ProductOptionGroupWithItems extends ProductOptionGroupRow {
  options: ProductOptionRow[];
}

export interface ProductWithDetails extends ProductRow {
  optionGroups: ProductOptionGroupWithItems[];
  productLocations: ProductLocationRecord[];
}

export interface CategoryWithProducts extends CategoryRow {
  products: ProductWithDetails[];
}

export interface OpeningHourSlot {
  days: string;
  hours: string;
}

export interface PackageExtraItem {
  name: string;
  price: string;
}

export type TenantPalettePreset =
  | "brasa-roble"
  | "botanica-huerta"
  | "mar-pacifico"
  | "cava-borgona";

export type TenantBrandIcon = "flame" | "leaf" | "waves" | "wine" | "utensils";

export type TenantHeroStyle = "immersive-dark" | "sunlit-editorial";

export interface RestaurantThemeConfig {
  palette: TenantPalettePreset;
  brandIcon: TenantBrandIcon;
  heroStyle: TenantHeroStyle;
  searchPlaceholder: string;
  signatureBadgeLabel: string;
  archetype?: string;
  heroImage?: string;
  authenticityBadge?: string;
  serviceChargeNote?: string;
}

export interface RestaurantContactConfig {
  whatsappPrimary?: string;
  instagramHandle?: string;
  eventsEmail?: string;
  privacyPolicyText?: string;
}

export interface EnabledModulesConfig {
  menu: boolean;
  events: boolean;
  site: boolean;
}

export interface RestaurantDeliveryConfig {
  enabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  estimatedDeliveryMinutes: string;
  estimatedPickupMinutes: string;
  transferInstructions: string;
}

export interface RestaurantAggregateData {
  restaurant: RestaurantRow;
  theme: RestaurantThemeConfig;
  contact: RestaurantContactConfig;
  entitlements: RestaurantEntitlementsConfig;
  enabledModules: EnabledModulesConfig;
  delivery: RestaurantDeliveryConfig;
  allLocations: LocationRow[];
  locations: LocationRow[];
  cities: string[];
  menus: MenuRow[];
  categories: CategoryWithProducts[];
  featuredProducts: ProductWithDetails[];
  eventSpaces: EventSpaceRow[];
  eventPackages: EventPackageRow[];
}

const VALID_PALETTES = new Set<TenantPalettePreset>([
  "brasa-roble",
  "botanica-huerta",
  "mar-pacifico",
  "cava-borgona",
]);

const VALID_ICONS = new Set<TenantBrandIcon>([
  "flame",
  "leaf",
  "waves",
  "wine",
  "utensils",
]);

export function resolveTenantTheme(
  slug: string,
  cuisineType: string | null,
  rawTheme: Record<string, unknown>
): RestaurantThemeConfig {
  const archetype =
    typeof rawTheme.archetype === "string" ? rawTheme.archetype : undefined;
  const combinedHint = `${slug} ${cuisineType ?? ""} ${archetype ?? ""}`.toLowerCase();

  const isBotanical =
    combinedHint.includes("botanica") ||
    combinedHint.includes("huerta") ||
    combinedHint.includes("brunch") ||
    combinedHint.includes("invernadero");

  const isCoastal =
    combinedHint.includes("mar") ||
    combinedHint.includes("pacifico") ||
    combinedHint.includes("ceviche") ||
    combinedHint.includes("nikkei");

  const isWine =
    combinedHint.includes("borgona") ||
    combinedHint.includes("bistro") ||
    combinedHint.includes("trattoria");

  const rawPalette =
    typeof rawTheme.palette === "string"
      ? (rawTheme.palette as TenantPalettePreset)
      : typeof rawTheme.theme_palette === "string"
      ? (rawTheme.theme_palette as TenantPalettePreset)
      : undefined;

  const palette: TenantPalettePreset =
    rawPalette && VALID_PALETTES.has(rawPalette)
      ? rawPalette
      : isBotanical
      ? "botanica-huerta"
      : isCoastal
      ? "mar-pacifico"
      : isWine
      ? "cava-borgona"
      : "brasa-roble";

  const rawIcon =
    typeof rawTheme.brandIcon === "string"
      ? (rawTheme.brandIcon as TenantBrandIcon)
      : typeof rawTheme.brand_icon === "string"
      ? (rawTheme.brand_icon as TenantBrandIcon)
      : undefined;

  const brandIcon: TenantBrandIcon =
    rawIcon && VALID_ICONS.has(rawIcon)
      ? rawIcon
      : palette === "botanica-huerta"
      ? "leaf"
      : palette === "mar-pacifico"
      ? "waves"
      : palette === "cava-borgona"
      ? "wine"
      : "flame";

  const rawHeroStyle =
    typeof rawTheme.heroStyle === "string"
      ? rawTheme.heroStyle
      : typeof rawTheme.hero_style === "string"
      ? rawTheme.hero_style
      : undefined;

  const heroStyle: TenantHeroStyle =
    rawHeroStyle === "sunlit-editorial" || rawHeroStyle === "immersive-dark"
      ? rawHeroStyle
      : palette === "botanica-huerta" || palette === "mar-pacifico"
      ? "sunlit-editorial"
      : "immersive-dark";

  const defaultSearchPlaceholder =
    palette === "botanica-huerta"
      ? "Buscar brunch, plato de huerta, café o vino natural..."
      : palette === "mar-pacifico"
      ? "Buscar ceviche, pesca del día, entrada o cóctel..."
      : "Buscar plato, entrada, cóctel o ingrediente...";

  const defaultSignatureBadge =
    palette === "botanica-huerta"
      ? "Insignia de la Huerta"
      : palette === "mar-pacifico"
      ? "Pesca Insignia"
      : "Especialidad de la Casa";

  return {
    palette,
    brandIcon,
    heroStyle,
    searchPlaceholder:
      typeof rawTheme.searchPlaceholder === "string"
        ? rawTheme.searchPlaceholder
        : defaultSearchPlaceholder,
    signatureBadgeLabel:
      typeof rawTheme.signatureBadgeLabel === "string"
        ? rawTheme.signatureBadgeLabel
        : defaultSignatureBadge,
    archetype,
    heroImage:
      typeof rawTheme.heroImage === "string" ? rawTheme.heroImage : undefined,
    authenticityBadge:
      typeof rawTheme.authenticityBadge === "string"
        ? rawTheme.authenticityBadge
        : undefined,
    serviceChargeNote:
      typeof rawTheme.serviceChargeNote === "string"
        ? rawTheme.serviceChargeNote
        : undefined,
  };
}

function parseEntitlementsRow(
  raw: Database["public"]["Tables"]["restaurant_entitlements"]["Row"] | null
): RestaurantEntitlementsConfig {
  const planTier: SaasPlanTier =
    raw?.plan_tier === "basic" ||
    raw?.plan_tier === "standard" ||
    raw?.plan_tier === "full"
      ? raw.plan_tier
      : "full";

  const designTier: DesignTier =
    raw?.design_tier === "basic" ||
    raw?.design_tier === "standard" ||
    raw?.design_tier === "premium"
      ? raw.design_tier
      : "standard";

  const subscriptionStatus: SubscriptionStatus =
    raw?.subscription_status === "active" ||
    raw?.subscription_status === "past_due_grace" ||
    raw?.subscription_status === "vitrine_only" ||
    raw?.subscription_status === "suspended"
      ? raw.subscription_status
      : "active";

  const rawOverrides =
    raw &&
    typeof raw.feature_overrides === "object" &&
    raw.feature_overrides !== null &&
    !Array.isArray(raw.feature_overrides)
      ? (raw.feature_overrides as Record<string, unknown>)
      : {};

  const featureOverrides: Partial<Record<FeatureFlagKey, boolean>> = {};
  for (const key of [
    "table_shortlist",
    "direct_orders",
    "promotions",
    "events_crm",
    "multi_location",
    "catalog_mutations",
  ] as FeatureFlagKey[]) {
    if (typeof rawOverrides[key] === "boolean") {
      featureOverrides[key] = rawOverrides[key] as boolean;
    }
  }

  return {
    planTier,
    designTier,
    subscriptionStatus,
    maxLocations: raw?.max_locations ?? 1,
    setupOneTimeFee: Number(raw?.setup_one_time_fee ?? 1500000),
    monthlyBaseFee: Number(raw?.monthly_base_fee ?? 249000),
    extraLocationFee: Number(raw?.extra_location_fee ?? 129000),
    featureOverrides,
  };
}

async function fetchRestaurantAggregateUncached(
  slug: string
): Promise<RestaurantAggregateData | null> {
  const supabase = createSupabasePublicServerClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return null;
  }

  const [
    entitlementsRes,
    locationsRes,
    menusRes,
    categoriesRes,
    productsRes,
    productLocationsRes,
    optionGroupsRes,
    optionsRes,
    eventSpacesRes,
    eventPackagesRes,
  ] = await Promise.all([
    supabase
      .from("restaurant_entitlements")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle(),
    supabase
      .from("locations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .in("availability_status", ["available", "sold_out"])
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_locations")
      .select("product_id, location_id, is_offered, availability_status, price_override")
      .eq("restaurant_id", restaurant.id),
    supabase
      .from("product_option_groups")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_options")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_spaces")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_packages")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const entitlements = parseEntitlementsRow(entitlementsRes.data ?? null);
  const allActiveLocations = locationsRes.data ?? [];

  const rawModules =
    typeof restaurant.enabled_modules === "object" &&
    restaurant.enabled_modules !== null &&
    !Array.isArray(restaurant.enabled_modules)
      ? (restaurant.enabled_modules as Record<string, unknown>)
      : {};

  const baseEnabledModules: EnabledModulesConfig = {
    menu: rawModules.menu !== false,
    events: rawModules.events !== false,
    site: rawModules.site !== false,
  };

  const realCapabilities = resolveEffectiveCapabilities(
    entitlements,
    baseEnabledModules,
    "real"
  );

  // If Multi-Location is disabled in DB entitlements, clamp visible locations to primary/first
  const locations = realCapabilities.multiLocationEnabled
    ? allActiveLocations.slice(0, Math.max(1, entitlements.maxLocations))
    : allActiveLocations.slice(0, 1);

  const cities = Array.from(
    new Set(locations.map((l) => (l.city || "Bogotá").trim()))
  );

  const menus = menusRes.data ?? [];
  const rawCategories = categoriesRes.data ?? [];
  const rawProducts = productsRes.data ?? [];
  const rawProductLocations = productLocationsRes.data ?? [];
  const rawOptionGroups = optionGroupsRes.data ?? [];
  const rawOptions = optionsRes.data ?? [];
  const eventSpaces = eventSpacesRes.data ?? [];
  const eventPackages = eventPackagesRes.data ?? [];

  const prodLocsByProductId = new Map<string, ProductLocationRecord[]>();
  for (const pl of rawProductLocations) {
    const existing = prodLocsByProductId.get(pl.product_id) ?? [];
    existing.push({
      location_id: pl.location_id,
      is_offered: pl.is_offered,
      availability_status: pl.availability_status,
      price_override:
        pl.price_override != null ? Number(pl.price_override) : null,
    });
    prodLocsByProductId.set(pl.product_id, existing);
  }

  const optionsByGroupId = new Map<string, ProductOptionRow[]>();
  for (const opt of rawOptions) {
    const existing = optionsByGroupId.get(opt.option_group_id) ?? [];
    existing.push(opt);
    optionsByGroupId.set(opt.option_group_id, existing);
  }

  const groupsByProductId = new Map<string, ProductOptionGroupWithItems[]>();
  for (const grp of rawOptionGroups) {
    const existing = groupsByProductId.get(grp.product_id) ?? [];
    existing.push({
      ...grp,
      options: optionsByGroupId.get(grp.id) ?? [],
    });
    groupsByProductId.set(grp.product_id, existing);
  }

  const enrichedProducts: ProductWithDetails[] = rawProducts.map((prod) => ({
    ...prod,
    optionGroups: groupsByProductId.get(prod.id) ?? [],
    productLocations: prodLocsByProductId.get(prod.id) ?? [],
  }));

  const productsByCategoryId = new Map<string, ProductWithDetails[]>();
  for (const prod of enrichedProducts) {
    const existing = productsByCategoryId.get(prod.category_id) ?? [];
    existing.push(prod);
    productsByCategoryId.set(prod.category_id, existing);
  }

  const categories: CategoryWithProducts[] = rawCategories.map((cat) => ({
    ...cat,
    products: productsByCategoryId.get(cat.id) ?? [],
  }));

  const featuredProducts = enrichedProducts.filter(
    (p) => p.is_featured && p.availability_status === "available"
  );

  const rawTheme =
    typeof restaurant.theme_config === "object" &&
    restaurant.theme_config !== null &&
    !Array.isArray(restaurant.theme_config)
      ? (restaurant.theme_config as Record<string, unknown>)
      : {};

  const rawContact =
    typeof restaurant.contact_config === "object" &&
    restaurant.contact_config !== null &&
    !Array.isArray(restaurant.contact_config)
      ? (restaurant.contact_config as Record<string, unknown>)
      : {};

  const rawDelivery =
    typeof restaurant.delivery_config === "object" &&
    restaurant.delivery_config !== null &&
    !Array.isArray(restaurant.delivery_config)
      ? (restaurant.delivery_config as Record<string, unknown>)
      : {};

  const fallbackWhatsapp =
    locations[0]?.whatsapp_phone ??
    (typeof rawContact.whatsappPrimary === "string"
      ? rawContact.whatsappPrimary
      : "");

  return {
    restaurant,
    theme: resolveTenantTheme(
      restaurant.slug,
      restaurant.cuisine_type,
      rawTheme
    ),
    contact: {
      whatsappPrimary:
        typeof rawContact.whatsappPrimary === "string"
          ? rawContact.whatsappPrimary
          : fallbackWhatsapp,
      instagramHandle:
        typeof rawContact.instagramHandle === "string"
          ? rawContact.instagramHandle
          : undefined,
      eventsEmail:
        typeof rawContact.eventsEmail === "string"
          ? rawContact.eventsEmail
          : undefined,
      privacyPolicyText:
        typeof rawContact.privacyPolicyText === "string"
          ? rawContact.privacyPolicyText
          : `Autorizo a ${restaurant.name} el tratamiento de mis datos personales para gestionar esta solicitud conforme a la Ley 1581 de 2012.`,
    },
    entitlements,
    enabledModules: {
      menu: realCapabilities.menuVitrineEnabled,
      events: realCapabilities.eventsEnabled,
      site: realCapabilities.siteEnabled,
    },
    delivery: {
      enabled:
        realCapabilities.directOrdersEnabled && rawDelivery.enabled !== false,
      pickupEnabled:
        realCapabilities.directOrdersEnabled &&
        rawDelivery.pickupEnabled !== false,
      deliveryFee:
        typeof rawDelivery.deliveryFee === "number"
          ? rawDelivery.deliveryFee
          : 7000,
      freeDeliveryThreshold:
        typeof rawDelivery.freeDeliveryThreshold === "number"
          ? rawDelivery.freeDeliveryThreshold
          : 160000,
      minOrderAmount:
        typeof rawDelivery.minOrderAmount === "number"
          ? rawDelivery.minOrderAmount
          : 35000,
      estimatedDeliveryMinutes:
        typeof rawDelivery.estimatedDeliveryMinutes === "string"
          ? rawDelivery.estimatedDeliveryMinutes
          : "35 – 50 min",
      estimatedPickupMinutes:
        typeof rawDelivery.estimatedPickupMinutes === "string"
          ? rawDelivery.estimatedPickupMinutes
          : "20 – 25 min",
      transferInstructions:
        typeof rawDelivery.transferInstructions === "string"
          ? rawDelivery.transferInstructions
          : "Solicitar llave Bre-B / Nequi o QR bancario al confirmar por WhatsApp.",
    },
    allLocations: allActiveLocations,
    locations,
    cities,
    menus,
    categories,
    featuredProducts,
    eventSpaces,
    eventPackages,
  };
}

export function resolveEffectiveLocations(
  data: RestaurantAggregateData,
  caps: EffectiveCapabilities
): LocationRow[] {
  if (!caps.multiLocationEnabled) {
    return data.allLocations.slice(0, 1);
  }
  if (caps.isSimulated) {
    return data.allLocations;
  }
  return data.allLocations.slice(0, Math.max(1, data.entitlements.maxLocations));
}

export const getRestaurantBySlug = cache(
  async (slug: string): Promise<RestaurantAggregateData | null> => {
    const sanitizedSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(sanitizedSlug)) {
      return null;
    }

    return fetchRestaurantAggregateUncached(sanitizedSlug);
  }
);

/**
 * Resolves the effective capabilities for the current HTTP request, combining
 * database `restaurant_entitlements` with any ephemeral presenter simulation
 * (`?plan=` URL param or `fenbapps_sim_plan` session cookie on demo tenants).
 */
export async function getRequestEffectiveCapabilities(
  data: RestaurantAggregateData,
  urlPlanParam?: string | null
): Promise<EffectiveCapabilities> {
  let simPreset: SimPlanPreset = "real";

  if (data.restaurant.is_demo) {
    if (urlPlanParam) {
      simPreset = parseSimPlanPreset(urlPlanParam);
    } else {
      try {
        const cookieStore = await cookies();
        const rawCookie = cookieStore.get(SIM_PLAN_COOKIE_NAME)?.value;
        simPreset = parseSimPlanPreset(rawCookie);
      } catch {
        simPreset = "real";
      }
    }
  }

  const rawModules =
    typeof data.restaurant.enabled_modules === "object" &&
    data.restaurant.enabled_modules !== null &&
    !Array.isArray(data.restaurant.enabled_modules)
      ? (data.restaurant.enabled_modules as Record<string, unknown>)
      : {};

  return resolveEffectiveCapabilities(
    data.entitlements,
    {
      site: rawModules.site !== false,
      menu: rawModules.menu !== false,
      events: rawModules.events !== false,
    },
    simPreset
  );
}
