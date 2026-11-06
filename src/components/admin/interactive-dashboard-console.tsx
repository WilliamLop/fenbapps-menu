"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  CalendarCheck,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Search,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Download,
  History,
  MapPin,
  Users,
  Building2,
  Pencil,
  Save,
  Sparkles,
  Bike,
  ShoppingBag,
  Banknote,
  CreditCard,
  Smartphone,
} from "lucide-react";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
} from "@/lib/utils";
import type {
  OperationalProductItem,
  OperationalInquiryItem,
  OperationalDirectOrderItem,
  OperationalAuditLogItem,
} from "@/modules/admin/queries";
import type {
  LocationRow,
  EventSpaceRow,
  EventPackageRow,
} from "@/modules/tenant/queries";
import {
  updateProductOperationalStateAction,
  updateEventInquiryOperationalStateAction,
  updateDirectOrderStatusAction,
} from "@/modules/admin/actions";

interface InteractiveDashboardConsoleProps {
  restaurantSlug: string;
  restaurantName: string;
  currencyCode: string;
  initialProducts: OperationalProductItem[];
  initialInquiries: OperationalInquiryItem[];
  initialDirectOrders: OperationalDirectOrderItem[];
  initialAuditLogs: OperationalAuditLogItem[];
  locations: LocationRow[];
  eventSpaces: EventSpaceRow[];
  eventPackages: EventPackageRow[];
}

const INQUIRY_STATUS_OPTIONS: Array<{
  value: OperationalInquiryItem["status"];
  label: string;
  badgeClass: string;
}> = [
  {
    value: "received",
    label: "Recibida (Nueva)",
    badgeClass: "bg-amber-warn/15 text-amber-warn border-amber-warn/30",
  },
  {
    value: "contacted",
    label: "Contactado / En Revisión",
    badgeClass: "bg-gold/15 text-ink border-gold/40",
  },
  {
    value: "quoted",
    label: "Propuesta / Cotización Enviada",
    badgeClass: "bg-ember/15 text-ember border-ember/30",
  },
  {
    value: "confirmed",
    label: "Confirmada con Anticipo",
    badgeClass: "bg-sage/15 text-sage border-sage/30",
  },
  {
    value: "archived",
    label: "Evento Realizado / Archivada",
    badgeClass: "bg-obsidian text-ivory border-obsidian",
  },
  {
    value: "rejected",
    label: "Declinada / Sin Cupo",
    badgeClass: "bg-canvas-muted text-ink-muted border-hairline",
  },
];

const DIRECT_ORDER_STATUS_OPTIONS: Array<{
  value: OperationalDirectOrderItem["status"];
  label: string;
  badgeClass: string;
}> = [
  {
    value: "received",
    label: "Recibido (Nuevo)",
    badgeClass: "bg-amber-warn/15 text-amber-warn border-amber-warn/30",
  },
  {
    value: "preparing",
    label: "En Cocina / Preparando",
    badgeClass: "bg-ember/15 text-ember border-ember/30",
  },
  {
    value: "dispatched",
    label: "En Camino / Listo para Recoger",
    badgeClass: "bg-gold/20 text-ink border-gold/40",
  },
  {
    value: "completed",
    label: "Entregado",
    badgeClass: "bg-sage/15 text-sage border-sage/30",
  },
  {
    value: "cancelled",
    label: "Cancelado",
    badgeClass: "bg-canvas-muted text-ink-muted border-hairline",
  },
];

const TIME_SLOT_LABELS: Record<string, string> = {
  breakfast: "Desayuno / Mañana",
  lunch: "Almuerzo (12:30 p. m. – 4:30 p. m.)",
  afternoon: "Tarde & Coctelería (4:30 p. m. – 7:30 p. m.)",
  dinner: "Cena Privada (7:30 p. m. – 11:30 p. m.)",
  full_evening: "Velada Completa",
  full_day: "Jornada Completa",
};

/**
 * Generates a deterministic 21x21 QR-style matrix from a target URL string
 * for visual table-tent previews and downloadable SVG badges.
 */
function generateDeterministicQrMatrix(seedText: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const row = grid[r0 + r];
        if (row) {
          row[c0 + c] = isBorder || isInner;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      if (r === 6 || c === 6) {
        const row = grid[r];
        if (row) row[c] = (r + c) % 2 === 0;
        continue;
      }

      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      const row = grid[r];
      if (row) {
        row[c] = (Math.abs(hash) + r * c) % 3 !== 0;
      }
    }
  }

  return grid;
}

