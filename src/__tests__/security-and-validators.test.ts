import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { publicEventInquirySchema } from "@/lib/validators/events";
import { publicDirectOrderSchema } from "@/lib/validators/orders";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
} from "@/lib/utils";
import type { Database } from "@/types/database.types";

const SUPABASE_URL = "https://gssikxqasqjbyvcdccgl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_BTWcKOCkyY8FnL9GeafcGg_tEgL8fkX";

describe("1. Validadores de Dominio, Sanitización Numérica & Blindaje Anti-Abuso (Zod)", () => {
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

  it("elimina ceros a la izquierda ('015' -> '15', '04' -> '4', '0' -> '') en inputs numéricos", () => {
    expect(sanitizeNumericInput("015")).toBe("15");
    expect(sanitizeNumericInput("04")).toBe("4");
    expect(sanitizeNumericInput("000")).toBe("");
    expect(sanitizeNumericInput("")).toBe("");
    expect(sanitizeNumericInput("abc028xyz")).toBe("28");
  });

  it("acepta una solicitud de evento comercial válida con Habeas Data aceptado", () => {
    const parsed = publicEventInquirySchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("rechaza fechas pasadas como 2019-01-09 en el cotizador de eventos", () => {
    const parsed = publicEventInquirySchema.safeParse({
      ...validPayload,
      tentativeDate: "2019-01-09",
    });
    expect(parsed.success).toBe(false);
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

  it("valida pedidos directos a domicilio exigiendo dirección/barrio y medio de pago", () => {
    const validDelivery = publicDirectOrderSchema.safeParse({
      restaurantId: "11111111-1111-4111-8111-111111111111",
      restaurantSlug: "casa-brasa",
      fulfillmentType: "delivery",
      customerName: "Laura Gómez",
      customerPhone: "3105550199",
      deliveryAddress: "Calle 94 # 11A-32 Apto 502",
      deliveryNeighborhood: "Chicó",
      paymentMethod: "cash",
      paymentDetails: "Efectivo con $200.000",
      items: [
        {
          productId: "22222222-2222-4222-8222-222222222222",
          name: "Pulpo al Rescoldo",
          quantity: 2,
          unitPrice: 64000,
          options: [],
        },
      ],
      subtotalAmount: 128000,
      deliveryFee: 7500,
      totalAmount: 135500,
      privacyAccepted: true,
    });
    expect(validDelivery.success).toBe(true);

    const missingAddress = publicDirectOrderSchema.safeParse({
      restaurantId: "11111111-1111-4111-8111-111111111111",
      restaurantSlug: "casa-brasa",
      fulfillmentType: "delivery",
      customerName: "Laura Gómez",
      customerPhone: "3105550199",
      deliveryAddress: "",
      deliveryNeighborhood: "",
      paymentMethod: "transfer",
      items: [
        {
          productId: "22222222-2222-4222-8222-222222222222",
          name: "Pulpo al Rescoldo",
          quantity: 1,
          unitPrice: 64000,
          options: [],
        },
      ],
      subtotalAmount: 64000,
      deliveryFee: 7500,
      totalAmount: 71500,
      privacyAccepted: true,
    });
    expect(missingAddress.success).toBe(false);
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

  it("impide completamente que un visitante anónimo lea pedidos a domicilio ajenos en direct_orders (PII)", async () => {
    const { data: orders, error } = await anonClient
      .from("direct_orders")
      .select("*");

    expect(error).toBeNull();
    expect(orders).toEqual([]);
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
