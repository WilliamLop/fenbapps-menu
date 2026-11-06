"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  publicDirectOrderSchema,
  type PublicDirectOrderInput,
} from "@/lib/validators/orders";

export interface SubmitDirectOrderResult {
  ok: boolean;
  referenceCode?: string;
  orderId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function computeSaltedIpHash(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");
  const rawIp = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";
  const salt =
    process.env.RATE_LIMIT_IP_SALT ?? "fenbapps_default_rate_limit_salt";

  return createHash("sha256").update(`${salt}:${rawIp}`).digest("hex");
}

export async function submitDirectOrderAction(
  rawInput: PublicDirectOrderInput
): Promise<SubmitDirectOrderResult> {
  if (rawInput.websiteHoneypot && rawInput.websiteHoneypot.trim().length > 0) {
    return {
      ok: false,
      error: "No fue posible procesar el pedido.",
    };
  }

  const parsed = publicDirectOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const firstMessage =
      Object.values(flattened).flat()[0] ??
      "Por favor verifica los datos de entrega y medio de pago.";
    return {
      ok: false,
      error: firstMessage,
      fieldErrors: flattened,
    };
  }

  const input = parsed.data;

  try {
    const ipHash = await computeSaltedIpHash();
    const supabase = createSupabasePublicServerClient();

    const { data, error } = await supabase.rpc("submit_public_direct_order", {
      p_restaurant_id: input.restaurantId,
      p_location_id: input.locationId ?? undefined,
      p_fulfillment_type: input.fulfillmentType,
      p_table_number: input.tableNumber || undefined,
      p_pickup_slot: input.pickupSlot || undefined,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_delivery_address: input.deliveryAddress || undefined,
      p_delivery_neighborhood: input.deliveryNeighborhood || undefined,
      p_delivery_notes: input.deliveryNotes || undefined,
      p_payment_method: input.paymentMethod,
      p_payment_details: input.paymentDetails || undefined,
      p_items: input.items,
      p_subtotal_amount: input.subtotalAmount,
      p_delivery_fee: input.deliveryFee,
      p_total_amount: input.totalAmount,
      p_privacy_accepted: input.privacyAccepted,
      p_source_ip_hash: ipHash,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No pudimos registrar el pedido en este momento. Intenta nuevamente.",
      };
    }

    const payload =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    revalidatePath(`/dashboard/${input.restaurantSlug}`);

    return {
      ok: true,
      referenceCode:
        typeof payload.reference_code === "string"
          ? payload.reference_code
          : "PED-DIRECTO",
      orderId: typeof payload.id === "string" ? payload.id : undefined,
    };
  } catch {
    return {
      ok: false,
      error: "Ocurrió un error inesperado al registrar tu pedido.",
    };
  }
}
