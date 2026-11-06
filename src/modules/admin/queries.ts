import { createSupabasePublicServerClient } from "@/lib/supabase/server";

export interface OperationalProductItem {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  base_price: number;
  availability_status: "available" | "sold_out" | "hidden";
  is_featured: boolean;
  is_chef_choice: boolean;
  portion_label: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  exclusive_location_name: string | null;
  updated_at: string;
}

export interface OperationalInquiryItem {
  id: string;
  reference_code: string;
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
}

export interface OperationalAuditLogItem {
  id: number;
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
  products: OperationalProductItem[];
  inquiries: OperationalInquiryItem[];
  directOrders: OperationalDirectOrderItem[];
  auditLogs: OperationalAuditLogItem[];
}

export async function getOperationalConsoleSnapshot(
  restaurantSlug: string
): Promise<OperationalConsoleSnapshot | null> {
  const supabase = createSupabasePublicServerClient();

  const { data, error } = await supabase.rpc(
    "get_operational_console_snapshot",
    {
      p_restaurant_slug: restaurantSlug.trim().toLowerCase(),
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
