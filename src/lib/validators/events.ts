import { z } from "zod";
import { getBogotaTodayIso } from "@/lib/utils";

export const TIME_SLOT_VALUES = [
  "lunch",
  "afternoon",
  "dinner",
  "full_evening",
] as const;

export const TIME_SLOT_LABELS: Record<(typeof TIME_SLOT_VALUES)[number], string> = {
  lunch: "Almuerzo (12:30 p. m. – 4:00 p. m.)",
  afternoon: "Tarde & Atardecer (4:00 p. m. – 7:30 p. m.)",
  dinner: "Cena Privada (7:30 p. m. – 11:30 p. m.)",
  full_evening: "Velada Completa (Horario extendido)",
};

export const publicEventInquirySchema = z.object({
  restaurantId: z.string().uuid("Identificador de restaurante inválido."),
  restaurantSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  locationId: z.string().uuid().nullable().optional(),
  eventSpaceId: z.string().uuid().nullable().optional(),
  eventPackageId: z.string().uuid().nullable().optional(),
  eventType: z
    .string()
    .trim()
    .min(3, "Indica el tipo de celebración o reunión.")
    .max(80, "El tipo de evento no puede superar 80 caracteres."),
  tentativeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha tentativa válida.")
    .refine(
      (val) => val >= getBogotaTodayIso(),
      "La fecha tentativa del evento no puede estar en el pasado."
    ),
  preferredTimeSlot: z.enum(TIME_SLOT_VALUES, {
    errorMap: () => ({ message: "Selecciona una franja horaria." }),
  }),
  guestCount: z.coerce
    .number()
    .int("El número de invitados debe ser entero.")
    .min(6, "El aforo mínimo para eventos privados es de 6 invitados.")
    .max(500, "Para eventos de más de 500 personas contáctanos directamente."),
  customerName: z
    .string()
    .trim()
    .min(3, "Ingresa tu nombre completo.")
    .max(120, "Nombre demasiado largo."),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Ingresa un número de WhatsApp o teléfono válido.")
    .max(25, "Número de teléfono demasiado largo.")
    .regex(/^[+\d\s()-]{7,25}$/, "Formato de teléfono no válido."),
  customerEmail: z
    .string()
    .trim()
    .email("Ingresa un correo electrónico válido.")
    .max(160)
    .optional()
    .or(z.literal("")),
  companyName: z
    .string()
    .trim()
    .max(120, "El nombre de la empresa no puede superar 120 caracteres.")
    .optional()
    .or(z.literal("")),
  specialRequests: z
    .string()
    .trim()
    .max(1000, "Las notas adicionales no pueden superar 1000 caracteres.")
    .optional()
    .or(z.literal("")),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({
      message:
        "Debes aceptar la política de tratamiento de datos personales (Ley 1581 de 2012).",
    }),
  }),
  // Anti-bot honeypot field: must always remain empty for human users
  websiteHoneypot: z.string().max(0, "Detección anti-spam activada.").optional(),
});

export type PublicEventInquiryInput = z.infer<typeof publicEventInquirySchema>;
