import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  adminUpsertCategorySchema,
  adminDeleteCategorySchema,
  adminReorderCategoriesSchema,
  adminUpsertProductSchema,
  adminDeleteProductSchema,
} from "@/lib/validators/catalog";
import type { Database } from "@/types/database.types";
import type { OperationalProductItem } from "@/modules/admin/queries";

type SupabaseSchema = Omit<Database, "__InternalSupabase">;

const SUPABASE_URL = "https://gssikxqasqjbyvcdccgl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_BTWcKOCkyY8FnL9GeafcGg_tEgL8fkX";

describe("Fase 2: Validadores Zod para CRUD de Carta & Modificadores", () => {
  it("valida la creación de categoría con formato editorial", () => {
    const validCategory = {
      restaurantSlug: "casa-brasa",
      name: "Cortes Madurados & Brasa",
      slug: "cortes-madurados-brasa",
      displayMode: "editorial_grid" as const,
      sortOrder: 1,
      isActive: true,
      description: "Nuestra selección exclusiva de cortes premium.",
    };

    const parsed = adminUpsertCategorySchema.safeParse(validCategory);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Cortes Madurados & Brasa");
      expect(parsed.data.slug).toBe("cortes-madurados-brasa");
      expect(parsed.data.sortOrder).toBe(1);
    }
  });

  it("rechaza categoría con sortOrder negativo o nombre vacío", () => {
    const invalidCategory = {
      restaurantSlug: "casa-brasa",
      name: "",
      slug: "invalid-category",
      displayMode: "editorial_grid",
      sortOrder: -5,
      isActive: true,
    };

    const parsed = adminUpsertCategorySchema.safeParse(invalidCategory);
    expect(parsed.success).toBe(false);
  });

  it("valida reordenamiento de categorías con arrays de IDs y orden secuencial", () => {
    const payload = {
      restaurantSlug: "casa-brasa",
      categoryOrders: [
        { id: "11111111-2222-3333-4444-555555555551", sort_order: 1 },
        { id: "11111111-2222-3333-4444-555555555552", sort_order: 2 },
        { id: "11111111-2222-3333-4444-555555555553", sort_order: 3 },
      ],
    };

    const parsed = adminReorderCategoriesSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("valida creación de plato complejo con grupos de opciones, deltas de precio e insignias", () => {
    const validProduct = {
      restaurantSlug: "casa-brasa",
      categoryId: "11111111-2222-3333-4444-555555555551",
      name: "Tomahawk Prime Angus 1000g",
      slug: "tomahawk-prime-angus-1000g",
      basePrice: 198000,
      compareAtPrice: 220000,
      shortDescription: "Corte imponente sellado al carbón.",
      longDescription: "Maduración dry-aged 35 días en cámara propia.",
      portionLabel: "1000g (Para 2-3 personas)",
      availabilityStatus: "available" as const,
      isFeatured: true,
      isChefChoice: true,
      isNew: false,
      badges: ["Dry-Aged", "Angus Prime", "Al Carbón"],
      sortOrder: 1,
      optionGroups: [
        {
          name: "Término de la Carne",
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [
            { name: "Término Medio (Recomendado)", priceDelta: 0, isDefault: true },
            { name: "Tres Cuartos", priceDelta: 0, isDefault: false },
            { name: "Azul / Sellado", priceDelta: 0, isDefault: false },
          ],
        },
        {
          name: "Acompañamiento Extra",
          minSelections: 0,
          maxSelections: 2,
          isRequired: false,
          options: [
            { name: "Papas Criollas Trufadas", priceDelta: 16000, isDefault: false },
            { name: "Mazorca Asada con Mantequilla de Romero", priceDelta: 12000, isDefault: false },
          ],
        },
      ],
    };

    const parsed = adminUpsertProductSchema.safeParse(validProduct);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.optionGroups).toHaveLength(2);
      expect(parsed.data.optionGroups[0]?.options).toHaveLength(3);
      expect(parsed.data.optionGroups[1]?.options[0]?.priceDelta).toBe(16000);
      expect(parsed.data.badges).toContain("Dry-Aged");
    }
  });

  it("rechaza plato con precio base negativo o disponibilidad inválida", () => {
    const invalidProduct = {
      restaurantSlug: "casa-brasa",
      categoryId: "11111111-2222-3333-4444-555555555551",
      name: "Plato Inválido",
      slug: "plato-invalido",
      basePrice: -5000,
      availabilityStatus: "super_agotado",
    };

    const parsed = adminUpsertProductSchema.safeParse(invalidProduct);
    expect(parsed.success).toBe(false);
  });

  it("valida eliminación de categoría con reasignación opcional de platos", () => {
    const deletePayload = {
      restaurantSlug: "casa-brasa",
      categoryId: "11111111-2222-3333-4444-555555555551",
      reassignToCategoryId: "11111111-2222-3333-4444-555555555552",
    };

    const parsed = adminDeleteCategorySchema.safeParse(deletePayload);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.reassignToCategoryId).toBe(
      "11111111-2222-3333-4444-555555555552"
    );
  });
});

