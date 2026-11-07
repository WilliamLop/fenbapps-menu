import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { publicEventInquirySchema } from "@/lib/validators/events";
import { publicDirectOrderSchema } from "@/lib/validators/orders";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
  getAdaptiveThreeColumnGrid,
  getRestaurantRefPrefix,
} from "@/lib/utils";
import {
  resolveEffectiveCapabilities,
  computeTenantMrr,
  resolveProductForLocation,
  resolveLocationDeliveryConfig,
} from "@/lib/saas-entitlements";
import { resolveTenantTheme } from "@/modules/tenant/queries";
import type { Database } from "@/types/database.types";

type SupabaseSchema = Omit<Database, "__InternalSupabase">;

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

  it("acepta una solicitud de evento comercial válida con Habeas Data aceptado (incluyendo franja 'breakfast' / Brunch)", () => {
    const parsed = publicEventInquirySchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);

    const parsedBrunch = publicEventInquirySchema.safeParse({
      ...validPayload,
      preferredTimeSlot: "breakfast" as const,
    });
    expect(parsedBrunch.success).toBe(true);
  });

  it("resuelve grillas adaptativas (1/2/3+ elementos), prefijos dinámicos de tenant y temas editoriales", () => {
    expect(getAdaptiveThreeColumnGrid(1)).toBe("grid-cols-1");
    expect(getAdaptiveThreeColumnGrid(2)).toBe("grid-cols-1 md:grid-cols-2");
    expect(getAdaptiveThreeColumnGrid(3)).toBe(
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    );
    expect(getRestaurantRefPrefix("casa-brasa")).toBe("CB");
    expect(getRestaurantRefPrefix("botanica-brunch")).toBe("BB");

    const botanicaTheme = resolveTenantTheme(
      "botanica-brunch",
      "Cocina de Huerta, Brunch & Vino Natural",
      {
        theme_palette: "botanica-huerta",
        brand_icon: "leaf",
        hero_style: "sunlit-editorial",
      }
    );
    expect(botanicaTheme.palette).toBe("botanica-huerta");
    expect(botanicaTheme.brandIcon).toBe("leaf");
    expect(botanicaTheme.heroStyle).toBe("sunlit-editorial");
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

  it("valida pedidos directos a domicilio exigiendo dirección/barrio, medio de pago y optionIds opcionales", () => {
    const validDelivery = publicDirectOrderSchema.safeParse({
      restaurantId: "11111111-1111-4111-8111-111111111111",
      restaurantSlug: "casa-brasa",
      locationId: "11111111-2222-4111-8111-333333333333",
      fulfillmentType: "delivery",
      customerName: "Laura Gómez",
      customerPhone: "3105550199",
      deliveryAddress: "Calle 10A # 35-28 Apto 802",
      deliveryNeighborhood: "Provenza",
      paymentMethod: "cash",
      paymentDetails: "Efectivo con $200.000",
      items: [
        {
          productId: "22222222-2222-4222-8222-222222222222",
          name: "Pulpo al Rescoldo",
          quantity: 2,
          unitPrice: 62000,
          options: ["Papas nativas"],
          optionIds: ["33333333-3333-4333-8333-333333333333"],
        },
      ],
      subtotalAmount: 124000,
      deliveryFee: 7000,
      totalAmount: 131000,
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

describe("2. Arquitectura Comercial SaaS 2-Ejes, Modo Vitrina & Multi-Ciudad", () => {
  const baseEntitlements = {
    planTier: "full" as const,
    designTier: "premium" as const,
    subscriptionStatus: "active" as const,
    maxLocations: 3,
    setupOneTimeFee: 3200000,
    monthlyBaseFee: 389000,
    extraLocationFee: 169000,
    featureOverrides: {},
  };

  const allModulesOn = { site: true, menu: true, events: true };

  it("resuelve capacidades por plan (Basic vs Standard vs Full) y congela operación en Modo Vitrina sin romper web/QR", () => {
    const basicCaps = resolveEffectiveCapabilities(
      { ...baseEntitlements, planTier: "basic" },
      allModulesOn
    );
    expect(basicCaps.siteEnabled).toBe(true);
    expect(basicCaps.menuVitrineEnabled).toBe(true);
    expect(basicCaps.tableShortlistEnabled).toBe(true);
    expect(basicCaps.catalogMutationsEnabled).toBe(true);
    expect(basicCaps.directOrdersEnabled).toBe(false);
    expect(basicCaps.eventsEnabled).toBe(false);
    expect(basicCaps.multiLocationEnabled).toBe(false);

    const standardCaps = resolveEffectiveCapabilities(
      { ...baseEntitlements, planTier: "standard" },
      allModulesOn
    );
    expect(standardCaps.directOrdersEnabled).toBe(true);
    expect(standardCaps.promotionsEnabled).toBe(true);
    expect(standardCaps.eventsEnabled).toBe(false);

    const vitrineCaps = resolveEffectiveCapabilities(
      { ...baseEntitlements, subscriptionStatus: "vitrine_only" },
      allModulesOn
    );
    expect(vitrineCaps.isVitrineOnly).toBe(true);
    expect(vitrineCaps.siteEnabled).toBe(true);
    expect(vitrineCaps.menuVitrineEnabled).toBe(true);
    expect(vitrineCaps.tableShortlistEnabled).toBe(false);
    expect(vitrineCaps.directOrdersEnabled).toBe(false);
    expect(vitrineCaps.eventsEnabled).toBe(false);
    expect(vitrineCaps.catalogMutationsEnabled).toBe(false);

    // Ephemeral presenter simulation overrides DB without mutating PostgreSQL
    const simBasicOnFullTenant = resolveEffectiveCapabilities(
      baseEntitlements,
      allModulesOn,
      "basic"
    );
    expect(simBasicOnFullTenant.isSimulated).toBe(true);
    expect(simBasicOnFullTenant.directOrdersEnabled).toBe(false);
    expect(simBasicOnFullTenant.eventsEnabled).toBe(false);
  });

  it("calcula MRR multi-sede (base + sedes adicionales) y lleva cobro efectivo a $0 en Modo Vitrina o Suspendido", () => {
    const activeMrr = computeTenantMrr(389000, 169000, 3, "active");
    expect(activeMrr.extraLocationsCount).toBe(2);
    expect(activeMrr.extraLocationsTotal).toBe(338000);
    expect(activeMrr.contractedMrr).toBe(727000);
    expect(activeMrr.collectibleMrr).toBe(727000);

    const vitrineMrr = computeTenantMrr(389000, 169000, 3, "vitrine_only");
    expect(vitrineMrr.contractedMrr).toBe(727000);
    expect(vitrineMrr.collectibleMrr).toBe(0);
  });

  it("resuelve precios regionales, agotados aislados por sede y parámetros bancarios/envío por ciudad", () => {
    const medellinId = "11111111-2222-4111-8111-333333333333";
    const bogotaId = "11111111-2222-4111-8111-111111111111";

    const pulpoProduct = {
      base_price: 58000,
      availability_status: "available",
      exclusive_location_id: null,
      productLocations: [
        {
          location_id: medellinId,
          is_offered: true,
          availability_status: "available",
          price_override: 62000,
        },
      ],
    };

    const mdeView = resolveProductForLocation(pulpoProduct, medellinId);
    expect(mdeView.effectivePrice).toBe(62000);
    expect(mdeView.hasPriceOverride).toBe(true);
    expect(mdeView.availabilityStatus).toBe("available");

    const bogView = resolveProductForLocation(pulpoProduct, bogotaId);
    expect(bogView.effectivePrice).toBe(58000);
    expect(bogView.hasPriceOverride).toBe(false);

    const fallbackDelivery = {
      enabled: true,
      pickupEnabled: true,
      deliveryFee: 7500,
      freeDeliveryThreshold: 180000,
      minOrderAmount: 45000,
      estimatedDeliveryMinutes: "35 – 45 min",
      estimatedPickupMinutes: "20 – 25 min",
      transferInstructions: "Bancolombia Bogotá",
    };

    const mdeDelivery = resolveLocationDeliveryConfig(
      {
        deliveryFee: 7000,
        transferInstructions: "Llave Bre-B Medellín: @casabrasamed",
      },
      fallbackDelivery,
      true
    );
    expect(mdeDelivery.deliveryFee).toBe(7000);
    expect(mdeDelivery.transferInstructions).toContain("@casabrasamed");

    const disabledByPlanDelivery = resolveLocationDeliveryConfig(
      { deliveryFee: 7000 },
      fallbackDelivery,
      false
    );
    expect(disabledByPlanDelivery.enabled).toBe(false);
    expect(disabledByPlanDelivery.pickupEnabled).toBe(false);
  });
});

describe("3. Verificación Real de Seguridad Multi-Tenant, RLS y Aislamiento Multi-Ciudad en Supabase", () => {
  const anonClient = createClient<SupabaseSchema>(
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

  it("impide completamente que un visitante anónimo lea solicitudes privadas de eventos o domicilios (PII)", async () => {
    const [inqRes, ordRes] = await Promise.all([
      anonClient.from("event_inquiries").select("*"),
      anonClient.from("direct_orders").select("*"),
    ]);

    expect(inqRes.error).toBeNull();
    expect(inqRes.data).toEqual([]);
    expect(ordRes.error).toBeNull();
    expect(ordRes.data).toEqual([]);
  });

  it("bloquea intentos anónimos de alterar precios, planes SaaS (restaurant_entitlements) o diferenciales por sede (product_locations)", async () => {
    const [prodRes, entRes, prodLocRes] = await Promise.all([
      anonClient
        .from("products")
        .update({ base_price: 1 })
        .eq("slug", "ribeye-dry-aged-35-dias")
        .select(),
      anonClient
        .from("restaurant_entitlements")
        .update({ plan_tier: "basic", monthly_base_fee: 0 })
        .eq("restaurant_id", "11111111-1111-4111-8111-111111111111")
        .select(),
      anonClient
        .from("product_locations")
        .update({ price_override: 100 })
        .eq("location_id", "11111111-2222-4111-8111-333333333333")
        .select(),
    ]);

    expect(prodRes.data ?? []).toHaveLength(0);
    expect(entRes.data ?? []).toHaveLength(0);
    expect(prodLocRes.data ?? []).toHaveLength(0);
  });

  it("aísla bandejas de CRM, precios regionales y agotados en Medellín cuando se consulta get_operational_console_snapshot por sede", async () => {
    const medellinLocId = "11111111-2222-4111-8111-333333333333";
    const { data, error } = await anonClient.rpc(
      "get_operational_console_snapshot",
      {
        p_restaurant_slug: "casa-brasa",
        p_location_id: medellinLocId,
      }
    );

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const snap = data as Record<string, unknown>;
    expect(snap.selected_location_id).toBe(medellinLocId);

    const orders = (snap.direct_orders as Array<Record<string, unknown>>) ?? [];
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.location_id === medellinLocId)).toBe(true);
    expect(orders.some((o) => o.reference_code === "CB-DOM-MDE1")).toBe(true);

    const inquiries = (snap.inquiries as Array<Record<string, unknown>>) ?? [];
    expect(inquiries.length).toBeGreaterThan(0);
    expect(inquiries.every((i) => i.location_id === medellinLocId)).toBe(true);
    expect(inquiries.some((i) => i.reference_code === "CB-2611-MDE9")).toBe(
      true
    );

    const products = (snap.products as Array<Record<string, unknown>>) ?? [];
    const pulpo = products.find((p) =>
      String(p.name ?? "")
        .toLowerCase()
        .includes("pulpo")
    );
    expect(Number(pulpo?.base_price)).toBe(62000);
  });

  it("bloquea lectura pública de audit_logs, restaurant_members y restaurant_member_locations", async () => {
    const [auditRes, membersRes, memberLocsRes] = await Promise.all([
      anonClient.from("audit_logs").select("*"),
      anonClient.from("restaurant_members").select("*"),
      anonClient.from("restaurant_member_locations").select("*"),
    ]);

    expect(auditRes.data ?? []).toHaveLength(0);
    expect(membersRes.data ?? []).toHaveLength(0);
    expect(memberLocsRes.data ?? []).toHaveLength(0);
  });
});
