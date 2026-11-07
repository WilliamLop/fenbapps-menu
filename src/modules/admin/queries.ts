import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import type {
  DesignTier,
  FeatureFlagKey,
  SaasPlanTier,
  SubscriptionStatus,
} from "@/lib/saas-entitlements";

export interface OperationalProductItem {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  global_base_price?: number;
  base_price: number;
  price_override?: number | null;
  global_availability_status?: "available" | "sold_out" | "hidden";
  availability_status: "available" | "sold_out" | "hidden";
  is_featured: boolean;
  is_chef_choice: boolean;
  portion_label: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  exclusive_location_id?: string | null;
  exclusive_location_name: string | null;
  location_overrides_count?: number;
  updated_at: string;
}

export interface OperationalInquiryItem {
  id: string;
  reference_code: string;
  location_id?: string | null;
  event_type: string;
  tentative_date: string;
  preferred_time_slot: string;
  guest_count: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  company_name: string | null;
  special_requests: string | null;
  status:
    | "received"
    | "contacted"
    | "quoted"
    | "confirmed"
    | "rejected"
    | "archived";
  internal_admin_notes: string | null;
  created_at: string;
  updated_at: string;
  location_name: string | null;
  location_city?: string | null;
  event_space_name: string | null;
  event_package_name: string | null;
  package_base_price: number | null;
}

export interface OperationalDirectOrderLineItem {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  options?: string[];
}

export interface OperationalDirectOrderItem {
  id: string;
  reference_code: string;
  location_id?: string | null;
  fulfillment_type: "dine_in" | "delivery" | "pickup";
  table_number: string | null;
  pickup_slot: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
  delivery_notes: string | null;
  payment_method: "cash" | "card_dataphone" | "transfer";
  payment_details: string | null;
  items: OperationalDirectOrderLineItem[];
  subtotal_amount: number;
  delivery_fee: number;
  total_amount: number;
  status: "received" | "preparing" | "dispatched" | "completed" | "cancelled";
  internal_admin_notes: string | null;
  created_at: string;
  updated_at: string;
  location_name: string | null;
  location_city?: string | null;
}

export interface OperationalAuditLogItem {
  id: number;
  location_id?: string | null;
  location_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: string;
}

export interface OperationalConsoleSnapshot {
  restaurantId: string;
  restaurantSlug: string;
  selectedLocationId: string | null;
  products: OperationalProductItem[];
  inquiries: OperationalInquiryItem[];
  directOrders: OperationalDirectOrderItem[];
  auditLogs: OperationalAuditLogItem[];
}

export interface SuperAdminTenantItem {
  id: string;
  slug: string;
  name: string;
  cuisine_type: string | null;
  currency_code: string;
  is_demo: boolean;
  is_published: boolean;
  plan_tier: SaasPlanTier;
  design_tier: DesignTier;
  subscription_status: SubscriptionStatus;
  max_locations: number;
  setup_one_time_fee: number;
  monthly_base_fee: number;
  extra_location_fee: number;
  feature_overrides: Partial<Record<FeatureFlagKey, boolean>>;
  entitlements_updated_at: string | null;
  active_locations_count: number;
  locations: {
    id: string;
    slug: string;
    name: string;
    city: string;
  }[];
  products_count: number;
  direct_orders_count: number;
  event_inquiries_count: number;
}

export async function getOperationalConsoleSnapshot(
  restaurantSlug: string,
  locationId?: string | null
): Promise<OperationalConsoleSnapshot | null> {
  const supabase = await createSupabaseAuthenticatedServerClient();

  const { data, error } = await supabase.rpc(
    "get_operational_console_snapshot",
    {
      p_restaurant_slug: restaurantSlug.trim().toLowerCase(),
      p_location_id: locationId ?? undefined,
    }
  );

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const raw = data as Record<string, unknown>;

  return {
    restaurantId:
      typeof raw.restaurant_id === "string" ? raw.restaurant_id : "",
    restaurantSlug:
      typeof raw.restaurant_slug === "string"
        ? raw.restaurant_slug
        : restaurantSlug,
    selectedLocationId:
      typeof raw.selected_location_id === "string"
        ? raw.selected_location_id
        : null,
    products: Array.isArray(raw.products)
      ? (raw.products as OperationalProductItem[])
      : [],
    inquiries: Array.isArray(raw.inquiries)
      ? (raw.inquiries as OperationalInquiryItem[])
      : [],
    directOrders: Array.isArray(raw.direct_orders)
      ? (raw.direct_orders as OperationalDirectOrderItem[])
      : [],
    auditLogs: Array.isArray(raw.audit_logs)
      ? (raw.audit_logs as OperationalAuditLogItem[])
      : [],
  };
}

export async function getSuperAdminPortfolio(): Promise<{
  isAuthenticatedSuperAdmin: boolean;
  tenants: SuperAdminTenantItem[];
}> {
  const supabase = await createSupabaseAuthenticatedServerClient();
  const { data, error } = await supabase.rpc("super_admin_list_tenants");

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { isAuthenticatedSuperAdmin: false, tenants: [] };
  }

  const raw = data as Record<string, unknown>;
  return {
    isAuthenticatedSuperAdmin: Boolean(raw.is_authenticated_super_admin),
    tenants: Array.isArray(raw.tenants)
      ? (raw.tenants as SuperAdminTenantItem[])
      : [],
  };
}
