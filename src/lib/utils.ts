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
 * Builds a safe WhatsApp click-to-chat URL with prefilled commercial message.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  const encodedMessage = encodeURIComponent(message.trim());
  return `https://wa.me/${digitsOnly}?text=${encodedMessage}`;
}
