"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";

const updateProductSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  productId: z.string().uuid(),
  availabilityStatus: z.enum(["available", "sold_out", "hidden"]),
  basePrice: z.number().min(1000).max(50000000),
});

const updateInquirySchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  inquiryId: z.string().uuid(),
  status: z.enum([
    "received",
    "contacted",
    "quoted",
    "confirmed",
    "rejected",
    "archived",
  ]),
  internalNotes: z.string().max(1000).optional().default(""),
});

const updateDirectOrderSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  orderId: z.string().uuid(),
  status: z.enum([
    "received",
    "preparing",
    "dispatched",
    "completed",
    "cancelled",
  ]),
  internalNotes: z.string().max(1000).optional().default(""),
});

export interface OperationalActionResult {
  ok: boolean;
  error?: string;
}

export async function updateProductOperationalStateAction(
  rawInput: z.input<typeof updateProductSchema>
): Promise<OperationalActionResult> {
  const parsed = updateProductSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos de actualización de plato inválidos.",
    };
  }

  const { restaurantSlug, productId, availabilityStatus, basePrice } =
    parsed.data;

  try {
    const supabase = createSupabasePublicServerClient();
    const { error } = await supabase.rpc("update_product_operational_state", {
      p_restaurant_slug: restaurantSlug,
      p_product_id: productId,
      p_availability_status: availabilityStatus,
      p_base_price: basePrice,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No fue posible actualizar el estado del plato en este momento.",
      };
    }

    revalidatePath(`/${restaurantSlug}`);
    revalidatePath(`/${restaurantSlug}/menu`);
    revalidatePath(`/dashboard/${restaurantSlug}`);

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Error inesperado al actualizar el plato.",
    };
  }
}

export async function updateEventInquiryOperationalStateAction(
  rawInput: z.input<typeof updateInquirySchema>
): Promise<OperationalActionResult> {
  const parsed = updateInquirySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos de actualización de solicitud inválidos.",
    };
  }

  const { restaurantSlug, inquiryId, status, internalNotes } = parsed.data;

  try {
    const supabase = createSupabasePublicServerClient();
    const { error } = await supabase.rpc(
      "update_event_inquiry_operational_state",
      {
        p_restaurant_slug: restaurantSlug,
        p_inquiry_id: inquiryId,
        p_status: status,
        p_internal_notes: internalNotes ?? "",
      }
    );

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No fue posible actualizar la solicitud de evento en este momento.",
      };
    }

    revalidatePath(`/dashboard/${restaurantSlug}`);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Error inesperado al actualizar la solicitud.",
    };
  }
}

export async function updateDirectOrderStatusAction(
  rawInput: z.input<typeof updateDirectOrderSchema>
): Promise<OperationalActionResult> {
  const parsed = updateDirectOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos de actualización de pedido inválidos.",
    };
  }

  const { restaurantSlug, orderId, status, internalNotes } = parsed.data;

  try {
    const supabase = createSupabasePublicServerClient();
    const { error } = await supabase.rpc("update_direct_order_status", {
      p_restaurant_slug: restaurantSlug,
      p_order_id: orderId,
      p_status: status,
      p_internal_notes: internalNotes ?? "",
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No fue posible actualizar el estado del pedido en este momento.",
      };
    }

    revalidatePath(`/dashboard/${restaurantSlug}`);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Error inesperado al actualizar el pedido.",
    };
  }
}