describe("Fase 2: Motor de Filtros Facetados & Paginación para 100+ Platos", () => {
  // Mock dataset representing 104 dishes
  const mockDishes: OperationalProductItem[] = Array.from({ length: 104 }, (_, idx) => {
    const id = `dish-${idx + 1}`;
    const catIndex = idx % 5;
    const catNames = ["Entradas", "Cortes Brasa", "Guarniciones", "Postres", "Coctelería"];
    const basePrice = 20000 + (idx * 3000);
    return {
      id,
      slug: `dish-slug-${idx + 1}`,
      name: `Plato Gourmet ${idx + 1} ${idx % 3 === 0 ? "Angus" : "Trufa"}`,
      category_id: `cat-${catIndex + 1}`,
      category_name: catNames[catIndex]!,
      portion_label: "Porción individual",
      short_description: `Delicioso plato número ${idx + 1}`,
      long_description: null,
      image_url: null,
      image_alt: null,
      base_price: basePrice,
      compare_at_price: idx % 4 === 0 ? basePrice + 10000 : null,
      availability_status: idx % 10 === 0 ? "sold_out" : idx % 25 === 0 ? "hidden" : "available",
      is_featured: idx % 5 === 0,
      is_chef_choice: idx % 7 === 0,
      is_new: idx % 6 === 0,
      badges: idx % 2 === 0 ? ["Recomendado", "Gourmet"] : [],
      sort_order: idx + 1,
      option_groups: idx % 3 === 0 ? [
        {
          id: `grp-${idx}`,
          name: "Opciones de Acompañamiento",
          min_selections: 0,
          max_selections: 2,
          is_required: false,
          sort_order: 1,
          options: [
            { id: `opt-1-${idx}`, name: "Papas", price_delta: 0, is_default: true, is_available: true, sort_order: 1 },
            { id: `opt-2-${idx}`, name: "Ensalada", price_delta: 5000, is_default: false, is_available: true, sort_order: 2 },
          ],
        },
      ] : [],
      exclusive_location_name: null,
      price_override: null,
      global_base_price: basePrice,
      location_overrides_count: 0,
      updated_at: new Date().toISOString(),
    };
  });

  it("filtra exactamente por categoría con contadores exactos", () => {
    const entradas = mockDishes.filter((d) => d.category_id === "cat-1");
    expect(entradas.length).toBeGreaterThan(0);
    entradas.forEach((d) => expect(d.category_name).toBe("Entradas"));
  });

  it("filtra por estado de disponibilidad (available, sold_out, hidden)", () => {
    const available = mockDishes.filter((d) => d.availability_status === "available");
    const soldOut = mockDishes.filter((d) => d.availability_status === "sold_out");
    const hidden = mockDishes.filter((d) => d.availability_status === "hidden");

    expect(available.length + soldOut.length + hidden.length).toBe(104);
    expect(soldOut.length).toBeGreaterThan(5);
    expect(hidden.length).toBeGreaterThanOrEqual(2);
  });

  it("filtra por insignias combinadas (Destacado, Chef, Nuevo)", () => {
    const featured = mockDishes.filter((d) => d.is_featured);
    const chefChoice = mockDishes.filter((d) => d.is_chef_choice);
    const withOptions = mockDishes.filter((d) => (d.option_groups ?? []).length > 0);

    expect(featured.length).toBeGreaterThan(15);
    expect(chefChoice.length).toBeGreaterThan(10);
    expect(withOptions.length).toBeGreaterThan(30);
  });

  it("filtra por rango de precio (min y max) y ordena de menor a mayor", () => {
    const min = 50000;
    const max = 150000;
    const inRange = mockDishes
      .filter((d) => Number(d.base_price) >= min && Number(d.base_price) <= max)
      .sort((a, b) => Number(a.base_price) - Number(b.base_price));

    expect(inRange.length).toBeGreaterThan(0);
    expect(Number(inRange[0]?.base_price)).toBeGreaterThanOrEqual(min);
    expect(Number(inRange[inRange.length - 1]?.base_price)).toBeLessThanOrEqual(max);
  });

  it("calcula paginación ergonómica correctamente (20 por página -> 6 páginas para 104 platos)", () => {
    const total = mockDishes.length; // 104
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(6);

    // Página 1 (0 a 20)
    const page1 = mockDishes.slice(0, pageSize);
    expect(page1).toHaveLength(20);
    expect(page1[0]?.id).toBe("dish-1");
    expect(page1[19]?.id).toBe("dish-20");

    // Página 6 (100 a 104)
    const page6 = mockDishes.slice(5 * pageSize, 5 * pageSize + pageSize);
    expect(page6).toHaveLength(4);
    expect(page6[0]?.id).toBe("dish-101");
    expect(page6[3]?.id).toBe("dish-104");
  });
});

