"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  UtensilsCrossed,
  CalendarCheck,
  QrCode,
  ShieldCheck,
  ShieldAlert,
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
  Lock,
  Layers,
  Crown,
  Globe,
  Plus,
  Trash2,
  FolderEdit,
  ChevronLeft,
  ChevronRight,
  Award,
  Flame,
} from "lucide-react";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
} from "@/lib/utils";
import { TIME_SLOT_LABELS } from "@/lib/validators/events";
import {
  PLAN_TIERS_META,
  type EffectiveCapabilities,
  type SimPlanPreset,
} from "@/lib/saas-entitlements";
import type {
  OperationalCategoryItem,
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
  setSimPlanCookieAction,
  adminDeleteProductAction,
} from "@/modules/admin/actions";
import {
  CatalogFacetedFilters,
  INITIAL_FACETED_FILTER_STATE,
  type FacetedFilterState,
} from "./catalog-faceted-filters";
import { ProductEditorModal } from "./product-editor-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";

type ConsoleTabId = "platos" | "pedidos" | "eventos" | "qr";

interface InteractiveDashboardConsoleProps {
  restaurantSlug: string;
  restaurantName: string;
  currencyCode: string;
  capabilities: EffectiveCapabilities;
  selectedLocation?: LocationRow | null;
  initialTab?: string;
  deliveryEnabled?: boolean;
  initialCategories?: OperationalCategoryItem[];
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
    badgeClass: "bg-amber-warn/15 text-amber-warn border-amber-warn/35",
  },
  {
    value: "contacted",
    label: "Contactado / En Revisión",
    badgeClass: "bg-surface-accent text-accent-ink border-ember/30",
  },
  {
    value: "quoted",
    label: "Propuesta / Cotización Enviada",
    badgeClass: "bg-ember/15 text-ember border-ember/35",
  },
  {
    value: "confirmed",
    label: "Confirmada con Anticipo",
    badgeClass: "bg-sage/15 text-sage border-sage/35",
  },
  {
    value: "archived",
    label: "Evento Realizado / Archivada",
    badgeClass: "bg-ink text-ivory border-ink",
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
    badgeClass: "bg-amber-warn/15 text-amber-warn border-amber-warn/35",
  },
  {
    value: "preparing",
    label: "En Cocina / Preparando",
    badgeClass: "bg-ember/15 text-ember border-ember/35",
  },
  {
    value: "dispatched",
    label: "En Camino / Listo para Recoger",
    badgeClass: "bg-surface-accent text-accent-ink border-ember/30",
  },
  {
    value: "completed",
    label: "Entregado",
    badgeClass: "bg-sage/15 text-sage border-sage/35",
  },
  {
    value: "cancelled",
    label: "Cancelado",
    badgeClass: "bg-canvas-muted text-ink-muted border-hairline",
  },
];

function resolveInitialTab(raw?: string): ConsoleTabId {
  if (
    raw === "platos" ||
    raw === "pedidos" ||
    raw === "eventos" ||
    raw === "qr"
  ) {
    return raw;
  }
  return "platos";
}

/**
 * Generates a real, 100% scannable ISO/IEC 18004 QR matrix using the `qrcode`
 * library with Reed-Solomon Level M error correction.
 */
export function generateRealQrMatrix(targetUrl: string): boolean[][] {
  const qr = QRCode.create(targetUrl || "https://fenbapps.com", {
    errorCorrectionLevel: "M",
  });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const grid: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Boolean(data[r * size + c]));
    }
    grid.push(row);
  }
  return grid;
}

