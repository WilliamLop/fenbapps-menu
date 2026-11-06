import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric amount in Colombian Pesos (COP) with tabular precision.
 * Example: 128000 -> "$ 128.000"
 */
export function formatCurrency(amount: number, currencyCode = "COP"): string {
  if (!Number.isFinite(amount)) {
    return "$ 0";
  }

  const formatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return formatted;
}

/**
 * Sanitizes user-typed numeric strings so clearing a field or typing after zero
 * never produces "015" or "04".
 */
export function sanitizeNumericInput(raw: string, maxDigits = 9): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
}

/**
 * Returns today's ISO date (YYYY-MM-DD) in Colombia's local timezone (America/Bogota)
 * so evening diners never run into UTC next-day drift.
 */
export function getBogotaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Derives a clean 2-letter tenant prefix from a restaurant slug (matching SQL RPC logic).
 * Examples:
 *   "casa-brasa" -> "CB"
 *   "botanica-brunch" -> "BB"
 */
export function getRestaurantRefPrefix(slug: string): string {
  const clean = slug.trim().toLowerCase();
  if (!clean) return "RS";
  const parts = clean.split("-").filter(Boolean);
  if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Computes responsive grid column classes based on actual item cardinality
 * so 1, 2, 3, or 4 items never leave awkward orphan columns or dead whitespace.
 */
export function getAdaptiveThreeColumnGrid(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count === 4) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

/**
 * Builds a safe WhatsApp click-to-chat URL with prefilled commercial message.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  const encodedMessage = encodeURIComponent(message.trim());
  return `https://wa.me/${digitsOnly}?text=${encodedMessage}`;
}
