import { z } from "zod";

export const adminUpsertCategorySchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  categoryId: z.string().uuid().nullable().optional(),
  menuId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  subtitle: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().max(350).nullable().optional(),
  displayMode: z
    .enum(["editorial_grid", "compact_list", "featured_cards"])
    .default("editorial_grid"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const adminDeleteCategorySchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  categoryId: z.string().uuid(),
  reassignToCategoryId: z.string().uuid().nullable().optional(),
});

export const adminReorderCategoriesSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  categoryOrders: z.array(
    z.object({
      id: z.string().uuid(),
      sort_order: z.number().int(),
    })
  ),
});

export const adminOptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  priceDelta: z.number().min(0).default(0),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const adminOptionGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  helperText: z.string().trim().max(150).nullable().optional(),
  isRequired: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(adminOptionSchema).default([]),
});

export const adminUpsertProductSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().trim().max(280).nullable().optional(),
  longDescription: z.string().trim().max(1000).nullable().optional(),
  basePrice: z.number().min(1000).max(50000000),
  compareAtPrice: z.number().min(1000).max(50000000).nullable().optional(),
  portionLabel: z.string().trim().max(90).nullable().optional(),
  imageUrl: z.string().trim().max(600).nullable().optional(),
  imageAlt: z.string().trim().max(200).nullable().optional(),
  availabilityStatus: z
    .enum(["available", "sold_out", "hidden"])
    .default("available"),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isChefChoice: z.boolean().default(false),
  badges: z.array(z.string().trim().max(40)).default([]),
  exclusiveLocationId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  optionGroups: z.array(adminOptionGroupSchema).default([]),
});

export const adminDeleteProductSchema = z.object({
  restaurantSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  productId: z.string().uuid(),
});
