import { z } from "zod";

export const FULFILLMENT_TYPES = ["dine_in", "delivery", "pickup"] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const PAYMENT_METHODS = ["cash", "card_dataphone", "transfer"] as const;
export type DirectPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DIRECT_ORDER_STATUSES = [
  "received",
  "preparing",
  "dispatched",
  "completed",
  "cancelled",
] as const;
export type DirectOrderStatus = (typeof DIRECT_ORDER_STATUSES)[number];

export const directOrderItemSchema = z.object({
  productId: z.string().uuid("Producto inválido."),
  name: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().min(0).max(50000000),
  options: z.array(z.string().max(120)).max(12).default([]),
});

export const publicDirectOrderSchema = z
  .object({
    restaurantId: z.string().uuid("Identificador de restaurante inválido."),
    restaurantSlug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/),
    locationId: z.string().uuid().nullable().optional(),
    fulfillmentType: z.enum(FULFILLMENT_TYPES),
    tableNumber: z.string().trim().max(30).optional().or(z.literal("")),
    pickupSlot: z.string().trim().max(60).optional().or(z.literal("")),
    customerName: z
      .string()
      .trim()
      .min(2, "Ingresa tu nombre para entregar el pedido.")
      .max(120, "Nombre demasiado largo."),
    customerPhone: z
      .string()
      .trim()
      .min(7, "Ingresa un número de WhatsApp o celular válido.")
      .max(25, "Número de teléfono demasiado largo.")
      .regex(/^[+\d\s()-]{7,25}$/, "Formato de teléfono no válido."),
    deliveryAddress: z.string().trim().max(260).optional().or(z.literal("")),
    deliveryNeighborhood: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal("")),
    deliveryNotes: z.string().trim().max(600).optional().or(z.literal("")),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Selecciona cómo deseas pagar." }),
    }),
    paymentDetails: z.string().trim().max(240).optional().or(z.literal("")),
    items: z
      .array(directOrderItemSchema)
      .min(1, "Agrega al menos un plato a tu pedido."),
    subtotalAmount: z.number().min(0).max(100000000),
    deliveryFee: z.number().min(0).max(500000),
    totalAmount: z.number().min(0).max(100000000),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({
        message: "Autoriza el uso de tus datos para coordinar la entrega.",
      }),
    }),
    websiteHoneypot: z.string().max(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === "delivery") {
      if (!data.deliveryAddress || data.deliveryAddress.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryAddress"],
          message:
            "Ingresa tu dirección exacta (calle/carrera, número y apartamento).",
        });
      }
      if (
        !data.deliveryNeighborhood ||
        data.deliveryNeighborhood.trim().length < 2
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryNeighborhood"],
          message: "Indica el barrio o sector de entrega.",
        });
      }
    }
  });

export type PublicDirectOrderInput = z.infer<typeof publicDirectOrderSchema>;
