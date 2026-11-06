"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  publicEventInquirySchema,
  type PublicEventInquiryInput,
} from "@/lib/validators/events";

export interface SubmitEventInquiryResult {
  ok: boolean;
  referenceCode?: string;
  inquiryId?: string;
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

export async function submitEventInquiryAction(
  rawInput: PublicEventInquiryInput
): Promise<SubmitEventInquiryResult> {
  // 1. Silent anti-bot honeypot check
  if (rawInput.websiteHoneypot && rawInput.websiteHoneypot.trim().length > 0) {
    return {
      ok: false,
      error: "No fue posible procesar la solicitud.",
    };
  }

  // 2. Strict Zod schema validation on server trust boundary
  const parsed = publicEventInquirySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Por favor revisa los campos marcados en el formulario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;

  try {
    const ipHash = await computeSaltedIpHash();
    const supabase = createSupabasePublicServerClient();

    const { data, error } = await supabase.rpc("submit_public_event_inquiry", {
      p_restaurant_id: input.restaurantId,
      p_location_id: input.locationId ?? undefined,
      p_event_space_id: input.eventSpaceId ?? undefined,
      p_event_package_id: input.eventPackageId ?? undefined,
      p_event_type: input.eventType,
      p_tentative_date: input.tentativeDate,
      p_preferred_time_slot: input.preferredTimeSlot,
      p_guest_count: input.guestCount,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail || undefined,
      p_company_name: input.companyName || undefined,
      p_special_requests: input.specialRequests || undefined,
      p_privacy_accepted: input.privacyAccepted,
      p_source_ip_hash: ipHash,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message ||
          "No pudimos registrar la solicitud en este momento. Intenta nuevamente.",
      };
    }

    const payload =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    return {
      ok: true,
      referenceCode:
        typeof payload.reference_code === "string"
          ? payload.reference_code
          : "CB-SOLICITUD",
      inquiryId: typeof payload.id === "string" ? payload.id : undefined,
    };
  } catch {
    return {
      ok: false,
      error: "Ocurrió un error inesperado al procesar la solicitud.",
    };
  }
}