export function InteractiveDashboardConsole({
  restaurantSlug,
  restaurantName,
  currencyCode,
  initialProducts,
  initialInquiries,
  initialDirectOrders,
  initialAuditLogs,
  locations,
  eventSpaces,
  eventPackages,
}: InteractiveDashboardConsoleProps) {
  const [activeTab, setActiveTab] = useState<
    "platos" | "pedidos" | "eventos" | "qr"
  >("platos");
  const [products, setProducts] =
    useState<OperationalProductItem[]>(initialProducts);
  const [inquiries, setInquiries] =
    useState<OperationalInquiryItem[]>(initialInquiries);
  const [directOrders, setDirectOrders] =
    useState<OperationalDirectOrderItem[]>(initialDirectOrders);
  const [auditLogs, setAuditLogs] =
    useState<OperationalAuditLogItem[]>(initialAuditLogs);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "sold_out" | "hidden"
  >("all");

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<string>("");

  const [inquiryNotesDraft, setInquiryNotesDraft] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const inq of initialInquiries) {
      map[inq.id] = inq.internal_admin_notes ?? "";
    }
    return map;
  });

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedQrKey, setCopiedQrKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableCount = products.filter(
    (p) => p.availability_status === "available"
  ).length;
  const soldOutCount = products.filter(
    (p) => p.availability_status === "sold_out"
  ).length;
  const hiddenCount = products.filter(
    (p) => p.availability_status === "hidden"
  ).length;

  const pendingInquiriesCount = inquiries.filter(
    (i) => i.status === "received" || i.status === "contacted"
  ).length;

  const activeOrdersCount = directOrders.filter(
    (o) =>
      o.status === "received" ||
      o.status === "preparing" ||
      o.status === "dispatched"
  ).length;

  const totalDirectSalesAmount = directOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((acc, o) => acc + Number(o.total_amount), 0);

  const estimatedCommissionSavings = Math.round(totalDirectSalesAmount * 0.28);

  const filteredProducts = products.filter((prod) => {
    if (statusFilter !== "all" && prod.availability_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        prod.name.toLowerCase().includes(q) ||
        prod.category_name.toLowerCase().includes(q) ||
        (prod.exclusive_location_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleAvailabilityChange(
    product: OperationalProductItem,
    newStatus: "available" | "sold_out" | "hidden"
  ) {
    if (product.availability_status === newStatus) return;

    const prevProducts = [...products];
    setProducts((curr) =>
      curr.map((p) =>
        p.id === product.id ? { ...p, availability_status: newStatus } : p
      )
    );

    startTransition(async () => {
      const res = await updateProductOperationalStateAction({
        restaurantSlug,
        productId: product.id,
        availabilityStatus: newStatus,
        basePrice: Number(product.base_price),
      });

      if (!res.ok) {
        setProducts(prevProducts);
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No se pudo actualizar el estado del plato.",
        });
        return;
      }

      const statusLabel =
        newStatus === "available"
          ? "Disponible"
          : newStatus === "sold_out"
            ? "Agotado por hoy"
            : "Oculto en carta";

      setAuditLogs((curr) => [
        {
          id: Date.now(),
          action: "product.operational_update",
          entity_type: "product",
          entity_id: product.id,
          previous_state: {
            name: product.name,
            availability_status: product.availability_status,
          },
          new_state: {
            name: product.name,
            availability_status: newStatus,
          },
          created_at: new Date().toISOString(),
        },
        ...curr.slice(0, 11),
      ]);

      setFeedbackBanner({
        type: "success",
        text: `¡Actualizado en vivo! "${product.name}" ahora está marcado como ${statusLabel} en la carta pública.`,
      });
    });
  }

  function handleSavePrice(product: OperationalProductItem) {
    const parsedPrice = Number(priceDraft.replace(/[^0-9]/g, ""));
    if (!parsedPrice || parsedPrice < 1000) {
      setFeedbackBanner({
        type: "error",
        text: "Ingresa un precio válido mayor a $1.000.",
      });
      return;
    }

    const prevProducts = [...products];
    setProducts((curr) =>
      curr.map((p) =>
        p.id === product.id ? { ...p, base_price: parsedPrice } : p
      )
    );
    setEditingPriceId(null);

    startTransition(async () => {
      const res = await updateProductOperationalStateAction({
        restaurantSlug,
        productId: product.id,
        availabilityStatus: product.availability_status,
        basePrice: parsedPrice,
      });

      if (!res.ok) {
        setProducts(prevProducts);
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No se pudo actualizar el precio.",
        });
        return;
      }

      setFeedbackBanner({
        type: "success",
        text: `Precio de "${product.name}" actualizado a ${formatCurrency(
          parsedPrice,
          currencyCode
        )} en tiempo real.`,
      });
    });
  }

  function handleUpdateInquiry(
    inquiry: OperationalInquiryItem,
    newStatus: OperationalInquiryItem["status"]
  ) {
    const notes = inquiryNotesDraft[inquiry.id] ?? "";
    const prevInquiries = [...inquiries];

    setInquiries((curr) =>
      curr.map((item) =>
        item.id === inquiry.id
          ? { ...item, status: newStatus, internal_admin_notes: notes }
          : item
      )
    );

    startTransition(async () => {
      const res = await updateEventInquiryOperationalStateAction({
        restaurantSlug,
        inquiryId: inquiry.id,
        status: newStatus,
        internalNotes: notes,
      });

      if (!res.ok) {
        setInquiries(prevInquiries);
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No fue posible actualizar la solicitud.",
        });
        return;
      }

      setAuditLogs((curr) => [
        {
          id: Date.now(),
          action: "event_inquiry.status_update",
          entity_type: "event_inquiry",
          entity_id: inquiry.id,
          previous_state: {
            reference_code: inquiry.reference_code,
            status: inquiry.status,
          },
          new_state: {
            reference_code: inquiry.reference_code,
            status: newStatus,
          },
          created_at: new Date().toISOString(),
        },
        ...curr.slice(0, 11),
      ]);

      setFeedbackBanner({
        type: "success",
        text: `Solicitud ${inquiry.reference_code} (${inquiry.customer_name}) actualizada correctamente.`,
      });
    });
  }

  function handleUpdateDirectOrder(
    order: OperationalDirectOrderItem,
    newStatus: OperationalDirectOrderItem["status"]
  ) {
    const prevOrders = [...directOrders];
    setDirectOrders((curr) =>
      curr.map((item) =>
        item.id === order.id ? { ...item, status: newStatus } : item
      )
    );

    startTransition(async () => {
      const res = await updateDirectOrderStatusAction({
        restaurantSlug,
        orderId: order.id,
        status: newStatus,
        internalNotes: order.internal_admin_notes ?? "",
      });

      if (!res.ok) {
        setDirectOrders(prevOrders);
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No fue posible actualizar el estado del pedido.",
        });
        return;
      }

      setAuditLogs((curr) => [
        {
          id: Date.now(),
          action: "direct_order.status_update",
          entity_type: "direct_order",
          entity_id: order.id,
          previous_state: {
            reference_code: order.reference_code,
            status: order.status,
          },
          new_state: {
            reference_code: order.reference_code,
            status: newStatus,
          },
          created_at: new Date().toISOString(),
        },
        ...curr.slice(0, 11),
      ]);

      setFeedbackBanner({
        type: "success",
        text: `Pedido ${order.reference_code} (${order.customer_name}) actualizado a estado "${
          DIRECT_ORDER_STATUS_OPTIONS.find((s) => s.value === newStatus)?.label
        }".`,
      });
    });
  }

  const qrTargets = [
    ...locations.map((loc, idx) => ({
      key: `menu-table-${loc.slug}`,
      badge:
        locations.length > 1
          ? `QR de Mesa · ${loc.name}`
          : "QR de Mesa · Salón Principal",
      title: `Carta en Mesa (${loc.name})`,
      subtitle:
        "Abre la carta limpia en Modo Mesa sin distractores de domicilio, pre-filtrada en esta sede.",
      relativeUrl: `/${restaurantSlug}/menu?sede=${loc.slug}&mesa=${idx + 1}`,
    })),
    {
      key: "direct-delivery",
      badge: "QR / Link Canal Propio 0% Comisión",
      title: `${restaurantName} · Pedidos a Domicilio & Recoger`,
      subtitle:
        "Ideal para perfil de Instagram, WhatsApp Business e impresos de empaque (abre directo en modo Domicilio).",
      relativeUrl: `/${restaurantSlug}/menu?modo=domicilio`,
    },
    {
      key: "events-dossier",
      badge: "QR Comercial Corporativo",
      title: "Dossier de Salones & Cotizador de Eventos",
      subtitle:
        "Para enviar a empresas, organizadores de eventos o ubicar cerca a los salones privados.",
      relativeUrl: `/${restaurantSlug}/eventos`,
    },
    {
      key: "brand-home",
      badge: "QR Portada & Historia",
      title: `${restaurantName} · Página Principal`,
      subtitle:
        "Ideal para tarjetas de presentación, prensa gastronómica y recepción.",
      relativeUrl: `/${restaurantSlug}`,
    },
  ];

  function copyQrLink(key: string, relativeUrl: string) {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    navigator.clipboard.writeText(`${origin}${relativeUrl}`);
    setCopiedQrKey(key);
    setTimeout(() => setCopiedQrKey(null), 2200);
  }

  function downloadTableTentSvg(target: (typeof qrTargets)[number]) {
    const matrix = generateDeterministicQrMatrix(target.relativeUrl);
    const cellSize = 10;
    const offset = 40;
    let rects = "";
    matrix.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell) {
          rects += `<rect x="${offset + cIdx * cellSize}" y="${
            90 + rIdx * cellSize
          }" width="${cellSize}" height="${cellSize}" rx="2" fill="#14110F" />`;
        }
      });
    });

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 380" width="580" height="760">
      <rect width="290" height="380" rx="24" fill="#FAF6F0" stroke="#E4DDD3" stroke-width="4"/>
      <text x="145" y="42" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#14110F">${restaurantName}</text>
      <text x="145" y="64" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#B84A24" letter-spacing="1.5">${target.badge.toUpperCase()}</text>
      <rect x="30" y="80" width="230" height="230" rx="16" fill="#FFFFFF" stroke="#E4DDD3" stroke-width="2"/>
      ${rects}
      <text x="145" y="336" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#14110F">${target.title}</text>
      <text x="145" y="356" text-anchor="middle" font-family="monospace" font-size="9" fill="#6E655F">${target.relativeUrl}</text>
    </svg>`;

    const blob = new Blob([svgContent], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-${restaurantSlug}-${target.key}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Live Operational Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Platos Disponibles
            </span>
            <CheckCircle2 className="size-4 text-sage" />
          </div>
          <p className="tabular-price mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {availableCount}{" "}
            <span className="text-base font-normal text-ink-muted">
              / {soldOutCount} agotados
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {hiddenCount} ocultos · Control en 1 clic
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pedidos Directos (0% Comisión)
            </span>
            <Bike className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {directOrders.length}
          </p>
          <p className="mt-1 text-xs font-medium text-sage">
            {activeOrdersCount} activos ·{" "}
            {formatCurrency(totalDirectSalesAmount, currencyCode)} vendidos
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Solicitudes Eventos
            </span>
            <CalendarCheck className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {inquiries.length}
          </p>
          <p className="mt-1 text-xs text-ember font-medium">
            {pendingInquiriesCount} por responder o cotizar
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Sedes & Canales QR
            </span>
            <QrCode className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {locations.length}{" "}
            <span className="text-lg font-normal text-ink-muted">
              {locations.length === 1 ? "sede" : "sedes"} ·{" "}
              {eventSpaces.length} salones
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {locations.length === 1
              ? "Modo Sede Única adaptativo activo"
              : "Modo Multi-Sede con diferenciales"}
          </p>
        </div>
      </div>

      {/* Live Feedback Banner (Never renders Carta link on error!) */}
      {feedbackBanner && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-sm ${
            feedbackBanner.type === "success"
              ? "border-sage/40 bg-sage/10 text-ink"
              : "border-crimson/40 bg-crimson/10 text-crimson"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === "success" ? (
              <Sparkles className="size-4 shrink-0 text-ember" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-crimson" />
            )}
            <span className="font-medium">{feedbackBanner.text}</span>
          </div>
          <div className="flex items-center gap-3">
            {feedbackBanner.type === "success" && activeTab === "platos" && (
              <Link
                href={`/${restaurantSlug}/menu`}
                className="inline-flex items-center gap-1 rounded-full bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
              >
                <span>Ver cambio en Carta Digital</span>
                <ExternalLink className="size-3" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Console Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Módulos de la consola operativa"
        className="flex flex-wrap gap-2 border-b border-hairline pb-4"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "platos"}
          onClick={() => setActiveTab("platos")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "platos"
              ? "bg-obsidian text-ivory shadow-sm"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <UtensilsCrossed className="size-4 text-ember" />
          <span>1. Disponibilidad & Precios ({products.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pedidos"}
          onClick={() => setActiveTab("pedidos")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "pedidos"
              ? "bg-obsidian text-ivory shadow-sm"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <Bike className="size-4 text-ember" />
          <span>2. Pedidos & Domicilios ({directOrders.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "eventos"}
          onClick={() => setActiveTab("eventos")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "eventos"
              ? "bg-obsidian text-ivory shadow-sm"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <CalendarCheck className="size-4 text-ember" />
          <span>3. Mini-CRM de Solicitudes de Eventos ({inquiries.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "qr"}
          onClick={() => setActiveTab("qr")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "qr"
              ? "bg-obsidian text-ivory shadow-sm"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <QrCode className="size-4 text-ember" />
          <span>4. Códigos QR Inteligentes ({qrTargets.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE CATALOG & 1-CLICK AVAILABILITY ("86ing") */}
      {activeTab === "platos" && (
        <div className="overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated">
          <div className="flex flex-col gap-4 border-b border-hairline px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">
                Control de Disponibilidad en Cocina y Precios
              </h2>
              <p className="text-xs text-ink-muted">
                Marca un plato como <strong>Agotado hoy</strong> u{" "}
                <strong>Oculto</strong> en 1 clic. El cambio se guarda en
                PostgreSQL y actualiza la carta al instante.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar plato o sede..."
                  className="h-10 w-full rounded-full border border-hairline bg-canvas pl-9 pr-4 text-xs text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
                />
              </div>

              <div className="flex rounded-full border border-hairline bg-canvas p-1 text-xs">
                {(
                  [
                    { id: "all", label: "Todos" },
                    { id: "available", label: "Disponibles" },
                    { id: "sold_out", label: "Agotados" },
                    { id: "hidden", label: "Ocultos" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      statusFilter === tab.id
                        ? "bg-obsidian text-ivory"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Responsive Cards (< md) */}
          <div className="divide-y divide-hairline md:hidden">
            {filteredProducts.map((product) => (
              <div key={product.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ember">
                      {product.category_name}
                    </span>
                    <h3 className="font-semibold text-ink">{product.name}</h3>
                    {product.exclusive_location_name && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember">
                        <MapPin className="size-2.5" />
                        Exclusivo {product.exclusive_location_name}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    {editingPriceId === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={priceDraft}
                          onChange={(e) =>
                            setPriceDraft(
                              sanitizeNumericInput(e.target.value, 8)
                            )
                          }
                          className="w-24 rounded-lg border border-ember bg-canvas px-2 py-1 font-mono text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePrice(product)}
                          className="rounded-lg bg-ember p-1.5 text-ivory"
                          aria-label="Guardar precio"
                        >
                          <Save className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceId(product.id);
                          setPriceDraft(String(product.base_price));
                        }}
                        className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-ink hover:text-ember"
                      >
                        <span>
                          {formatCurrency(
                            Number(product.base_price),
                            currencyCode
                          )}
                        </span>
                        <Pencil className="size-3 text-ink-muted" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleAvailabilityChange(product, "available")
                    }
                    className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                      product.availability_status === "available"
                        ? "bg-sage text-ivory shadow-xs"
                        : "border border-hairline bg-canvas text-ink-muted"
                    }`}
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleAvailabilityChange(product, "sold_out")
                    }
                    className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                      product.availability_status === "sold_out"
                        ? "bg-amber-warn text-ivory shadow-xs"
                        : "border border-hairline bg-canvas text-ink-muted"
                    }`}
                  >
                    Agotado hoy
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAvailabilityChange(product, "hidden")}
                    className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                      product.availability_status === "hidden"
                        ? "bg-obsidian text-ivory shadow-xs"
                        : "border border-hairline bg-canvas text-ink-muted"
                    }`}
                  >
                    Ocultar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Operational Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas/60 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3.5">Plato / Referencia</th>
                  <th className="px-6 py-3.5">Categoría & Sede</th>
                  <th className="px-6 py-3.5">Control de Estado en Vivo</th>
                  <th className="px-6 py-3.5 text-right">Precio en Carta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-canvas/40 transition"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink">{product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {product.portion_label ?? "Porción estándar"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-muted">
                      <span className="font-medium text-ink">
                        {product.category_name}
                      </span>
                      {product.exclusive_location_name ? (
                        <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-ember/15 px-2.5 py-0.5 text-[10px] font-semibold text-ember">
                          <MapPin className="size-2.5" />
                          Exclusivo {product.exclusive_location_name}
                        </span>
                      ) : (
                        <span className="block text-[11px] text-ink-faint">
                          Disponible en todas las sedes
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex rounded-full border border-hairline bg-canvas p-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleAvailabilityChange(product, "available")
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            product.availability_status === "available"
                              ? "bg-sage text-ivory shadow-xs"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          Disponible
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleAvailabilityChange(product, "sold_out")
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            product.availability_status === "sold_out"
                              ? "bg-amber-warn text-ivory shadow-xs"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          Agotado hoy
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleAvailabilityChange(product, "hidden")
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            product.availability_status === "hidden"
                              ? "bg-obsidian text-ivory shadow-xs"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <EyeOff className="size-3" />
                          Oculto
                        </button>
                      </div>
                    </td>
                    <td className="tabular-price px-6 py-4 text-right font-mono font-semibold text-ink">
                      {editingPriceId === product.id ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={priceDraft}
                            onChange={(e) =>
                              setPriceDraft(
                                sanitizeNumericInput(e.target.value, 8)
                              )
                            }
                            className="w-28 rounded-xl border border-ember bg-canvas px-2.5 py-1 text-right font-mono text-xs text-ink focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePrice(product)}
                            className="inline-flex items-center gap-1 rounded-xl bg-ember px-2.5 py-1 font-sans text-xs font-semibold text-ivory hover:bg-ember-hover"
                          >
                            <Save className="size-3.5" />
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceId(null)}
                            className="font-sans text-xs text-ink-muted hover:text-ink"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(product.id);
                            setPriceDraft(String(product.base_price));
                          }}
                          title="Haz clic para editar el precio en vivo"
                          className="inline-flex items-center justify-end gap-1.5 rounded-xl px-2.5 py-1 transition hover:bg-canvas"
                        >
                          <span>
                            {formatCurrency(
                              Number(product.base_price),
                              currencyCode
                            )}
                          </span>
                          <Pencil className="size-3.5 text-ink-muted" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE DIRECT ORDERS & COMMISSION-FREE DELIVERY CONSOLE */}
      {activeTab === "pedidos" && (
        <div className="space-y-6">
          {/* Commercial ROI Banner */}
          <div className="grid grid-cols-1 gap-4 rounded-3xl border border-obsidian-border bg-obsidian p-5 text-ivory sm:grid-cols-3 sm:p-6">
            <div className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                Canal Propio 0% Comisión · Impacto Directo en Margen
              </span>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ivory sm:text-3xl">
                Bandeja de Domicilios & Pedidos Para Recoger
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ivory-muted">
                Cada pedido recibido aquí se registra en{" "}
                <code className="text-gold">public.direct_orders</code> con
                medio de pago (Efectivo y vueltas exactas, Datáfono o
                Transferencia) sin pagar el ~28% de comisión de plataformas
                externas.
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-obsidian-border bg-obsidian-card px-4 py-3 text-right">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ivory-muted">
                Ahorro estimado en comisiones
              </span>
              <span className="tabular-price mt-0.5 font-mono text-2xl font-bold text-sage">
                + {formatCurrency(estimatedCommissionSavings, currencyCode)}
              </span>
              <span className="text-[11px] text-ivory-muted">
                sobre {formatCurrency(totalDirectSalesAmount, currencyCode)} en
                ventas directas
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <h3 className="font-display text-2xl font-semibold text-ink">
                Órdenes Registradas ({directOrders.length})
              </h3>
              <Link
                href={`/${restaurantSlug}/menu?modo=domicilio`}
                className="inline-flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
              >
                <Bike className="size-3.5" />
                <span>Simular nuevo domicilio en la Carta →</span>
              </Link>
            </div>

            {directOrders.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-hairline bg-canvas p-6 text-center text-sm text-ink-muted">
                Aún no hay pedidos directos registrados. Haz clic arriba en
                &ldquo;Simular nuevo domicilio en la Carta&rdquo; para probar el
                flujo completo.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5">
                {directOrders.map((order) => {
                  const statusMeta =
                    DIRECT_ORDER_STATUS_OPTIONS.find(
                      (s) => s.value === order.status
                    ) ?? DIRECT_ORDER_STATUS_OPTIONS[0]!;

                  const paymentIcon =
                    order.payment_method === "cash" ? (
                      <Banknote className="size-3.5 text-sage" />
                    ) : order.payment_method === "card_dataphone" ? (
                      <CreditCard className="size-3.5 text-ember" />
                    ) : (
                      <Smartphone className="size-3.5 text-gold" />
                    );

                  const paymentLabel =
                    order.payment_method === "cash"
                      ? "Efectivo"
                      : order.payment_method === "card_dataphone"
                        ? "Tarjeta / Datáfono"
                        : "Transferencia";

                  const statusUpdateWaMsg = [
                    `Hola ${order.customer_name}, te escribimos de *${restaurantName}*.`,
                    `Tu pedido *${order.reference_code}* por *${formatCurrency(
                      Number(order.total_amount),
                      currencyCode
                    )}* se encuentra en estado: *${statusMeta.label}*.`,
                    order.fulfillment_type === "delivery" &&
                    order.delivery_address
                      ? `Dirección registrada: ${order.delivery_address}${
                          order.delivery_neighborhood
                            ? ` (${order.delivery_neighborhood})`
                            : ""
                        }.`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("\n");

                  const customerWaHref = buildWhatsAppUrl(
                    order.customer_phone,
                    statusUpdateWaMsg
                  );

                  return (
                    <article
                      key={order.id}
                      className="rounded-3xl border border-hairline bg-canvas p-5 sm:p-6 transition hover:border-ember/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-obsidian px-2.5 py-1 font-mono text-xs font-bold text-gold">
                              {order.reference_code}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
                                order.fulfillment_type === "delivery"
                                  ? "bg-ember/15 text-ember"
                                  : "bg-obsidian/10 text-ink"
                              }`}
                            >
                              {order.fulfillment_type === "delivery" ? (
                                <>
                                  <Bike className="size-3" />
                                  <span>A Domicilio</span>
                                </>
                              ) : (
                                <>
                                  <ShoppingBag className="size-3" />
                                  <span>Para Recoger</span>
                                </>
                              )}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <h4 className="font-display text-2xl font-semibold text-ink">
                            {order.customer_name} ·{" "}
                            <span className="font-mono text-sm font-normal text-ink-muted">
                              {order.customer_phone}
                            </span>
                          </h4>
                        </div>

                        <div className="rounded-2xl border border-hairline bg-canvas-elevated px-4 py-2 text-right">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                            Total Orden
                          </span>
                          <span className="tabular-price font-mono text-lg font-bold text-ink">
                            {formatCurrency(
                              Number(order.total_amount),
                              currencyCode
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {/* Column 1: Items */}
                        <div className="space-y-1.5 text-xs">
                          <p className="font-semibold uppercase tracking-wider text-ink-muted">
                            Platos Solicitados
                          </p>
                          <ul className="space-y-1">
                            {(Array.isArray(order.items) ? order.items : []).map(
                              (item, idx) => (
                                <li
                                  key={`${order.id}-item-${idx}`}
                                  className="text-ink"
                                >
                                  <strong>{item.quantity}x</strong> {item.name}
                                  {item.options && item.options.length > 0 && (
                                    <span className="block text-[11px] text-ink-muted">
                                      ({item.options.join(", ")})
                                    </span>
                                  )}
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        {/* Column 2: Delivery / Pickup & Payment Details */}
                        <div className="space-y-1.5 text-xs">
                          <p className="font-semibold uppercase tracking-wider text-ink-muted">
                            Entrega & Medio de Pago
                          </p>
                          {order.location_name && (
                            <p className="font-medium text-ink">
                              📍 Sede: {order.location_name}
                            </p>
                          )}
                          {order.fulfillment_type === "delivery" ? (
                            <p className="text-ink">
                              🏠 <strong>{order.delivery_address}</strong>
                              {order.delivery_neighborhood
                                ? ` · ${order.delivery_neighborhood}`
                                : ""}
                            </p>
                          ) : (
                            <p className="text-ink">
                              🕒 Paso estimado:{" "}
                              <strong>
                                {order.pickup_slot ?? "Lo antes posible"}
                              </strong>
                            </p>
                          )}

                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-canvas-elevated px-2.5 py-1.5 font-medium text-ink">
                            {paymentIcon}
                            <span>
                              {order.payment_details ?? paymentLabel}
                            </span>
                          </div>

                          {order.delivery_notes && (
                            <p className="rounded-xl bg-canvas-elevated p-2 text-ink-muted italic">
                              &ldquo;{order.delivery_notes}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Column 3: Operational Status Control + WhatsApp */}
                        <div className="space-y-2.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            Estado en Cocina / Despacho
                          </label>
                          <select
                            value={order.status}
                            disabled={isPending}
                            onChange={(e) =>
                              handleUpdateDirectOrder(
                                order,
                                e.target
                                  .value as OperationalDirectOrderItem["status"]
                              )
                            }
                            aria-label={`Estado del pedido ${order.reference_code}`}
                            className="h-10 w-full rounded-xl border border-hairline bg-canvas-elevated px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                          >
                            {DIRECT_ORDER_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <a
                            href={customerWaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full bg-ember px-3.5 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                          >
                            <MessageCircle className="size-3.5" />
                            <span>Avisar estado por WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MINI-CRM DE SOLICITUDES DE EVENTOS */}
      {activeTab === "eventos" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
                  Bandeja Comercial Aislada por Tenant (RLS)
                </span>
                <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                  Solicitudes de Eventos & Celebraciones ({inquiries.length})
                </h2>
              </div>
              <Link
                href={`/${restaurantSlug}/eventos#solicitud-cotizacion-eventos`}
                className="inline-flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
              >
                <CalendarCheck className="size-3.5" />
                <span>Crear nueva solicitud de prueba →</span>
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5">
              {inquiries.map((inq) => {
                const statusMeta =
                  INQUIRY_STATUS_OPTIONS.find((s) => s.value === inq.status) ??
                  INQUIRY_STATUS_OPTIONS[0]!;
                const estimatedBudget =
                  inq.package_base_price && inq.guest_count
                    ? Number(inq.package_base_price) * inq.guest_count
                    : null;

                const coordinatorWaMessage = [
                  `Hola ${inq.customer_name}, te saludamos del equipo de Eventos y Hospitalidad de *${restaurantName}*.`,
                  `Recibimos tu solicitud con código *${inq.reference_code}* para tu *${inq.event_type}* (${inq.guest_count} invitados, fecha tentativa ${inq.tentative_date}).`,
                  inq.event_space_name
                    ? `Espacio solicitado: ${inq.event_space_name}${
                        inq.location_name ? ` (${inq.location_name})` : ""
                      }.`
                    : null,
                  estimatedBudget
                    ? `Presupuesto base estimado según el paquete elegido: ${formatCurrency(
                        estimatedBudget,
                        currencyCode
                      )}.`
                    : null,
                  `¿Tienes unos minutos para confirmar los detalles del montaje y enviarte la propuesta formal?`,
                ]
                  .filter(Boolean)
                  .join("\n");

                const clientWhatsAppHref = buildWhatsAppUrl(
                  inq.customer_phone,
                  coordinatorWaMessage
                );

                return (
                  <article
                    key={inq.id}
                    className="rounded-3xl border border-hairline bg-canvas p-5 sm:p-6 transition hover:border-ember/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-obsidian px-2.5 py-1 font-mono text-xs font-bold text-gold">
                            {inq.reference_code}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="text-xs text-ink-muted">
                            Fecha tentativa:{" "}
                            <strong className="text-ink">
                              {inq.tentative_date}
                            </strong>{" "}
                            ·{" "}
                            {TIME_SLOT_LABELS[inq.preferred_time_slot] ??
                              inq.preferred_time_slot}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                          {inq.event_type} · {inq.guest_count} invitados
                        </h3>
                      </div>

                      {estimatedBudget && (
                        <div className="rounded-2xl border border-hairline bg-canvas-elevated px-4 py-2 text-right">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                            Valor Estimado Paquete
                          </span>
                          <span className="tabular-price font-mono text-lg font-bold text-ember">
                            {formatCurrency(estimatedBudget, currencyCode)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold uppercase tracking-wider text-ink-muted">
                          Datos del Cliente
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          {inq.customer_name}
                        </p>
                        {inq.company_name && (
                          <p className="flex items-center gap-1 text-ink-muted">
                            <Building2 className="size-3.5 text-ember" />
                            <span>{inq.company_name}</span>
                          </p>
                        )}
                        <p className="font-mono text-ink-muted">
                          Tel: {inq.customer_phone}
                        </p>
                        {inq.customer_email && (
                          <p className="text-ink-muted">{inq.customer_email}</p>
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-semibold uppercase tracking-wider text-ink-muted">
                          Sede, Salón & Experiencia
                        </p>
                        <p className="font-medium text-ink">
                          📍 {inq.location_name ?? "Sede por definir"}
                        </p>
                        <p className="text-ink-muted">
                          🏛️ Salón:{" "}
                          <strong className="text-ink">
                            {inq.event_space_name ?? "A sugerir por capacidad"}
                          </strong>
                        </p>
                        <p className="text-ink-muted">
                          🍷 Paquete:{" "}
                          <strong className="text-ink">
                            {inq.event_package_name ?? "Cotización a medida"}
                          </strong>
                        </p>
                        {inq.special_requests && (
                          <p className="mt-1.5 rounded-xl bg-canvas-elevated p-2.5 text-ink-muted italic">
                            &ldquo;{inq.special_requests}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                          Estado Comercial & Notas Internas
                        </label>
                        <select
                          value={inq.status}
                          disabled={isPending}
                          aria-label={`Estado comercial de ${inq.reference_code}`}
                          onChange={(e) =>
                            handleUpdateInquiry(
                              inq,
                              e.target.value as OperationalInquiryItem["status"]
                            )
                          }
                          className="h-10 w-full rounded-xl border border-hairline bg-canvas-elevated px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                        >
                          {INQUIRY_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <textarea
                          rows={2}
                          value={inquiryNotesDraft[inq.id] ?? ""}
                          onChange={(e) =>
                            setInquiryNotesDraft((prev) => ({
                              ...prev,
                              [inq.id]: e.target.value,
                            }))
                          }
                          placeholder="Notas de coordinación (ej. se envió PDF, requiere anticipo)..."
                          className="w-full rounded-xl border border-hairline bg-canvas-elevated p-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleUpdateInquiry(inq, inq.status)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
                          >
                            <Save className="size-3.5" />
                            <span>Guardar nota</span>
                          </button>

                          <a
                            href={clientWhatsAppHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-ember px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                          >
                            <MessageCircle className="size-3.5" />
                            <span>Responder por WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Configured Spaces & Packages Overview */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6">
              <h3 className="font-display text-2xl font-semibold text-ink">
                Salones Activos ({eventSpaces.length})
              </h3>
              <div className="mt-4 space-y-3">
                {eventSpaces.map((space) => (
                  <div
                    key={space.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas p-3.5"
                  >
                    <div>
                      <p className="font-semibold text-ink">{space.name}</p>
                      <p className="text-xs text-ink-muted">{space.subtitle}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-canvas-muted px-3 py-1 text-xs font-medium text-ink">
                      <Users className="size-3.5 text-ember" />
                      {space.min_guests}–{space.capacity_seated} pax
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6">
              <h3 className="font-display text-2xl font-semibold text-ink">
                Paquetes de Experiencias ({eventPackages.length})
              </h3>
              <div className="mt-4 space-y-3">
                {eventPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas p-3.5"
                  >
                    <div>
                      <p className="font-semibold text-ink">{pkg.name}</p>
                      <p className="text-xs text-ink-muted">
                        {pkg.min_guests} a {pkg.max_guests ?? 95} invitados
                      </p>
                    </div>
                    <span className="tabular-price font-mono text-sm font-semibold text-ember">
                      {pkg.base_price
                        ? `${formatCurrency(
                            Number(pkg.base_price),
                            currencyCode
                          )} / pax`
                        : "A medida"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SMART QR GENERATOR PER LOCATION & CHANNEL */}
      {activeTab === "qr" && (
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
              Kit de Mesa, Redes Sociales & Empaques
            </span>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
              Generador de Códigos QR Contextuales por Canal
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Los QRs de mesa usan{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs text-ember">
                ?sede=...&amp;mesa=...
              </code>{" "}
              para abrir la carta limpia en Modo Mesa, mientras el QR de
              domicilios usa{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs text-ember">
                ?modo=domicilio
              </code>{" "}
              para activar el checkout directo de inmediato.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {qrTargets.map((target) => {
              const matrix = generateDeterministicQrMatrix(target.relativeUrl);
              return (
                <div
                  key={target.key}
                  className="flex flex-col justify-between rounded-3xl border border-hairline bg-canvas p-5 sm:flex-row sm:items-center gap-5"
                >
                  <div className="mx-auto flex flex-col items-center rounded-2xl border border-hairline bg-white p-3.5 shadow-xs sm:mx-0 shrink-0">
                    <svg
                      viewBox="0 0 21 21"
                      className="size-28"
                      aria-label={`Código QR para ${target.title}`}
                    >
                      {matrix.map((row, rIdx) =>
                        row.map((cell, cIdx) =>
                          cell ? (
                            <rect
                              key={`${rIdx}-${cIdx}`}
                              x={cIdx}
                              y={rIdx}
                              width={0.92}
                              height={0.92}
                              rx={0.18}
                              fill="#14110F"
                            />
                          ) : null
                        )
                      )}
                    </svg>
                    <span className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-muted">
                      QR INTELIGENTE
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <span className="inline-block rounded-full bg-ember/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ember">
                      {target.badge}
                    </span>
                    <h3 className="font-display text-xl font-semibold text-ink">
                      {target.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {target.subtitle}
                    </p>
                    <p className="rounded-xl bg-canvas-elevated px-3 py-1.5 font-mono text-[11px] text-ink">
                      {target.relativeUrl}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Link
                        href={target.relativeUrl}
                        className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
                      >
                        <span>Probar QR en vivo</span>
                        <ExternalLink className="size-3" />
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          copyQrLink(target.key, target.relativeUrl)
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas-elevated px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ember"
                      >
                        {copiedQrKey === target.key ? (
                          <>
                            <Check className="size-3.5 text-sage" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 text-ink-muted" />
                            <span>Copiar URL</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadTableTentSvg(target)}
                        className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas-elevated px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ember"
                      >
                        <Download className="size-3.5 text-ember" />
                        <span>Descargar Hablador SVG</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forensic Audit Logs & Multi-Tenant RLS Footer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6 lg:col-span-7">
          <div className="flex items-center gap-2 text-ink">
            <History className="size-4 text-ember" />
            <h3 className="font-display text-xl font-semibold">
              Bitácora Forense de Cambios en Tiempo Real (`audit_logs`)
            </h3>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Cada cambio de disponibilidad, precio, pedido directo o cotización
            queda registrado con su estado anterior y nuevo.
          </p>

          {auditLogs.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-hairline bg-canvas p-4 text-xs text-ink-muted">
              Aún no hay cambios registrados en esta sesión. Prueba cambiando un
              plato, el estado de un domicilio o una solicitud de evento arriba.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-ember">
                      {log.action}
                    </span>
                    <p className="mt-0.5 text-ink-muted">
                      {log.previous_state && log.new_state
                        ? `${JSON.stringify(log.previous_state)} → ${JSON.stringify(
                            log.new_state
                          )}`
                        : `Entidad: ${log.entity_type}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                    {new Date(log.created_at).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-obsidian-border bg-obsidian p-6 text-ivory lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-gold">
              <ShieldCheck className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                Arquitectura Segura Multi-Tenant
              </span>
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-ivory">
              Aislamiento PostgreSQL RLS + RPC Transaccional
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ivory-muted">
              Las tablas públicas mantienen{" "}
              <code className="text-gold">FORCE ROW LEVEL SECURITY</code> contra
              accesos anónimos directos (cero exposición de PII en{" "}
              <code className="text-gold">event_inquiries</code> y{" "}
              <code className="text-gold">direct_orders</code>), mientras las
              acciones operativas pasan por funciones validadas con trazabilidad
              en <code className="text-gold">public.audit_logs</code>.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-obsidian-border pt-4">
            <Link
              href="/dashboard/casa-brasa"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                restaurantSlug === "casa-brasa"
                  ? "bg-ember text-ivory"
                  : "bg-obsidian-card text-ivory-muted hover:text-ivory"
              }`}
            >
              🔥 Consola Casa Brasa (2 Sedes)
            </Link>
            <Link
              href="/dashboard/botanica-brunch"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                restaurantSlug === "botanica-brunch"
                  ? "bg-ember text-ivory"
                  : "bg-obsidian-card text-ivory-muted hover:text-ivory"
              }`}
            >
              🌿 Consola Botánica (1 Sola Sede)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