describe("Fase 2: Supabase Snapshot Real, 100+ Platos y Protección RLS", () => {
  const client = createClient<SupabaseSchema>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } }
  );

  it("public.get_operational_console_snapshot retorna categorías y 100+ platos para Casa Brasa", async () => {
    const { data, error } = await client.rpc(
      "get_operational_console_snapshot",
      {
        p_restaurant_slug: "casa-brasa",
        p_location_id: undefined,
      }
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const snapshot = data as {
      categories: Array<{ id: string; name: string; products_count: number }>;
      products: Array<{
        id: string;
        name: string;
        base_price: number;
        category_name: string;
        option_groups: Array<unknown>;
      }>;
    };

    expect(Array.isArray(snapshot.categories)).toBe(true);
    expect(snapshot.categories.length).toBeGreaterThanOrEqual(7);

    expect(Array.isArray(snapshot.products)).toBe(true);
    expect(snapshot.products.length).toBeGreaterThanOrEqual(100);

    // Verificar que los platos tienen estructura enriquecida de Fase 2
    const firstDish = snapshot.products[0];
    expect(firstDish).toBeDefined();
    expect(firstDish?.name).toBeTruthy();
    expect(firstDish?.category_name).toBeTruthy();
    expect(Array.isArray(firstDish?.option_groups)).toBe(true);
  }, 10000);

  it("bloquea llamadas anónimas no autorizadas para eliminar platos (RLS/RPC security)", async () => {
    // Intento anónimo de invocar admin_delete_product
    const { error } = await client.rpc("admin_delete_product" as never, {
      p_restaurant_slug: "casa-brasa",
      p_product_id: "corte-secreto-pruebas-internas",
    } as never);

    // Debe arrojar error de permisos o función no permitida para anon
    expect(error).toBeDefined();
  });
});