export function InteractiveDashboardConsole({
  restaurantSlug,
  restaurantName,
  currencyCode,
  capabilities,
  selectedLocation = null,
  initialTab,
  deliveryEnabled = true,
  initialCategories = [],
  initialProducts,
  initialInquiries,
  initialDirectOrders,
  initialAuditLogs,
  locations,
  eventSpaces,
  eventPackages,
}: InteractiveDashboardConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConsoleTabId>(() =>
    resolveInitialTab(initialTab)
  );
  const [categories, setCategories] = useState<OperationalCategoryItem[]>(() =>
    initialCategories && initialCategories.length > 0
      ? initialCategories
      : Array.from(
          new Map(
            initialProducts.map((p) => [
              p.category_id,
              {
                id: p.category_id,
                menu_id: "menu-default",
                slug: p.category_id,
                name: p.category_name,
                subtitle: null,
                description: null,
                display_mode: "editorial_grid" as const,
                is_active: true,
                sort_order: 1,
                products_count: initialProducts.filter(
                  (item) => item.category_id === p.category_id
                ).length,
              },
            ])
          ).values()
        )
  );
  const [products, setProducts] =
    useState<OperationalProductItem[]>(initialProducts);
  const [inquiries, setInquiries] =
    useState<OperationalInquiryItem[]>(initialInquiries);
  const [directOrders, setDirectOrders] =
    useState<OperationalDirectOrderItem[]>(initialDirectOrders);
  const [auditLogs, setAuditLogs] =
    useState<OperationalAuditLogItem[]>(initialAuditLogs);

  // Faceted Filter State
  const [facetedFilters, setFacetedFilters] = useState<FacetedFilterState>(
    INITIAL_FACETED_FILTER_STATE
  );
  const [isFacetedExpanded, setIsFacetedExpanded] = useState(false);

  // Modals State
  const [productToEdit, setProductToEdit] =
    useState<OperationalProductItem | null>(null);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<OperationalProductItem | null>(null);

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

  const isMultiLocation = locations.length > 1;
  const uniqueCities = Array.from(
    new Set(locations.map((l) => l.city).filter(Boolean))
  );
  const isReadOnlyMutations =
    !capabilities.catalogMutationsEnabled ||
    capabilities.isVitrineOnly ||
    capabilities.isSuspended;

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

  // Faceted Filtering & Sorting for 100+ dishes
  const processedProducts = useMemo(() => {
    let list = [...products];

    // 1. Text Search
    if (facetedFilters.searchQuery.trim().length > 0) {
      const q = facetedFilters.searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const catMatch = p.category_name.toLowerCase().includes(q);
        const portionMatch = (p.portion_label ?? "").toLowerCase().includes(q);
        const descMatch = (p.short_description ?? "").toLowerCase().includes(q);
        const locMatch = (p.exclusive_location_name ?? "")
          .toLowerCase()
          .includes(q);
        const badgeMatch = (p.badges ?? []).some((b) =>
          b.toLowerCase().includes(q)
        );
        return (
          nameMatch ||
          catMatch ||
          portionMatch ||
          descMatch ||
          locMatch ||
          badgeMatch
        );
      });
    }

    // 2. Category Filter
    if (facetedFilters.categoryId !== "all") {
      list = list.filter((p) => p.category_id === facetedFilters.categoryId);
    }

    // 3. Availability Status Filter
    if (facetedFilters.availabilityStatus !== "all") {
      list = list.filter(
        (p) => p.availability_status === facetedFilters.availabilityStatus
      );
    }

    // 4. Regional Price Differential Filter
    if (facetedFilters.onlyRegionalDiff) {
      list = list.filter((p) => {
        if (selectedLocation) {
          return (
            p.price_override != null &&
            p.global_base_price != null &&
            Number(p.price_override) !== Number(p.global_base_price)
          );
        }
        return (p.location_overrides_count ?? 0) > 0;
      });
    }

    // 5. Insignias / Flags Filters
    if (facetedFilters.onlyFeatured) {
      list = list.filter((p) => p.is_featured);
    }
    if (facetedFilters.onlyChefChoice) {
      list = list.filter((p) => p.is_chef_choice);
    }
    if (facetedFilters.onlyNew) {
      list = list.filter((p) => Boolean(p.is_new));
    }
    if (facetedFilters.onlyWithOptions) {
      list = list.filter((p) => (p.option_groups ?? []).length > 0);
    }

    // 6. Price Range Filters
    if (facetedFilters.priceMin !== "") {
      const min = Number(facetedFilters.priceMin);
      if (!isNaN(min)) {
        list = list.filter((p) => Number(p.base_price) >= min);
      }
    }
    if (facetedFilters.priceMax !== "") {
      const max = Number(facetedFilters.priceMax);
      if (!isNaN(max)) {
        list = list.filter((p) => Number(p.base_price) <= max);
      }
    }

    // 7. Sorting
    switch (facetedFilters.sortBy) {
      case "name_asc":
        list.sort((a, b) => a.name.localeCompare(b.name, "es"));
        break;
      case "name_desc":
        list.sort((a, b) => b.name.localeCompare(a.name, "es"));
        break;
      case "price_asc":
        list.sort((a, b) => Number(a.base_price) - Number(b.base_price));
        break;
      case "price_desc":
        list.sort((a, b) => Number(b.base_price) - Number(a.base_price));
        break;
      case "sort_order":
      default:
        break;
    }

    return list;
  }, [products, facetedFilters, selectedLocation]);

  const totalFilteredCount = processedProducts.length;
  const pageSize = facetedFilters.pageSize;
  const totalPages =
    pageSize > 0 ? Math.ceil(totalFilteredCount / pageSize) : 1;
  const currentPage = Math.min(
    Math.max(1, facetedFilters.currentPage),
    totalPages || 1
  );

  const paginatedProducts = useMemo(() => {
    if (pageSize <= 0) return processedProducts;
    const start = (currentPage - 1) * pageSize;
    return processedProducts.slice(start, start + pageSize);
  }, [processedProducts, pageSize, currentPage]);

  function handleProductSaved(
    savedProduct: OperationalProductItem,
    isNew: boolean
  ) {
    if (isNew) {
      setProducts((curr) => [savedProduct, ...curr]);
      setFeedbackBanner({
        type: "success",
        text: `Plato "${savedProduct.name}" creado con éxito en PostgreSQL.`,
      });
    } else {
      setProducts((curr) =>
        curr.map((p) => (p.id === savedProduct.id ? savedProduct : p))
      );
      setFeedbackBanner({
        type: "success",
        text: `Plato "${savedProduct.name}" actualizado con éxito en PostgreSQL.`,
      });
    }
    setCategories((curr) =>
      curr.map((c) =>
        c.id === savedProduct.category_id
          ? {
              ...c,
              products_count: isNew ? c.products_count + 1 : c.products_count,
            }
          : c
      )
    );
  }

  function handleConfirmDeleteProduct() {
    if (!productToDelete) return;

    const prodId = productToDelete.id;
    const prodName = productToDelete.name;
    const prodCatId = productToDelete.category_id;

    startTransition(async () => {
      const res = await adminDeleteProductAction({
        restaurantSlug,
        productId: prodId,
      });

      if (!res.ok) {
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No fue posible eliminar el plato.",
        });
        setProductToDelete(null);
        return;
      }

      setProducts((curr) => curr.filter((p) => p.id !== prodId));
      setCategories((curr) =>
        curr.map((c) =>
          c.id === prodCatId
            ? { ...c, products_count: Math.max(0, c.products_count - 1) }
            : c
        )
      );
      setFeedbackBanner({
        type: "success",
        text: `Plato "${prodName}" eliminado permanentemente de la carta.`,
      });
      setProductToDelete(null);
    });
  }

  function handleCategoriesChanged(
    updatedCategories: OperationalCategoryItem[]
  ) {
    setCategories(updatedCategories);
    router.refresh();
  }

  function buildDashboardHref(
    locationSlug: string | null,
    tab: ConsoleTabId = activeTab
  ): string {
    const params = new URLSearchParams();
    if (locationSlug) {
      params.set("sede", locationSlug);
    }
    if (tab !== "platos") {
      params.set("tab", tab);
    }
    if (capabilities.isSimulated && capabilities.simPreset !== "real") {
      params.set("plan", capabilities.simPreset);
    }
    const qs = params.toString();
    return `/dashboard/${restaurantSlug}${qs ? `?${qs}` : ""}`;
  }

  function appendSimPlanParam(baseRelativeUrl: string): string {
    if (!capabilities.isSimulated || capabilities.simPreset === "real") {
      return baseRelativeUrl;
    }
    const sep = baseRelativeUrl.includes("?") ? "&" : "?";
    return `${baseRelativeUrl}${sep}plan=${encodeURIComponent(
      capabilities.simPreset
    )}`;
  }

  function handleQuickSimPreset(nextPreset: SimPlanPreset) {
    startTransition(async () => {
      const res = await setSimPlanCookieAction(nextPreset, restaurantSlug);
      if (!res.ok) {
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No fue posible cambiar la simulación del plan.",
        });
        return;
      }
      router.refresh();
    });
  }

  function handleAvailabilityChange(
    product: OperationalProductItem,
    newStatus: "available" | "sold_out" | "hidden"
  ) {
    if (isReadOnlyMutations || product.availability_status === newStatus) {
      return;
    }

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
        locationId: selectedLocation?.id ?? null,
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

      const scopeNote = selectedLocation
        ? `solo en ${selectedLocation.city} · ${selectedLocation.name} (las demás sedes no se afectan)`
        : "a nivel global de marca";

      setAuditLogs((curr) => [
        {
          id: Date.now(),
          location_id: selectedLocation?.id ?? null,
          location_name: selectedLocation?.name ?? null,
          action: selectedLocation
            ? "product.location_operational_update"
            : "product.operational_update",
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
        text: `¡Actualizado en vivo! "${product.name}" ahora está como ${statusLabel} ${scopeNote}.`,
      });
    });
  }

  function handleSavePrice(product: OperationalProductItem) {
    if (isReadOnlyMutations) return;

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
        p.id === product.id
          ? {
              ...p,
              base_price: parsedPrice,
              price_override: selectedLocation
                ? parsedPrice
                : p.price_override ?? null,
            }
          : p
      )
    );
    setEditingPriceId(null);

    startTransition(async () => {
      const res = await updateProductOperationalStateAction({
        restaurantSlug,
        productId: product.id,
        availabilityStatus: product.availability_status,
        basePrice: parsedPrice,
        locationId: selectedLocation?.id ?? null,
      });

      if (!res.ok) {
        setProducts(prevProducts);
        setFeedbackBanner({
          type: "error",
          text: res.error ?? "No se pudo actualizar el precio.",
        });
        return;
      }

      const scopeNote = selectedLocation
        ? `como tarifa regional exclusiva de ${selectedLocation.city} (${selectedLocation.name})`
        : "como precio base global";

      setFeedbackBanner({
        type: "success",
        text: `Precio de "${product.name}" actualizado a ${formatCurrency(
          parsedPrice,
          currencyCode
        )} ${scopeNote}.`,
      });
    });
  }

  function handleUpdateInquiry(
    inquiry: OperationalInquiryItem,
    newStatus: OperationalInquiryItem["status"]
  ) {
    if (isReadOnlyMutations || !capabilities.eventsEnabled) return;

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
          location_id: inquiry.location_id ?? null,
          location_name: inquiry.location_name ?? null,
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
    if (isReadOnlyMutations || !capabilities.directOrdersEnabled) return;

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
          location_id: order.location_id ?? null,
          location_name: order.location_name ?? null,
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

  const qrLocations = selectedLocation ? [selectedLocation] : locations;

  const qrTargets = [
    ...(capabilities.menuVitrineEnabled
      ? qrLocations.map((loc, idx) => ({
          key: `menu-table-${loc.slug}`,
          badge: isMultiLocation
            ? `QR de Mesa · ${loc.city} (${loc.name})`
            : "QR de Mesa · Salón Principal",
          title: `Carta en Mesa · ${loc.name}`,
          subtitle: capabilities.isVitrineOnly
            ? "Modo Vitrina Estática: abre la carta de lectura sin errores 404 (carrito y pedidos pausados)."
            : isMultiLocation
              ? `Abre la carta limpia en Modo Mesa pre-filtrada en ${loc.city} · ${loc.name} con su stock y precios regionales.`
              : "Abre la carta directamente en Modo Mesa con cálculo de propina y división de cuenta.",
          relativeUrl: appendSimPlanParam(
            `/${restaurantSlug}/menu?sede=${loc.slug}&mesa=${idx + 1}`
          ),
        }))
      : []),
    ...(capabilities.menuVitrineEnabled &&
    capabilities.directOrdersEnabled &&
    deliveryEnabled
      ? [
          {
            key: selectedLocation
              ? `direct-delivery-${selectedLocation.slug}`
              : "direct-delivery",
            badge: selectedLocation
              ? `QR Domicilios 0% · ${selectedLocation.city}`
              : "QR / Link Canal Propio 0% Comisión",
            title: selectedLocation
              ? `Domicilios & Recoger · ${selectedLocation.name}`
              : `${restaurantName} · Pedidos a Domicilio & Recoger`,
            subtitle: selectedLocation
              ? `Abre directo en checkout a domicilio asignado a ${selectedLocation.name} (${selectedLocation.city}).`
              : "Ideal para Instagram, WhatsApp Business e impresos de empaque (abre directo en modo Domicilio).",
            relativeUrl: appendSimPlanParam(
              selectedLocation
                ? `/${restaurantSlug}/menu?modo=domicilio&sede=${selectedLocation.slug}`
                : `/${restaurantSlug}/menu?modo=domicilio`
            ),
          },
        ]
      : []),
    ...(capabilities.eventsEnabled
      ? [
          {
            key: selectedLocation
              ? `events-dossier-${selectedLocation.slug}`
              : "events-dossier",
            badge: selectedLocation
              ? `QR Eventos · ${selectedLocation.city}`
              : "QR Comercial Corporativo",
            title: selectedLocation
              ? `Salones & Cotizador · ${selectedLocation.name}`
              : "Dossier de Salones & Cotizador de Eventos",
            subtitle:
              "Para enviar a empresas, organizadores de eventos o ubicar cerca a los salones privados.",
            relativeUrl: appendSimPlanParam(
              selectedLocation
                ? `/${restaurantSlug}/eventos?sede=${selectedLocation.slug}`
                : `/${restaurantSlug}/eventos`
            ),
          },
        ]
      : []),
    ...(capabilities.siteEnabled
      ? [
          {
            key: "brand-home",
            badge: "QR Portada & Historia",
            title: `${restaurantName} · Página Principal`,
            subtitle:
              "Ideal para tarjetas de presentación, prensa gastronómica y recepción.",
            relativeUrl: appendSimPlanParam(`/${restaurantSlug}`),
          },
        ]
      : []),
  ];

  function getFullTargetUrl(relativeUrl: string): string {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://fenbapps-menu.vercel.app";
    return `${origin}${relativeUrl}`;
  }

  function copyQrLink(key: string, relativeUrl: string) {
    navigator.clipboard.writeText(getFullTargetUrl(relativeUrl));
    setCopiedQrKey(key);
    setTimeout(() => setCopiedQrKey(null), 2200);
  }

  function downloadTableTentSvg(target: (typeof qrTargets)[number]) {
    const fullUrl = getFullTargetUrl(target.relativeUrl);
    const matrix = generateRealQrMatrix(fullUrl);
    const modCount = matrix.length;
    const qrBoxSize = 210;
    const cellSize = Number((qrBoxSize / modCount).toFixed(3));
    const offsetX = 40;
    const offsetY = 90;

    const isBotanica = restaurantSlug === "botanica-brunch";
    const bgCanvasHex = isBotanica ? "#FAF8F3" : "#FAF6F0";
    const borderHex = isBotanica ? "#DCE2D8" : "#E4DDD3";
    const inkHex = isBotanica ? "#1A241E" : "#181310";
    const accentHex = isBotanica ? "#2D5A40" : "#B33F19";

    let rects = "";
    matrix.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell) {
          rects += `<rect x="${(offsetX + cIdx * cellSize).toFixed(2)}" y="${(
            offsetY +
            rIdx * cellSize
          ).toFixed(2)}" width="${cellSize}" height="${cellSize}" fill="${inkHex}" />`;
        }
      });
    });

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 385" width="580" height="770">
      <rect width="290" height="385" rx="24" fill="${bgCanvasHex}" stroke="${borderHex}" stroke-width="4"/>
      <text x="145" y="42" text-anchor="middle" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="${inkHex}">${restaurantName}</text>
      <text x="145" y="64" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" fill="${accentHex}" letter-spacing="1.2">${target.badge.toUpperCase()}</text>
      <rect x="28" y="78" width="234" height="234" rx="16" fill="#FFFFFF" stroke="${borderHex}" stroke-width="2"/>
      ${rects}
      <text x="145" y="338" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="${inkHex}">${target.title}</text>
      <text x="145" y="358" text-anchor="middle" font-family="monospace" font-size="9.5" fill="#5A524C">${target.relativeUrl}</text>
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
    <div className="space-y-7">
      {/* 0A. FROZEN VITRINE / SUSPENDED / GRACE PERIOD EXECUTIVE ALERT */}
      {(capabilities.isVitrineOnly || capabilities.isSuspended) && (
        <div
          role="alert"
          className="rounded-3xl border border-crimson/35 bg-crimson/8 p-5 text-ink shadow-2xs sm:p-6"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-crimson text-ivory">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-crimson px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-ivory uppercase">
                    {capabilities.isSuspended
                      ? "Operación Suspendida"
                      : "Modo Vitrina Estática Activo"}
                  </span>
                  {capabilities.isSimulated && (
                    <span className="rounded-full border border-border-strong bg-canvas px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                      Vista Simulada (Shift+P)
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 font-display text-xl font-semibold text-ink sm:text-2xl">
                  {capabilities.isSuspended
                    ? "Suscripción suspendida temporalmente"
                    : "Suscripción Mensual Inactiva · Consola y Pedidos Congelados"}
                </h3>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
                  El cliente conserva su diseño web a medida (pago único) y la
                  lectura estática de la carta para que ningún código QR impreso
                  arroje error 404, pero{" "}
                  <strong className="text-ink">
                    el carrito en mesa, los domicilios directos, el cotizador de
                    eventos y la edición de precios/agotados en este CRM están
                    bloqueados
                  </strong>{" "}
                  en servidor (PostgreSQL RLS/RPC) hasta reactivar la membresía
                  mensual.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {capabilities.isSimulated && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleQuickSimPreset("real")}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-strong bg-canvas px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                >
                  <span>Volver a estado real (BD)</span>
                </button>
              )}
              <Link
                href="/super-admin"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember"
              >
                <Layers className="size-3.5 text-gold" />
                <span>Gestionar membresía en /super-admin</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {capabilities.subscriptionStatus === "past_due_grace" &&
        !capabilities.isVitrineOnly &&
        !capabilities.isSuspended && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-warn/40 bg-amber-warn/12 px-5 py-3.5 text-xs text-ink">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-amber-warn" />
              <span>
                <strong>Membresía en periodo de gracia:</strong> El sistema
                mantiene todos los módulos activos temporalmente mientras se
                procesa el pago mensual. Si vence el periodo de gracia, pasará
                automáticamente a <strong>Modo Vitrina Estática</strong>.
              </span>
            </div>
            <Link
              href="/super-admin"
              className="rounded-full bg-ink px-3.5 py-1.5 font-semibold text-ivory transition hover:bg-ember"
            >
              Revisar en /super-admin
            </Link>
          </div>
        )}

      {/* 0B. MULTI-CITY & MULTI-LOCATION OPERATIONAL ISOLATION BAR */}
      {isMultiLocation && (
        <section
          aria-label="Selector de sede operativa aislada"
          className="rounded-3xl border border-border-strong bg-canvas-elevated p-5 shadow-2xs"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-ember uppercase">
                <Globe className="size-3.5" />
                <span>
                  Aislamiento Operativo Multi-Ciudad ({uniqueCities.join(" & ")})
                </span>
              </div>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl">
                {selectedLocation
                  ? `Operando Sede Aislada: ${selectedLocation.city} · ${selectedLocation.name}`
                  : "Vista Consolidada de Marca (Dueño / Dirección General)"}
              </h2>
            </div>

            <span className="w-fit rounded-full border border-hairline bg-canvas px-3 py-1 font-mono text-xs text-ink-muted">
              {selectedLocation
                ? `Bandejas 100% filtradas para ${selectedLocation.slug}`
                : `${locations.length} sedes activas en ${uniqueCities.length} ${
                    uniqueCities.length === 1 ? "ciudad" : "ciudades"
                  }`}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={buildDashboardHref(null)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                !selectedLocation
                  ? "bg-ink text-ivory shadow-2xs"
                  : "border border-border-strong bg-canvas text-ink-muted hover:border-ember hover:text-ink"
              }`}
            >
              <Layers
                className={`size-3.5 ${
                  !selectedLocation ? "text-gold" : "text-ember"
                }`}
              />
              <span>Consolidado Global (Dueño)</span>
            </Link>

            {locations.map((loc) => {
              const isSelected = selectedLocation?.id === loc.id;
              return (
                <Link
                  key={loc.id}
                  href={buildDashboardHref(loc.slug)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-ember text-ivory shadow-2xs"
                      : "border border-border-strong bg-canvas text-ink hover:border-ember hover:text-ember"
                  }`}
                >
                  <MapPin
                    className={`size-3.5 ${
                      isSelected ? "text-ivory" : "text-ember"
                    }`}
                  />
                  <span>
                    {loc.city} · {loc.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            {selectedLocation ? (
              <>
                <strong className="text-ink">
                  Cero cruce con otras ciudades o sedes:
                </strong>{" "}
                Cualquier plato que marques como agotado o cambies de precio en
                esta vista se guarda en{" "}
                <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-ember">
                  public.product_locations
                </code>{" "}
                exclusivamente para{" "}
                <strong className="text-ink">{selectedLocation.name}</strong>, y
                las bandejas de Domicilios, Eventos y QR muestran solo esta sede.
              </>
            ) : (
              <>
                <strong className="text-ink">Supervisión Ejecutiva:</strong>{" "}
                Estás viendo todas las sedes y editando el catálogo maestro. Haz
                clic en cualquier sede arriba (ej.{" "}
                <strong className="text-ink">Medellín · Sede Provenza</strong>)
                para operar la consola aislada que ve el administrador de ese
                punto.
              </>
            )}
          </p>
        </section>
      )}

      {/* Live Operational Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {selectedLocation ? "Platos en Sede" : "Platos Disponibles"}
            </span>
            <CheckCircle2 className="size-4 text-sage" />
          </div>
          <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink sm:text-4xl">
            {availableCount}{" "}
            <span className="text-sm font-medium text-ink-muted">
              / {soldOutCount} agotados
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {isReadOnlyMutations
              ? "Modo lectura (edición congelada)"
              : selectedLocation
                ? `Stock aislado · ${selectedLocation.city}`
                : `${hiddenCount} ocultos · Control en 1 clic`}
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pedidos Directos (0%)
            </span>
            {capabilities.directOrdersEnabled ? (
              <Bike className="size-4 text-ember" />
            ) : (
              <Lock className="size-4 text-ink-muted" />
            )}
          </div>
          {capabilities.directOrdersEnabled ? (
            <>
              <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink sm:text-4xl">
                {directOrders.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-sage">
                {activeOrdersCount} activos ·{" "}
                {formatCurrency(totalDirectSalesAmount, currencyCode)} vendidos
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-xl font-semibold text-ink-muted">
                Plan Standard+
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Domicilios y recoger sin comisión
              </p>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Solicitudes Eventos
            </span>
            {capabilities.eventsEnabled ? (
              <CalendarCheck className="size-4 text-ember" />
            ) : (
              <Lock className="size-4 text-ink-muted" />
            )}
          </div>
          {capabilities.eventsEnabled ? (
            <>
              <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink sm:text-4xl">
                {inquiries.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-ember">
                {pendingInquiriesCount} por responder o cotizar
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-xl font-semibold text-ink-muted">
                Plan Full
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Salones privados y Mini-CRM B2B
              </p>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isMultiLocation ? "Sedes & Canales QR" : "Casa & Canales QR"}
            </span>
            <QrCode className="size-4 text-ember" />
          </div>
          <p className="tabular-price mt-2 font-sans text-3xl font-bold text-ink sm:text-4xl">
            {selectedLocation ? 1 : locations.length}{" "}
            <span className="text-sm font-medium text-ink-muted">
              {(selectedLocation ? 1 : locations.length) === 1
                ? "sede"
                : "sedes"}{" "}
              · {qrTargets.length} QRs
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {selectedLocation
              ? `${selectedLocation.city} · ${eventSpaces.length} salón(es)`
              : locations.length === 1
                ? "Interfaz adaptada a sede única"
                : `${uniqueCities.length} ciudades activas`}
          </p>
        </div>
      </div>

      {/* Live Feedback Banner */}
      {feedbackBanner && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-sm ${
            feedbackBanner.type === "success"
              ? "border-sage/40 bg-sage/12 text-ink"
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
                href={appendSimPlanParam(
                  selectedLocation
                    ? `/${restaurantSlug}/menu?sede=${selectedLocation.slug}`
                    : `/${restaurantSlug}/menu`
                )}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
              >
                <span>Ver cambio en Carta Digital</span>
                <ExternalLink className="size-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-semibold text-ink-muted hover:text-ink"
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
              ? "bg-ink text-ivory shadow-xs"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <UtensilsCrossed
            className={`size-4 ${
              activeTab === "platos" ? "text-gold" : "text-ember"
            }`}
          />
          <span>1. Disponibilidad &amp; Precios ({products.length})</span>
          {isReadOnlyMutations && (
            <span className="rounded-full bg-crimson/20 px-2 py-0.5 text-[11px] font-bold text-crimson">
              Congelado
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pedidos"}
          onClick={() => setActiveTab("pedidos")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "pedidos"
              ? "bg-ink text-ivory shadow-xs"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          {capabilities.directOrdersEnabled ? (
            <Bike
              className={`size-4 ${
                activeTab === "pedidos" ? "text-gold" : "text-ember"
              }`}
            />
          ) : (
            <Lock className="size-3.5 text-ember" />
          )}
          <span>
            2. Pedidos &amp; Domicilios
            {capabilities.directOrdersEnabled
              ? ` (${directOrders.length})`
              : ""}
          </span>
          {!capabilities.directOrdersEnabled && (
            <span className="rounded-full border border-ember/30 bg-surface-accent px-2 py-0.5 text-[11px] font-bold text-ember">
              Standard+
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "eventos"}
          onClick={() => setActiveTab("eventos")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "eventos"
              ? "bg-ink text-ivory shadow-xs"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          {capabilities.eventsEnabled ? (
            <CalendarCheck
              className={`size-4 ${
                activeTab === "eventos" ? "text-gold" : "text-ember"
              }`}
            />
          ) : (
            <Lock className="size-3.5 text-ember" />
          )}
          <span>
            3. Mini-CRM de Eventos
            {capabilities.eventsEnabled ? ` (${inquiries.length})` : ""}
          </span>
          {!capabilities.eventsEnabled && (
            <span className="rounded-full border border-ember/30 bg-surface-accent px-2 py-0.5 text-[11px] font-bold text-ember">
              Plan Full
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "qr"}
          onClick={() => setActiveTab("qr")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "qr"
              ? "bg-ink text-ivory shadow-xs"
              : "border border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          <QrCode
            className={`size-4 ${
              activeTab === "qr" ? "text-gold" : "text-ember"
            }`}
          />
          <span>4. Códigos QR Inteligentes ({qrTargets.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE CATALOG & 1-CLICK AVAILABILITY ("86ing") & CRUD */}
      {activeTab === "platos" && (
        <div className="space-y-6">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col gap-4 rounded-3xl border border-hairline bg-canvas-elevated p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    selectedLocation
                      ? "bg-ember text-ivory"
                      : "border border-border-strong bg-canvas text-ink"
                  }`}
                >
                  {selectedLocation ? (
                    <>
                      <MapPin className="size-3" />
                      <span>
                        Sede Aislada: {selectedLocation.city} ·{" "}
                        {selectedLocation.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <Layers className="size-3 text-ember" />
                      <span>Catálogo Maestro de Marca</span>
                    </>
                  )}
                </span>
                <span className="rounded-full bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                  {products.length} platos en carta · {categories.length} categorías
                </span>
              </div>
              <h2 className="font-display text-2xl font-semibold text-ink">
                Control de Carta, Cocina &amp; Precios
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                {isReadOnlyMutations
                  ? "Vista de lectura: reactiva la membresía mensual para crear, editar o eliminar platos y categorías."
                  : selectedLocation
                    ? `Precios y disponibilidad aplican de forma exclusiva a ${selectedLocation.name} (${selectedLocation.city}).`
                    : "Crea platos, gestiona categorías, ajusta precios y cambia disponibilidad en 1 clic."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isReadOnlyMutations}
                onClick={() => setIsCategoryManagerOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-canvas px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderEdit className="size-4 text-ember" />
                <span>Gestionar Categorías ({categories.length})</span>
              </button>

              <button
                type="button"
                disabled={isReadOnlyMutations}
                onClick={() => setIsCreateProductOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory shadow-2xs transition hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
                <span>Nuevo Plato</span>
              </button>
            </div>
          </div>

          {/* Faceted Filter Bar for 100+ Dishes */}
          <CatalogFacetedFilters
            categories={categories}
            allProducts={products}
            filters={facetedFilters}
            onChange={setFacetedFilters}
            isExpanded={isFacetedExpanded}
            onToggleExpanded={() => setIsFacetedExpanded((prev) => !prev)}
            currencyCode={currencyCode}
            hasSelectedLocation={Boolean(selectedLocation)}
            selectedLocationName={selectedLocation?.name}
          />

          {/* Dish List Container */}
          <div className="overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated">
            {totalFilteredCount === 0 ? (
              <div className="p-12 text-center">
                <UtensilsCrossed className="mx-auto size-10 text-ink-muted/40" />
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  No hay platos que coincidan con estos filtros
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Prueba restableciendo los filtros de categoría, precio o insignias.
                </p>
                <button
                  type="button"
                  onClick={() => setFacetedFilters(INITIAL_FACETED_FILTER_STATE)}
                  className="mt-4 inline-flex items-center rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                >
                  Restablecer filtros y ver todos los platos
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards (< md) */}
                <div className="divide-y divide-hairline md:hidden">
                  {paginatedProducts.map((product) => {
                    const hasRegionalPrice =
                      selectedLocation != null &&
                      product.price_override != null &&
                      product.global_base_price != null &&
                      Number(product.price_override) !==
                        Number(product.global_base_price);
                    const optGroupsCount = (product.option_groups ?? []).length;

                    return (
                      <div key={product.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-ember">
                                {product.category_name}
                              </span>
                              {product.is_featured && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-warn/15 px-2 py-0.2 text-[10px] font-bold text-amber-warn">
                                  <Flame className="size-2.5" />
                                  Destacado
                                </span>
                              )}
                              {product.is_chef_choice && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-ember/15 px-2 py-0.2 text-[10px] font-bold text-ember">
                                  <Award className="size-2.5" />
                                  Chef
                                </span>
                              )}
                              {product.is_new && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-sage/15 px-2 py-0.2 text-[10px] font-bold text-sage">
                                  Nuevo
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-ink">
                              {product.name}
                            </h3>
                            {product.short_description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                                {product.short_description}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                              <span>{product.portion_label ?? "Porción estándar"}</span>
                              {optGroupsCount > 0 && (
                                <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                                  {optGroupsCount}{" "}
                                  {optGroupsCount === 1 ? "grupo opciones" : "grupos opciones"}
                                </span>
                              )}
                            </div>
                            {isMultiLocation && product.exclusive_location_name && (
                              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-accent px-2 py-0.5 text-[11px] font-semibold text-ember">
                                <MapPin className="size-3" />
                                <span>Exclusivo {product.exclusive_location_name}</span>
                              </span>
                            )}
                            {!selectedLocation &&
                              (product.location_overrides_count ?? 0) > 0 && (
                                <span className="mt-1 block text-[11px] font-medium text-ember">
                                  Diferencial en {product.location_overrides_count} sede(s)
                                </span>
                              )}
                          </div>

                          <div className="shrink-0 text-right">
                            {editingPriceId === product.id &&
                            !isReadOnlyMutations ? (
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
                                  className="w-24 rounded-lg border border-ember bg-canvas px-2 py-1 font-mono text-base text-ink sm:text-xs"
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
                              <div>
                                <button
                                  type="button"
                                  disabled={isReadOnlyMutations}
                                  onClick={() => {
                                    setEditingPriceId(product.id);
                                    setPriceDraft(String(product.base_price));
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-ink hover:text-ember disabled:cursor-not-allowed disabled:opacity-65"
                                >
                                  <span>
                                    {formatCurrency(
                                      Number(product.base_price),
                                      currencyCode
                                    )}
                                  </span>
                                  {!isReadOnlyMutations && (
                                    <Pencil className="size-3.5 text-ink-muted" />
                                  )}
                                </button>
                                {product.compare_at_price != null &&
                                  Number(product.compare_at_price) >
                                    Number(product.base_price) && (
                                    <span className="block font-mono text-[11px] text-ink-muted line-through">
                                      {formatCurrency(
                                        Number(product.compare_at_price),
                                        currencyCode
                                      )}
                                    </span>
                                  )}
                                {hasRegionalPrice && (
                                  <span className="block text-[10px] text-ember">
                                    Tarifa {selectedLocation.city}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 1-Click Availability Controls */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={isPending || isReadOnlyMutations}
                            onClick={() =>
                              handleAvailabilityChange(product, "available")
                            }
                            className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              product.availability_status === "available"
                                ? "bg-sage text-ivory shadow-2xs"
                                : "border border-hairline bg-canvas text-ink-muted"
                            }`}
                          >
                            Disponible
                          </button>
                          <button
                            type="button"
                            disabled={isPending || isReadOnlyMutations}
                            onClick={() =>
                              handleAvailabilityChange(product, "sold_out")
                            }
                            className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              product.availability_status === "sold_out"
                                ? "bg-amber-warn text-ivory shadow-2xs"
                                : "border border-hairline bg-canvas text-ink-muted"
                            }`}
                          >
                            Agotado hoy
                          </button>
                          <button
                            type="button"
                            disabled={isPending || isReadOnlyMutations}
                            onClick={() =>
                              handleAvailabilityChange(product, "hidden")
                            }
                            className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              product.availability_status === "hidden"
                                ? "bg-ink text-ivory shadow-2xs"
                                : "border border-hairline bg-canvas text-ink-muted"
                            }`}
                          >
                            Ocultar
                          </button>
                        </div>

                        {/* Edit & Delete Actions in Mobile */}
                        <div className="flex items-center justify-end gap-2 border-t border-hairline/60 pt-2">
                          <button
                            type="button"
                            onClick={() => setProductToEdit(product)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                          >
                            <Pencil className="size-3 text-ember" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            disabled={
                              isReadOnlyMutations ||
                              product.id === "corte-secreto-pruebas-internas"
                            }
                            onClick={() => setProductToDelete(product)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-crimson transition hover:bg-crimson/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="size-3" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Operational Table (>= md) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-hairline bg-canvas/60 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      <tr>
                        <th className="px-6 py-3.5">Plato / Foto / Insignias</th>
                        <th className="px-6 py-3.5">Categoría &amp; Modificadores</th>
                        <th className="px-6 py-3.5">
                          {selectedLocation
                            ? `Estado en ${selectedLocation.name}`
                            : "Control de Estado en Vivo"}
                        </th>
                        <th className="px-6 py-3.5 text-right">
                          {selectedLocation
                            ? `Precio en ${selectedLocation.city}`
                            : "Precio Base en Carta"}
                        </th>
                        <th className="px-6 py-3.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {paginatedProducts.map((product) => {
                        const hasRegionalPrice =
                          selectedLocation != null &&
                          product.price_override != null &&
                          product.global_base_price != null &&
                          Number(product.price_override) !==
                            Number(product.global_base_price);
                        const optGroupsCount = (product.option_groups ?? []).length;

                        return (
                          <tr
                            key={product.id}
                            className="transition hover:bg-canvas/40"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.image_alt ?? product.name}
                                    className="size-11 shrink-0 rounded-xl border border-hairline object-cover"
                                  />
                                ) : (
                                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-hairline bg-canvas text-ink-muted">
                                    <UtensilsCrossed className="size-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="font-semibold text-ink">
                                      {product.name}
                                    </p>
                                    {product.is_featured && (
                                      <span
                                        title="Plato destacado"
                                        className="inline-flex items-center gap-0.5 rounded-full bg-amber-warn/15 px-2 py-0.2 text-[10px] font-bold text-amber-warn"
                                      >
                                        <Flame className="size-2.5" />
                                        Destacado
                                      </span>
                                    )}
                                    {product.is_chef_choice && (
                                      <span
                                        title="Recomendación del Chef"
                                        className="inline-flex items-center gap-0.5 rounded-full bg-ember/15 px-2 py-0.2 text-[10px] font-bold text-ember"
                                      >
                                        <Award className="size-2.5" />
                                        Chef
                                      </span>
                                    )}
                                    {product.is_new && (
                                      <span
                                        title="Plato nuevo"
                                        className="inline-flex items-center gap-0.5 rounded-full bg-sage/15 px-2 py-0.2 text-[10px] font-bold text-sage"
                                      >
                                        Nuevo
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-ink-muted">
                                    {product.portion_label ?? "Porción estándar"}
                                  </p>
                                  {product.short_description && (
                                    <p className="mt-0.5 max-w-sm truncate text-xs text-ink-muted/80">
                                      {product.short_description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-xs text-ink-muted">
                              <span className="font-medium text-ink">
                                {product.category_name}
                              </span>
                              {optGroupsCount > 0 ? (
                                <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-surface-accent px-2 py-0.5 text-[11px] font-medium text-ember">
                                  <span>
                                    {optGroupsCount}{" "}
                                    {optGroupsCount === 1
                                      ? "grupo opciones"
                                      : "grupos opciones"}
                                  </span>
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-[11px] text-ink-muted">
                                  Sin modificadores
                                </span>
                              )}

                              {isMultiLocation &&
                                (product.exclusive_location_name ? (
                                  <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-surface-accent px-2 py-0.5 text-[11px] font-semibold text-ember">
                                    <MapPin className="size-3" />
                                    <span>
                                      Exclusivo {product.exclusive_location_name}
                                    </span>
                                  </span>
                                ) : !selectedLocation &&
                                  (product.location_overrides_count ?? 0) > 0 ? (
                                  <span className="mt-1 block text-xs font-medium text-ember">
                                    Diferencial en{" "}
                                    {product.location_overrides_count} sede(s)
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-[11px] text-ink-muted">
                                    {selectedLocation
                                      ? `Ofrecido en ${selectedLocation.city}`
                                      : "Todas las sedes"}
                                  </span>
                                ))}
                            </td>

                            <td className="px-6 py-4">
                              <div className="inline-flex rounded-full border border-hairline bg-canvas p-1">
                                <button
                                  type="button"
                                  disabled={isPending || isReadOnlyMutations}
                                  onClick={() =>
                                    handleAvailabilityChange(product, "available")
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    product.availability_status === "available"
                                      ? "bg-sage text-ivory shadow-2xs"
                                      : "text-ink-muted hover:text-ink"
                                  }`}
                                >
                                  <span className="size-1.5 rounded-full bg-current" />
                                  <span>Disponible</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending || isReadOnlyMutations}
                                  onClick={() =>
                                    handleAvailabilityChange(product, "sold_out")
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    product.availability_status === "sold_out"
                                      ? "bg-amber-warn text-ivory shadow-2xs"
                                      : "text-ink-muted hover:text-ink"
                                  }`}
                                >
                                  <span className="size-1.5 rounded-full bg-current" />
                                  <span>Agotado hoy</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending || isReadOnlyMutations}
                                  onClick={() =>
                                    handleAvailabilityChange(product, "hidden")
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    product.availability_status === "hidden"
                                      ? "bg-ink text-ivory shadow-2xs"
                                      : "text-ink-muted hover:text-ink"
                                  }`}
                                >
                                  <EyeOff className="size-3" />
                                  <span>Oculto</span>
                                </button>
                              </div>
                            </td>

                            <td className="tabular-price px-6 py-4 text-right font-mono font-semibold text-ink">
                              {editingPriceId === product.id &&
                              !isReadOnlyMutations ? (
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
                                    <span>Guardar</span>
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
                                <div className="flex flex-col items-end">
                                  <button
                                    type="button"
                                    disabled={isReadOnlyMutations}
                                    onClick={() => {
                                      setEditingPriceId(product.id);
                                      setPriceDraft(String(product.base_price));
                                    }}
                                    title={
                                      isReadOnlyMutations
                                        ? "Edición bloqueada en Modo Vitrina"
                                        : "Haz clic para editar el precio en vivo"
                                    }
                                    className="inline-flex items-center justify-end gap-1.5 rounded-xl px-2.5 py-1 transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-65"
                                  >
                                    <span>
                                      {formatCurrency(
                                        Number(product.base_price),
                                        currencyCode
                                      )}
                                    </span>
                                    {!isReadOnlyMutations ? (
                                      <Pencil className="size-3.5 text-ink-muted" />
                                    ) : (
                                      <Lock className="size-3 text-ink-muted" />
                                    )}
                                  </button>
                                  {product.compare_at_price != null &&
                                    Number(product.compare_at_price) >
                                      Number(product.base_price) && (
                                      <span className="font-mono text-xs text-ink-muted line-through">
                                        {formatCurrency(
                                          Number(product.compare_at_price),
                                          currencyCode
                                        )}
                                      </span>
                                    )}
                                  {hasRegionalPrice && (
                                    <span className="font-sans text-[11px] font-medium text-ember">
                                      Tarifa {selectedLocation.city} (Base:{" "}
                                      {formatCurrency(
                                        Number(product.global_base_price),
                                        currencyCode
                                      )}
                                      )
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setProductToEdit(product)}
                                  title="Editar plato y modificadores"
                                  className="rounded-xl border border-hairline bg-canvas p-2 text-ink-muted transition hover:border-ember hover:text-ember"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isReadOnlyMutations ||
                                    product.id === "corte-secreto-pruebas-internas"
                                  }
                                  onClick={() => setProductToDelete(product)}
                                  title={
                                    product.id === "corte-secreto-pruebas-internas"
                                      ? "Plato protegido para pruebas automatizadas"
                                      : "Eliminar plato"
                                  }
                                  className="rounded-xl border border-hairline bg-canvas p-2 text-crimson/80 transition hover:bg-crimson/10 hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col gap-3 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-ink-muted">
                    {pageSize > 0 ? (
                      <>
                        Mostrando{" "}
                        <strong className="text-ink">
                          {Math.min(
                            (currentPage - 1) * pageSize + 1,
                            totalFilteredCount
                          )}
                        </strong>{" "}
                        a{" "}
                        <strong className="text-ink">
                          {Math.min(
                            currentPage * pageSize,
                            totalFilteredCount
                          )}
                        </strong>{" "}
                        de{" "}
                        <strong className="text-ink">{totalFilteredCount}</strong>{" "}
                        platos
                        {totalFilteredCount !== products.length && (
                          <span> (filtrados de {products.length} en total)</span>
                        )}
                      </>
                    ) : (
                      <>
                        Mostrando{" "}
                        <strong className="text-ink">{totalFilteredCount}</strong>{" "}
                        platos en una sola página
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Page Size Selector */}
                    <div className="flex items-center gap-1 text-xs text-ink-muted">
                      <span>Filas:</span>
                      <select
                        value={pageSize}
                        onChange={(e) =>
                          setFacetedFilters((prev) => ({
                            ...prev,
                            pageSize: Number(e.target.value),
                            currentPage: 1,
                          }))
                        }
                        className="rounded-lg border border-border-strong bg-canvas px-2 py-1 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                      >
                        <option value={20}>20 / pág</option>
                        <option value={50}>50 / pág</option>
                        <option value={100}>100 / pág</option>
                        <option value={0}>Todos ({totalFilteredCount})</option>
                      </select>
                    </div>

                    {/* Pagination Buttons */}
                    {pageSize > 0 && totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() =>
                            setFacetedFilters((prev) => ({
                              ...prev,
                              currentPage: Math.max(1, prev.currentPage - 1),
                            }))
                          }
                          aria-label="Página anterior"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-border-strong bg-canvas text-ink transition hover:border-ember hover:text-ember disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronLeft className="size-4" />
                        </button>

                        <span className="px-2 text-xs font-medium text-ink">
                          {currentPage} de {totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() =>
                            setFacetedFilters((prev) => ({
                              ...prev,
                              currentPage: Math.min(
                                totalPages,
                                prev.currentPage + 1
                              ),
                            }))
                          }
                          aria-label="Página siguiente"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-border-strong bg-canvas text-ink transition hover:border-ember hover:text-ember disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE DIRECT ORDERS & COMMISSION-FREE DELIVERY CONSOLE */}
      {activeTab === "pedidos" && (
        <>
          {!capabilities.directOrdersEnabled ? (
            <div className="rounded-3xl border border-border-strong bg-canvas-elevated p-6 sm:p-10">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-ember">
                  <Crown className="size-6" />
                </div>
                <span className="mt-4 inline-block rounded-full border border-ember/30 bg-surface-accent px-3 py-1 text-xs font-bold tracking-wider text-ember uppercase">
                  Incluido desde {PLAN_TIERS_META.standard.label}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  Motor Propio de Domicilios &amp; Recoger (0% Comisión)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  El plan actual ({PLAN_TIERS_META[capabilities.planTier].shortLabel}
                  {capabilities.isVitrineOnly ? " · Modo Vitrina" : ""}) no
                  tiene activo el canal transaccional de domicilios. Al activar{" "}
                  <strong>Plan Standard</strong> o <strong>Plan Full</strong>,
                  el restaurante recibe pedidos directos con cálculo automático
                  de envío, vueltas exactas en efectivo, datáfono y llaves
                  Bre-B/Nequi por sede sin pagar el ~28% de apps externas.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                  {PLAN_TIERS_META.standard.includedHighlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-2xl border border-hairline bg-canvas p-3.5 text-xs text-ink"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleQuickSimPreset("standard")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
                  >
                    <Sparkles className="size-4" />
                    <span>Simular Plan Standard en vivo</span>
                  </button>
                  <Link
                    href="/super-admin"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-canvas px-5 py-2.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    <Layers className="size-4 text-ember" />
                    <span>Activar permanentemente en /super-admin</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 rounded-3xl border border-hairline bg-surface-accent/65 p-5 text-ink sm:grid-cols-3 sm:p-6">
                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
                    Canal Propio 0% Comisión ·{" "}
                    {selectedLocation
                      ? `Bandeja Aislada ${selectedLocation.city} (${selectedLocation.name})`
                      : "Consolidado de Marca"}
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
                    Bandeja de Domicilios &amp; Pedidos Para Recoger
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Cada pedido recibido se valida en servidor (precios reales y
                    tarifa de domicilio de la sede elegida) y se guarda en{" "}
                    <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs font-semibold text-ember">
                      public.direct_orders
                    </code>{" "}
                    sin pagar el ~28% de comisión de plataformas externas.
                  </p>
                </div>
                <div className="flex flex-col justify-center rounded-2xl border border-hairline bg-canvas px-4 py-3 text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Ahorro estimado en comisiones
                  </span>
                  <span className="tabular-price mt-0.5 font-mono text-2xl font-bold text-sage">
                    +{" "}
                    {formatCurrency(estimatedCommissionSavings, currencyCode)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    sobre {formatCurrency(totalDirectSalesAmount, currencyCode)}{" "}
                    en ventas directas
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
                  <h3 className="font-display text-2xl font-semibold text-ink">
                    Órdenes Registradas ({directOrders.length})
                  </h3>
                  <Link
                    href={appendSimPlanParam(
                      selectedLocation
                        ? `/${restaurantSlug}/menu?modo=domicilio&sede=${selectedLocation.slug}`
                        : `/${restaurantSlug}/menu?modo=domicilio`
                    )}
                    className="inline-flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                  >
                    <Bike className="size-3.5" />
                    <span>Simular nuevo domicilio en la Carta →</span>
                  </Link>
                </div>

                {directOrders.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-hairline bg-canvas p-6 text-center text-sm text-ink-muted">
                    No hay pedidos registrados en{" "}
                    {selectedLocation ? selectedLocation.name : "esta bandeja"}.
                    Haz clic arriba en &ldquo;Simular nuevo domicilio en la
                    Carta&rdquo; para probar el flujo completo.
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
                          <Banknote className="size-4 text-sage" />
                        ) : order.payment_method === "card_dataphone" ? (
                          <CreditCard className="size-4 text-ember" />
                        ) : (
                          <Smartphone className="size-4 text-accent-ink" />
                        );

                      const paymentLabel =
                        order.payment_method === "cash"
                          ? "Efectivo"
                          : order.payment_method === "card_dataphone"
                            ? "Tarjeta / Datáfono"
                            : "Transferencia";

                      const statusUpdateWaMsg = [
                        `Hola ${order.customer_name}, te escribimos de *${restaurantName}*${
                          order.location_name ? ` (${order.location_name})` : ""
                        }.`,
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
                          className="rounded-3xl border border-hairline bg-canvas p-5 transition hover:border-ember/40 sm:p-6"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-xs font-bold text-ivory">
                                  {order.reference_code}
                                </span>
                                {isMultiLocation && order.location_name && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                                    <MapPin className="size-3" />
                                    <span>
                                      {order.location_city
                                        ? `${order.location_city} · `
                                        : ""}
                                      {order.location_name}
                                    </span>
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
                                    order.fulfillment_type === "delivery"
                                      ? "bg-surface-accent text-ember"
                                      : "bg-canvas-muted text-ink"
                                  }`}
                                >
                                  {order.fulfillment_type === "delivery" ? (
                                    <>
                                      <Bike className="size-3.5" />
                                      <span>A Domicilio</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingBag className="size-3.5" />
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
                              <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
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
                            <div className="space-y-1.5 text-xs">
                              <p className="font-semibold uppercase tracking-wider text-ink-muted">
                                Platos Solicitados
                              </p>
                              <ul className="space-y-1">
                                {(Array.isArray(order.items)
                                  ? order.items
                                  : []
                                ).map((item, idx) => (
                                  <li
                                    key={`${order.id}-item-${idx}`}
                                    className="text-ink"
                                  >
                                    <strong>{item.quantity}x</strong>{" "}
                                    {item.name}
                                    {item.options &&
                                      item.options.length > 0 && (
                                        <span className="block text-xs text-ink-muted">
                                          ({item.options.join(", ")})
                                        </span>
                                      )}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="space-y-1.5 text-xs">
                              <p className="font-semibold uppercase tracking-wider text-ink-muted">
                                Entrega &amp; Medio de Pago
                              </p>
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

                            <div className="space-y-2.5">
                              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Estado en Cocina / Despacho
                              </label>
                              <select
                                value={order.status}
                                disabled={isPending || isReadOnlyMutations}
                                onChange={(e) =>
                                  handleUpdateDirectOrder(
                                    order,
                                    e.target
                                      .value as OperationalDirectOrderItem["status"]
                                  )
                                }
                                aria-label={`Estado del pedido ${order.reference_code}`}
                                className="h-10 w-full rounded-xl border border-border-strong bg-canvas-elevated px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
        </>
      )}

      {/* TAB 3: MINI-CRM DE SOLICITUDES DE EVENTOS */}
      {activeTab === "eventos" && (
        <>
          {!capabilities.eventsEnabled ? (
            <div className="rounded-3xl border border-border-strong bg-canvas-elevated p-6 sm:p-10">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-ember">
                  <CalendarCheck className="size-6" />
                </div>
                <span className="mt-4 inline-block rounded-full border border-ember/30 bg-surface-accent px-3 py-1 text-xs font-bold tracking-wider text-ember uppercase">
                  Exclusivo {PLAN_TIERS_META.full.label}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                  Dossier de Salones Privados &amp; Mini-CRM de Eventos
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Convierte reservas grupales, cenas corporativas y celebraciones
                  con galería de salones por ciudad, paquetes gastronómicos por
                  persona, calculadora de presupuesto referencial y seguimiento
                  comercial aislado por sede.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                  {PLAN_TIERS_META.full.includedHighlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-2xl border border-hairline bg-canvas p-3.5 text-xs text-ink"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleQuickSimPreset("full")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
                  >
                    <Sparkles className="size-4" />
                    <span>Simular Plan Full en vivo</span>
                  </button>
                  <Link
                    href="/super-admin"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-canvas px-5 py-2.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                  >
                    <Layers className="size-4 text-ember" />
                    <span>Activar permanentemente en /super-admin</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
                      {selectedLocation
                        ? `Bandeja Eventos Aislada · ${selectedLocation.city} (${selectedLocation.name})`
                        : "Bandeja Comercial Aislada por Tenant (RLS)"}
                    </span>
                    <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                      Solicitudes de Eventos &amp; Celebraciones (
                      {inquiries.length})
                    </h2>
                  </div>
                  <Link
                    href={appendSimPlanParam(
                      selectedLocation
                        ? `/${restaurantSlug}/eventos?sede=${selectedLocation.slug}#solicitud-cotizacion-eventos`
                        : `/${restaurantSlug}/eventos#solicitud-cotizacion-eventos`
                    )}
                    className="inline-flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                  >
                    <CalendarCheck className="size-3.5" />
                    <span>Crear nueva solicitud de prueba →</span>
                  </Link>
                </div>

                {inquiries.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-hairline bg-canvas p-6 text-center text-sm text-ink-muted">
                    Aún no hay solicitudes de eventos registradas para{" "}
                    {selectedLocation ? selectedLocation.name : "este filtro"}.
                    Haz clic arriba en &ldquo;Crear nueva solicitud de
                    prueba&rdquo; para probar el cotizador.
                  </p>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-5">
                    {inquiries.map((inq) => {
                      const statusMeta =
                        INQUIRY_STATUS_OPTIONS.find(
                          (s) => s.value === inq.status
                        ) ?? INQUIRY_STATUS_OPTIONS[0]!;
                      const estimatedBudget =
                        inq.package_base_price && inq.guest_count
                          ? Number(inq.package_base_price) * inq.guest_count
                          : null;

                      const coordinatorWaMessage = [
                        `Hola ${inq.customer_name}, te saludamos del equipo de Eventos y Hospitalidad de *${restaurantName}*${
                          inq.location_name ? ` (${inq.location_name})` : ""
                        }.`,
                        `Recibimos tu solicitud con código *${inq.reference_code}* para tu *${inq.event_type}* (${inq.guest_count} invitados, fecha tentativa ${inq.tentative_date}).`,
                        inq.event_space_name
                          ? `Espacio solicitado: ${inq.event_space_name}${
                              isMultiLocation && inq.location_name
                                ? ` (${inq.location_city ? `${inq.location_city} · ` : ""}${inq.location_name})`
                                : ""
                            }.`
                          : null,
                        estimatedBudget
                          ? `Presupuesto base estimado según la experiencia elegida: ${formatCurrency(
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
                          className="rounded-3xl border border-hairline bg-canvas p-5 transition hover:border-ember/40 sm:p-6"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-xs font-bold text-ivory">
                                  {inq.reference_code}
                                </span>
                                {isMultiLocation && inq.location_name && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                                    <MapPin className="size-3" />
                                    <span>
                                      {inq.location_city
                                        ? `${inq.location_city} · `
                                        : ""}
                                      {inq.location_name}
                                    </span>
                                  </span>
                                )}
                                <span
                                  className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                                >
                                  {statusMeta.label}
                                </span>
                                <span className="text-xs text-ink-muted">
                                  Fecha tentativa:{" "}
                                  <strong className="font-semibold text-ink">
                                    {inq.tentative_date}
                                  </strong>{" "}
                                  ·{" "}
                                  {TIME_SLOT_LABELS[
                                    inq.preferred_time_slot as keyof typeof TIME_SLOT_LABELS
                                  ] ?? inq.preferred_time_slot}
                                </span>
                              </div>

                              <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                                {inq.event_type} · {inq.guest_count} invitados
                              </h3>
                            </div>

                            {estimatedBudget && (
                              <div className="rounded-2xl border border-hairline bg-canvas-elevated px-4 py-2 text-right">
                                <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                  Valor Estimado Paquete
                                </span>
                                <span className="tabular-price font-mono text-lg font-bold text-ember">
                                  {formatCurrency(
                                    estimatedBudget,
                                    currencyCode
                                  )}
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
                                <p className="text-ink-muted">
                                  {inq.customer_email}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1 text-xs">
                              <p className="font-semibold uppercase tracking-wider text-ink-muted">
                                {isMultiLocation
                                  ? "Ciudad, Sede & Salón"
                                  : "Salón & Experiencia"}
                              </p>
                              {isMultiLocation && (
                                <p className="font-medium text-ink">
                                  📍{" "}
                                  {inq.location_city
                                    ? `${inq.location_city} · `
                                    : ""}
                                  {inq.location_name ?? "Sede por definir"}
                                </p>
                              )}
                              <p className="text-ink-muted">
                                🏛️ Salón:{" "}
                                <strong className="font-semibold text-ink">
                                  {inq.event_space_name ??
                                    "A sugerir por capacidad"}
                                </strong>
                              </p>
                              <p className="text-ink-muted">
                                🍷 Experiencia:{" "}
                                <strong className="font-semibold text-ink">
                                  {inq.event_package_name ??
                                    "Cotización a medida"}
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
                                Estado Comercial &amp; Notas Internas
                              </label>
                              <select
                                value={inq.status}
                                disabled={isPending || isReadOnlyMutations}
                                aria-label={`Estado comercial de ${inq.reference_code}`}
                                onChange={(e) =>
                                  handleUpdateInquiry(
                                    inq,
                                    e.target
                                      .value as OperationalInquiryItem["status"]
                                  )
                                }
                                className="h-10 w-full rounded-xl border border-border-strong bg-canvas-elevated px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {INQUIRY_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>

                              <textarea
                                rows={2}
                                disabled={isReadOnlyMutations}
                                value={inquiryNotesDraft[inq.id] ?? ""}
                                onChange={(e) =>
                                  setInquiryNotesDraft((prev) => ({
                                    ...prev,
                                    [inq.id]: e.target.value,
                                  }))
                                }
                                placeholder="Notas de coordinación (ej. se envió PDF, requiere anticipo)..."
                                className="w-full rounded-xl border border-border-strong bg-canvas-elevated p-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                              />

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isPending || isReadOnlyMutations}
                                  onClick={() =>
                                    handleUpdateInquiry(inq, inq.status)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember disabled:cursor-not-allowed disabled:opacity-60"
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
                )}
              </div>

              {/* Configured Spaces & Packages Overview */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6">
                  <h3 className="font-display text-2xl font-semibold text-ink">
                    {selectedLocation
                      ? `Salones en ${selectedLocation.name} (${eventSpaces.length})`
                      : `Salones Activos (${eventSpaces.length})`}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {eventSpaces.map((space) => (
                      <div
                        key={space.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas p-3.5"
                      >
                        <div>
                          <p className="font-semibold text-ink">{space.name}</p>
                          <p className="text-xs text-ink-muted">
                            {space.subtitle}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas-muted px-3 py-1 text-xs font-medium text-ink">
                          <Users className="size-3.5 text-ember" />
                          <span>
                            {space.min_guests}–{space.capacity_seated} pax
                          </span>
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
        </>
      )}

      {/* TAB 4: REAL ISO/IEC 18004 SCANNABLE QR GENERATOR PER LOCATION & CHANNEL */}
      {activeTab === "qr" && (
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
              Kit de Mesa, Redes Sociales &amp; Empaques (ISO/IEC 18004)
            </span>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
              {selectedLocation
                ? `Códigos QR Escaneables · ${selectedLocation.city} (${selectedLocation.name})`
                : "Generador de Códigos QR Contextuales Escaneables"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Los QRs de mesa usan{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs font-semibold text-ember">
                ?sede=...&amp;mesa=...
              </code>{" "}
              para abrir la carta pre-filtrada en la sede exacta
              {capabilities.isSimulated
                ? ` (incluyendo ?plan=${capabilities.simPreset} para previsualizar esta simulación desde tu celular)`
                : ""}
              .
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {qrTargets.map((target) => {
              const matrix = generateRealQrMatrix(
                getFullTargetUrl(target.relativeUrl)
              );
              const qrSize = matrix.length;
              return (
                <div
                  key={target.key}
                  className="flex flex-col justify-between gap-5 rounded-3xl border border-hairline bg-canvas p-5 sm:flex-row sm:items-center"
                >
                  <div className="mx-auto flex shrink-0 flex-col items-center rounded-2xl border border-hairline bg-white p-3.5 shadow-2xs sm:mx-0">
                    <svg
                      viewBox={`0 0 ${qrSize} ${qrSize}`}
                      className="size-28"
                      aria-label={`Código QR escaneable para ${target.title}`}
                    >
                      {matrix.map((row, rIdx) =>
                        row.map((cell, cIdx) =>
                          cell ? (
                            <rect
                              key={`${rIdx}-${cIdx}`}
                              x={cIdx}
                              y={rIdx}
                              width={1}
                              height={1}
                              fill="#14110F"
                            />
                          ) : null
                        )
                      )}
                    </svg>
                    <span className="mt-1.5 font-mono text-xs font-semibold text-ink-muted">
                      QR ESCANEABLE
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <span className="inline-block rounded-full bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                      {target.badge}
                    </span>
                    <h3 className="font-display text-xl font-semibold text-ink">
                      {target.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {target.subtitle}
                    </p>
                    <p className="truncate rounded-xl border border-hairline bg-canvas-elevated px-3 py-1.5 font-mono text-xs text-ink">
                      {target.relativeUrl}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Link
                        href={target.relativeUrl}
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-ivory transition hover:bg-ember"
                      >
                        <span>Probar QR en vivo</span>
                        <ExternalLink className="size-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          copyQrLink(target.key, target.relativeUrl)
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-canvas-elevated px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
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
                        className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-canvas-elevated px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
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
              Bitácora Forense de Cambios en Tiempo Real (
              <code className="font-mono text-base text-ember">audit_logs</code>
              )
            </h3>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Cada cambio de disponibilidad regional o global, precio, pedido
            directo, cotización o plan SaaS queda registrado con trazabilidad.
          </p>

          {auditLogs.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-hairline bg-canvas p-4 text-xs text-ink-muted">
              Aún no hay cambios registrados en esta vista. Prueba cambiando un
              plato, el estado de un domicilio o una solicitud arriba.
            </p>
          ) : (
            <div className="mt-4 max-h-60 space-y-2.5 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-hairline bg-canvas px-4 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-ember">
                        {log.action}
                      </span>
                      {log.location_name && (
                        <span className="rounded-full bg-surface-accent px-2 py-0.5 text-[11px] font-semibold text-ember">
                          {log.location_name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 break-words text-ink-muted">
                      {log.previous_state && log.new_state
                        ? `${JSON.stringify(
                            log.previous_state
                          )} → ${JSON.stringify(log.new_state)}`
                        : `Entidad: ${log.entity_type}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">
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

        <div className="flex flex-col justify-between rounded-3xl border border-hairline bg-surface-accent/65 p-6 text-ink lg:col-span-5">
          <div>
            <div className="flex items-center gap-2 text-ember">
              <ShieldCheck className="size-5 text-sage" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                Arquitectura Comercial &amp; Multi-Sede
              </span>
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
              Aislamiento PostgreSQL RLS + Gobernanza de Planes
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Las tablas mantienen{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono font-semibold text-ember">
                FORCE ROW LEVEL SECURITY
              </code>{" "}
              y validan en servidor tanto el aislamiento por sede como el estado
              de suscripción en{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono font-semibold text-ember">
                public.restaurant_entitlements
              </code>
              .
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Link
              href="/dashboard/casa-brasa"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                restaurantSlug === "casa-brasa"
                  ? "bg-ember text-ivory shadow-2xs"
                  : "border border-border-strong bg-canvas text-ink hover:border-ember hover:text-ember"
              }`}
            >
              Casa Brasa (3 Sedes · 2 Ciudades)
            </Link>
            <Link
              href="/dashboard/botanica-brunch"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                restaurantSlug === "botanica-brunch"
                  ? "bg-ember text-ivory shadow-2xs"
                  : "border border-border-strong bg-canvas text-ink hover:border-ember hover:text-ember"
              }`}
            >
              Botánica (1 Sede)
            </Link>
            <Link
              href="/super-admin"
              className="rounded-full border border-border-strong bg-obsidian px-3.5 py-1.5 text-xs font-semibold text-gold transition hover:border-gold"
            >
              /super-admin
            </Link>
          </div>
        </div>
      </div>

      {/* 5. MODALS: PRODUCT EDITOR, CATEGORY MANAGER, DELETE CONFIRM */}
      <ProductEditorModal
        isOpen={isCreateProductOpen || Boolean(productToEdit)}
        product={productToEdit}
        categories={categories}
        locations={locations}
        restaurantSlug={restaurantSlug}
        currencyCode={currencyCode}
        onClose={() => {
          setIsCreateProductOpen(false);
          setProductToEdit(null);
        }}
        onSaved={handleProductSaved}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        restaurantSlug={restaurantSlug}
        categories={categories}
        onClose={() => setIsCategoryManagerOpen(false)}
        onCategoriesChanged={handleCategoriesChanged}
      />

      <DeleteConfirmModal
        isOpen={Boolean(productToDelete)}
        title="Eliminar Plato de Carta"
        description="¿Estás seguro de que deseas eliminar este plato? Esta acción eliminará permanentemente el producto y todos sus grupos de opciones en PostgreSQL."
        itemName={productToDelete?.name ?? ""}
        isPending={isPending}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDeleteProduct}
      />
    </div>
  );
}
