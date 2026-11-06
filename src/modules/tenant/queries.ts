import { cache } from "react";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];
export type LocationRow = Database["public"]["Tables"]["locations"]["Row"];
export type MenuRow = Database["public"]["Tables"]["menus"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
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

export interface RestaurantThemeConfig {
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
  enabledModules: EnabledModulesConfig;
  delivery: RestaurantDeliveryConfig;
  locations: LocationRow[];
  menus: MenuRow[];
  categories: CategoryWithProducts[];
  featuredProducts: ProductWithDetails[];
  eventSpaces: EventSpaceRow[];
  eventPackages: EventPackageRow[];
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
    locationsRes,
    menusRes,
    categoriesRes,
    productsRes,
    optionGroupsRes,
    optionsRes,
    eventSpacesRes,
    eventPackagesRes,
  ] = await Promise.all([
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

  const locations = locationsRes.data ?? [];
  const menus = menusRes.data ?? [];
  const rawCategories = categoriesRes.data ?? [];
  const rawProducts = productsRes.data ?? [];
  const rawOptionGroups = optionGroupsRes.data ?? [];
  const rawOptions = optionsRes.data ?? [];
  const eventSpaces = eventSpacesRes.data ?? [];
  const eventPackages = eventPackagesRes.data ?? [];

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

  const rawModules =
    typeof restaurant.enabled_modules === "object" &&
    restaurant.enabled_modules !== null &&
    !Array.isArray(restaurant.enabled_modules)
      ? (restaurant.enabled_modules as Record<string, unknown>)
      : {};

  const rawDelivery =
    typeof restaurant.delivery_config === "object" &&
    restaurant.delivery_config !== null &&
    !Array.isArray(restaurant.delivery_config)
      ? (restaurant.delivery_config as Record<string, unknown>)
      : {};

  return {
    restaurant,
    theme: {
      archetype:
        typeof rawTheme.archetype === "string" ? rawTheme.archetype : undefined,
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
    },
    contact: {
      whatsappPrimary:
        typeof rawContact.whatsappPrimary === "string"
          ? rawContact.whatsappPrimary
          : "+573105550193",
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
          : "Autorizo el tratamiento de mis datos personales para gestionar esta solicitud conforme a la Ley 1581 de 2012.",
    },
    enabledModules: {
      menu: rawModules.menu !== false,
      events: rawModules.events !== false,
      site: rawModules.site !== false,
    },
    delivery: {
      enabled: rawDelivery.enabled !== false,
      pickupEnabled: rawDelivery.pickupEnabled !== false,
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
    locations,
    menus,
    categories,
    featuredProducts,
    eventSpaces,
    eventPackages,
  };
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
