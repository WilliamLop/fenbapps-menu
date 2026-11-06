import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { publicEventInquirySchema } from "@/lib/validators/events";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import type { Database } from "@/types/database.types";

const SUPABASE_URL = "https://gssikxqasqjbyvcdccgl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_BTWcKOCkyY8FnL9GeafcGg_tEgL8fkX";

describe("1. Validadores de Dominio & Blindaje Anti-Abuso (Zod)", () => {
  const validPayload = {
    restaurantId: "11111111-1111-4111-8111-111111111111",
    restaurantSlug: "casa-brasa",
    eventType: "Cena Junta Directiva",
    tentativeDate: "2027-03-15",
    preferredTimeSlot: "dinner" as const,
    guestCount: 20,
    customerName: "Carlos Rodríguez",
    customerPhone: "+57 310 555 0199",
    customerEmail: "carlos@empresa.co",
    companyName: "Inversiones Demo SAS",
    specialRequests: "Dos menús vegetarianos.",
    privacyAccepted: true as const,
    websiteHoneypot: "",
  };

  it("acepta una solicitud de evento comercial válida con Habeas Data aceptado", () => {
    const parsed = publicEventInquirySchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("rechaza solicitudes cuando no se acepta la política de privacidad (Ley 1581)", () => {
    const parsed = publicEventInquirySchema.safeParse({
      ...validPayload,
      privacyAccepted: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza bots que llenan el campo trampa websiteHoneypot", () => {
    const parsed = publicEventInquirySchema.safeParse({
      ...validPayload,
      websiteHoneypot: "http://spam-bot.ru",
    });
    expect(parsed.success).toBe(false);
  });

  it("formatea moneda COP y enlaces de WhatsApp correctamente", () => {
    expect(formatCurrency(128000, "COP")).toContain("128.000");
    const url = buildWhatsAppUrl("+57 (310) 555-0193", "Hola Casa Brasa");
    expect(url).toBe("https://wa.me/573105550193?text=Hola%20Casa%20Brasa");
  });
});

describe("2. Verificación Real de Seguridad Multi-Tenant y RLS en Supabase", () => {
  const anonClient = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  it("permite leer el catálogo público de Casa Brasa pero oculta productos en estado 'hidden'", async () => {
    const { data: products, error } = await anonClient
      .from("products")
      .select("slug, availability_status")
      .eq("restaurant_id", "11111111-1111-4111-8111-111111111111");

    expect(error).toBeNull();
    expect(products).not.toBeNull();
    expect(products!.length).toBeGreaterThan(0);

    const hiddenProduct = products!.find(
      (p) => p.slug === "corte-secreto-pruebas-internas"
    );
    expect(hiddenProduct).toBeUndefined();
  });

  it("impide completamente que un visitante anónimo lea solicitudes privadas de eventos (PII)", async () => {
    const { data: inquiries, error } = await anonClient
      .from("event_inquiries")
      .select("*");

    expect(error).toBeNull();
    expect(inquiries).toEqual([]);
  });

  it("bloquea intentos de modificar o sabotear precios de platos sin autenticación (RLS UPDATE Lock)", async () => {
    const { data } = await anonClient
      .from("products")
      .update({ base_price: 1 })
      .eq("slug", "ribeye-dry-aged-35-dias")
      .select();

    expect(data ?? []).toHaveLength(0);
  });

  it("bloquea lectura pública de la tabla forense audit_logs y de restaurant_members", async () => {
    const [auditRes, membersRes] = await Promise.all([
      anonClient.from("audit_logs").select("*"),
      anonClient.from("restaurant_members").select("*"),
    ]);

    expect(auditRes.data ?? []).toHaveLength(0);
    expect(membersRes.data ?? []).toHaveLength(0);
  });
});
