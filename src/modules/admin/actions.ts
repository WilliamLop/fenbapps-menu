"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import {
  SIM_PLAN_COOKIE_NAME,
  parseSimPlanPreset,
} from "@/lib/saas-entitlements";

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
  locationId: z.string().uuid().nullable().optional(),
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

const superAdminEntitlementsSchema = z.object({
  restaurantId: z.string().uuid(),
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  planTier: z.enum(["basic", "standard", "full"]),
  designTier: z.enum(["basic", "standard", "premium"]),
  subscriptionStatus: z.enum([
    "active",
    "past_due_grace",
    "vitrine_only",
    "suspended",
  ]),
  maxLocations: z.number().int().min(1).max(200),
  setupOneTimeFee: z.number().min(0).max(500000000),
  monthlyBaseFee: z.number().min(0).max(100000000),
  extraLocationFee: z.number().min(0).max(100000000),
  featureOverrides: z
    .record(z.string(), z.boolean())
    .optional()
    .default({}),
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

  const {
    restaurantSlug,
    productId,
    availabilityStatus,
    basePrice,
    locationId,
  } = parsed.data;

  try {
    const supabase = await createSupabaseAuthenticatedServerClient();
    const { error } = await supabase.rpc("update_product_operational_state", {
      p_restaurant_slug: restaurantSlug,
      p_product_id: productId,
      p_availability_status: availabilityStatus,
      p_base_price: basePrice,
      p_location_id: locationId ?? undefined,
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
    const supabase = await createSupabaseAuthenticatedServerClient();
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
    const supabase = await createSupabaseAuthenticatedServerClient();
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

export async function superAdminUpdateEntitlementsAction(
  rawInput: z.input<typeof superAdminEntitlementsSchema>
): Promise<OperationalActionResult> {
  const parsed = superAdminEntitlementsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Parámetros comerciales inválidos.",
    };
  }

  const input = parsed.data;

  try {
    const supabase = await createSupabaseAuthenticatedServerClient();
    const { error } = await supabase.rpc("super_admin_update_entitlements", {
      p_restaurant_id: input.restaurantId,
      p_plan_tier: input.planTier,
      p_design_tier: input.designTier,
      p_subscription_status: input.subscriptionStatus,
      p_max_locations: input.maxLocations,
      p_setup_one_time_fee: input.setupOneTimeFee,
      p_monthly_base_fee: input.monthlyBaseFee,
      p_extra_location_fee: input.extraLocationFee,
      p_feature_overrides: input.featureOverrides,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No fue posible guardar la configuración comercial del tenant.",
      };
    }

    revalidatePath("/");
    revalidatePath("/super-admin");
    revalidatePath(`/${input.restaurantSlug}`);
    revalidatePath(`/${input.restaurantSlug}/menu`);
    revalidatePath(`/${input.restaurantSlug}/eventos`);
    revalidatePath(`/dashboard/${input.restaurantSlug}`);

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Error inesperado al guardar el plan del restaurante.",
    };
  }
}

export async function setSimPlanCookieAction(
  rawPreset: string,
  restaurantSlug?: string
): Promise<OperationalActionResult> {
  try {
    const preset = parseSimPlanPreset(rawPreset);
    const cookieStore = await cookies();

    if (preset === "real") {
      cookieStore.delete(SIM_PLAN_COOKIE_NAME);
    } else {
      cookieStore.set(SIM_PLAN_COOKIE_NAME, preset, {
        path: "/",
        maxAge: 60 * 60 * 3, // 3 hours presenter session
        sameSite: "lax",
      });
    }

    if (restaurantSlug && /^[a-z0-9-]+$/.test(restaurantSlug)) {
      revalidatePath(`/${restaurantSlug}`);
      revalidatePath(`/${restaurantSlug}/menu`);
      revalidatePath(`/${restaurantSlug}/eventos`);
      revalidatePath(`/dashboard/${restaurantSlug}`);
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No fue posible cambiar el modo de simulación.",
    };
  }
}
