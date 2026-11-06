"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  Search,
  Sparkles,
  Flame,
  Check,
  X,
  Camera,
  Clock,
  ChevronRight,
  AlertCircle,
  Wine,
  MapPin,
  Plus,
  Minus,
  Trash2,
  Users,
  MessageCircle,
  ClipboardList,
  UtensilsCrossed,
  Bike,
  ShoppingBag,
  Banknote,
  CreditCard,
  Smartphone,
  Copy,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
} from "@/lib/utils";
import type {
  CategoryWithProducts,
  ProductWithDetails,
  LocationRow,
  RestaurantDeliveryConfig,
} from "@/modules/tenant/queries";
import type {
  FulfillmentType,
  DirectPaymentMethod,
} from "@/lib/validators/orders";
import { submitDirectOrderAction } from "@/modules/orders/actions";

interface InteractiveMenuBrowserProps {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  menuTitle?: string;
  currencyCode: string;
  whatsappPhone?: string;
  privacyPolicyText?: string;
  deliveryConfig: RestaurantDeliveryConfig;
  authenticityBadge?: string;
  serviceChargeNote?: string;
  scheduleLabel?: string | null;
  serviceNotes?: string | null;
  categories: CategoryWithProducts[];
  locations?: LocationRow[];
  initialLocationSlug?: string;
  initialMode?: string;
  initialTableNumber?: string;
}

interface TableSelectionItem {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptionLabels: string[];
  portionLabel: string | null;
  exclusiveLocationId: string | null;
}

interface ConfirmedDirectOrderSummary {
  referenceCode: string;
  fulfillmentType: FulfillmentType;
  totalAmount: number;
  whatsappUrl: string;
  paymentSummary: string;
}

function resolveInitialMode(
  rawMode: string | undefined,
  rawTable: string | undefined,
  deliveryConfig: RestaurantDeliveryConfig
): FulfillmentType {
  if (rawTable && rawTable.trim().length > 0) {
    return "dine_in";
  }
  const normalized = (rawMode ?? "").trim().toLowerCase();
  if (
    (normalized === "domicilio" || normalized === "delivery") &&
    deliveryConfig.enabled
  ) {
    return "delivery";
  }
  if (
    (normalized === "recoger" || normalized === "pickup") &&
    deliveryConfig.pickupEnabled
  ) {
    return "pickup";
  }
  return "dine_in";
}

const PICKUP_SLOT_OPTIONS = [
  "En 20 minutos",
  "En 35 minutos",
  "En 1 hora",
  "Acordar hora exacta por WhatsApp",
] as const;

export function InteractiveMenuBrowser({
  restaurantId,
  restaurantSlug,
  restaurantName,
  menuTitle = "Carta Principal",
  currencyCode,
  whatsappPhone = "+573105550193",
  privacyPolicyText = "Autorizo el uso de mis datos de contacto para gestionar la entrega de mi pedido.",
  deliveryConfig,
  authenticityBadge,
  serviceChargeNote,
  scheduleLabel,
  serviceNotes,
  categories,
  locations = [],
  initialLocationSlug,
  initialMode,
  initialTableNumber,
}: InteractiveMenuBrowserProps) {
  const storageKey = `fenbapps:cart:v1:${restaurantSlug}`;
  const isQrTableSession = Boolean(
    (initialTableNumber && initialTableNumber.trim().length > 0) ||
      (initialMode && initialMode.trim().toLowerCase() === "mesa")
  );

  const [activeCategorySlug, setActiveCategorySlug] = useState<string>("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    if (initialLocationSlug && locations.length > 0) {
      const normalized = initialLocationSlug.trim().toLowerCase();
      const matched = locations.find(
        (l) => l.slug.toLowerCase() === normalized || l.id === normalized
      );
      if (matched) return matched.id;
    }
    return "all";
  });

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(() =>
    resolveInitialMode(initialMode, initialTableNumber, deliveryConfig)
  );
  const [tableNumber, setTableNumber] = useState<string>(
    initialTableNumber?.trim() ?? ""
  );

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyHighlights, setOnlyHighlights] = useState<boolean>(false);
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [dietaryTag, setDietaryTag] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithDetails | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  // Bag / Table Shortlist + Bill Splitter
  const [tableSelection, setTableSelection] = useState<TableSelectionItem[]>(
    []
  );
  const [hasHydratedStorage, setHasHydratedStorage] = useState<boolean>(false);
  const [isTableSheetOpen, setIsTableSheetOpen] = useState<boolean>(false);
  const [splitPeopleCount, setSplitPeopleCount] = useState<number>(2);
  const [includeServiceTip, setIncludeServiceTip] = useState<boolean>(true);

  // At-Home Checkout State (Delivery & Pickup)
  const [dispatchLocationId, setDispatchLocationId] = useState<string>(() => {
    if (initialLocationSlug && locations.length > 0) {
      const normalized = initialLocationSlug.trim().toLowerCase();
      const matched = locations.find(
        (l) => l.slug.toLowerCase() === normalized || l.id === normalized
      );
      if (matched) return matched.id;
    }
    return locations[0]?.id ?? "";
  });
  const [pickupSlot, setPickupSlot] = useState<string>(PICKUP_SLOT_OPTIONS[0]);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");

  // Payment Method State (Cash w/ Change Calculator, Card Dataphone, Bank Transfer)
  const [paymentMethod, setPaymentMethod] =
    useState<DirectPaymentMethod>("cash");
  const [cashNeedsChange, setCashNeedsChange] = useState<boolean>(false);
  const [cashBillInput, setCashBillInput] = useState<string>("");
  const [cardType, setCardType] = useState<"Débito" | "Crédito">("Crédito");
  const [copiedTransfer, setCopiedTransfer] = useState<boolean>(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedDirectOrderSummary | null>(null);
  const [isSubmittingOrder, startOrderTransition] = useTransition();

  // Hydrate persisted selection & delivery profile safely on client mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (Array.isArray(parsed.items)) {
          const validItems = parsed.items.filter(
            (it): it is TableSelectionItem =>
              typeof it === "object" &&
              it !== null &&
              typeof (it as TableSelectionItem).key === "string" &&
              typeof (it as TableSelectionItem).productId === "string" &&
              typeof (it as TableSelectionItem).quantity === "number" &&
              (it as TableSelectionItem).quantity > 0
          );
          if (validItems.length > 0) {
            setTableSelection(validItems);
          }
        }
        if (
          !initialMode &&
          !initialTableNumber &&
          (parsed.fulfillmentType === "dine_in" ||
            (parsed.fulfillmentType === "delivery" && deliveryConfig.enabled) ||
            (parsed.fulfillmentType === "pickup" &&
              deliveryConfig.pickupEnabled))
        ) {
          setFulfillmentType(parsed.fulfillmentType);
        }
        if (typeof parsed.customerName === "string") {
          setCustomerName(parsed.customerName);
        }
        if (typeof parsed.customerPhone === "string") {
          setCustomerPhone(parsed.customerPhone);
        }
        if (typeof parsed.deliveryAddress === "string") {
          setDeliveryAddress(parsed.deliveryAddress);
        }
        if (typeof parsed.deliveryNeighborhood === "string") {
          setDeliveryNeighborhood(parsed.deliveryNeighborhood);
        }
      }
    } catch {
      // Ignore storage read errors in private/restricted browsers
    } finally {
      setHasHydratedStorage(true);
    }
  }, [
    storageKey,
    initialMode,
    initialTableNumber,
    deliveryConfig.enabled,
    deliveryConfig.pickupEnabled,
  ]);

  // Persist cart & delivery profile changes to localStorage
  useEffect(() => {
    if (!hasHydratedStorage) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          items: tableSelection,
          fulfillmentType,
          customerName,
          customerPhone,
          deliveryAddress,
          deliveryNeighborhood,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hasHydratedStorage,
    storageKey,
    tableSelection,
    fulfillmentType,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryNeighborhood,
  ]);

  // Keep dispatch location aligned when user filters by a specific sede in the menu
  useEffect(() => {
    if (selectedLocationId !== "all") {
      setDispatchLocationId(selectedLocationId);
    }
  }, [selectedLocationId]);

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationRow>();
    for (const loc of locations) {
      map.set(loc.id, loc);
    }
    return map;
  }, [locations]);

  const activeLocationObj =
    selectedLocationId !== "all"
      ? locationMap.get(selectedLocationId) ?? null
      : null;

  const dispatchLocationObj =
    locationMap.get(dispatchLocationId) ?? locations[0] ?? null;

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .filter(
        (cat) => activeCategorySlug === "all" || cat.slug === activeCategorySlug
      )
      .map((cat) => {
        const matchingProducts = cat.products.filter((prod) => {
          if (
            selectedLocationId !== "all" &&
            prod.exclusive_location_id &&
            prod.exclusive_location_id !== selectedLocationId
          ) {
            return false;
          }
          if (onlyHighlights && !prod.is_featured && !prod.is_chef_choice) {
            return false;
          }
          if (onlyAvailable && prod.availability_status !== "available") {
            return false;
          }
          if (
            dietaryTag &&
            !prod.badges.some(
              (b) => b.toLowerCase() === dietaryTag.toLowerCase()
            )
          ) {
            return false;
          }
          if (!q) {
            return true;
          }
          const inName = prod.name.toLowerCase().includes(q);
          const inDesc =
            prod.short_description?.toLowerCase().includes(q) ?? false;
          const inBadges = prod.badges.some((b) =>
            b.toLowerCase().includes(q)
          );
          return inName || inDesc || inBadges;
        });

        return {
          ...cat,
          products: matchingProducts,
        };
      })
      .filter((cat) => cat.products.length > 0);
  }, [
    categories,
    activeCategorySlug,
    selectedLocationId,
    searchQuery,
    onlyHighlights,
    onlyAvailable,
    dietaryTag,
  ]);

  function openProductDetail(product: ProductWithDetails) {
    const initialSelections: Record<string, string> = {};
    for (const grp of product.optionGroups) {
      const firstAvailable = grp.options.find((o) => o.is_available);
      if (firstAvailable) {
        initialSelections[grp.id] = firstAvailable.id;
      }
    }
    setSelectedOptions(initialSelections);
    setSelectedProduct(product);
  }

  const computedDetailPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    let total = Number(selectedProduct.base_price);
    for (const grp of selectedProduct.optionGroups) {
      const chosenId = selectedOptions[grp.id];
      const chosenOpt = grp.options.find((o) => o.id === chosenId);
      if (chosenOpt) {
        total += Number(chosenOpt.price_delta);
      }
    }
    return total;
  }, [selectedProduct, selectedOptions]);

  function addProductToTableSelection(
    product: ProductWithDetails,
    customUnitPrice?: number,
    customOptionLabels?: string[]
  ) {
    if (product.availability_status === "sold_out") {
      toast.error("Este plato se encuentra agotado por hoy.");
      return;
    }

    const optionLabels =
      customOptionLabels ??
      product.optionGroups
        .map((g) => g.options.find((o) => o.is_available)?.name)
        .filter((n): n is string => Boolean(n));

    const unitPrice = customUnitPrice ?? Number(product.base_price);
    const key = `${product.id}::${optionLabels.join("|")}`;

    setConfirmedOrder(null);
    setTableSelection((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: 1,
          selectedOptionLabels: optionLabels,
          portionLabel: product.portion_label,
          exclusiveLocationId: product.exclusive_location_id ?? null,
        },
      ];
    });

    const destinationLabel =
      fulfillmentType === "delivery"
        ? "tu pedido a domicilio"
        : fulfillmentType === "pickup"
          ? "tu pedido para recoger"
          : "Mi Selección en Mesa";
    toast.success(`"${product.name}" agregado a ${destinationLabel}`);
  }

  function updateTableItemQuantity(key: string, delta: number) {
    setConfirmedOrder(null);
    setTableSelection((prev) =>
      prev
        .map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  const totalTableItems = useMemo(
    () => tableSelection.reduce((acc, item) => acc + item.quantity, 0),
    [tableSelection]
  );

  const tableSubtotal = useMemo(
    () =>
      tableSelection.reduce(
        (acc, item) => acc + item.unitPrice * item.quantity,
        0
      ),
    [tableSelection]
  );

  // Dine-In Calculations
  const tableTotalWithTip = includeServiceTip
    ? Math.round(tableSubtotal * 1.1)
    : tableSubtotal;

  const perPersonAmount =
    splitPeopleCount > 0
      ? Math.round(tableTotalWithTip / splitPeopleCount)
      : tableTotalWithTip;

  // Delivery & Pickup Calculations
  const qualifiesForFreeDelivery =
    deliveryConfig.freeDeliveryThreshold > 0 &&
    tableSubtotal >= deliveryConfig.freeDeliveryThreshold;

  const computedDeliveryFee =
    fulfillmentType === "delivery"
      ? qualifiesForFreeDelivery
        ? 0
        : deliveryConfig.deliveryFee
      : 0;

  const missingForFreeDelivery =
    fulfillmentType === "delivery" &&
    deliveryConfig.freeDeliveryThreshold > tableSubtotal
      ? deliveryConfig.freeDeliveryThreshold - tableSubtotal
      : 0;

  const missingForMinOrder =
    fulfillmentType === "delivery" &&
    deliveryConfig.minOrderAmount > tableSubtotal
      ? deliveryConfig.minOrderAmount - tableSubtotal
      : 0;

  const directOrderTotal = tableSubtotal + computedDeliveryFee;

  // Check if any item in the bag belongs exclusively to a DIFFERENT sede than the chosen dispatch sede
  const conflictingLocationItems = useMemo(() => {
    if (
      fulfillmentType === "dine_in" ||
      locations.length <= 1 ||
      !dispatchLocationId
    ) {
      return [];
    }
    return tableSelection.filter(
      (item) =>
        item.exclusiveLocationId &&
        item.exclusiveLocationId !== dispatchLocationId
    );
  }, [fulfillmentType, locations.length, dispatchLocationId, tableSelection]);

  const cashBillNumeric = cashBillInput === "" ? 0 : Number(cashBillInput);
  const cashChangeAmount =
    cashNeedsChange && cashBillNumeric >= directOrderTotal
      ? cashBillNumeric - directOrderTotal
      : 0;

  const suggestedBillAmounts = useMemo(() => {
    const candidates = [50000, 100000, 150000, 200000, 300000];
    return candidates.filter((amt) => amt >= directOrderTotal).slice(0, 3);
  }, [directOrderTotal]);

  const activeTotalDisplay =
    fulfillmentType === "dine_in" ? tableTotalWithTip : directOrderTotal;

  const targetWhatsAppPhone =
    dispatchLocationObj?.whatsapp_phone || whatsappPhone;

  const shareSelectionWhatsAppUrl = useMemo(() => {
    if (tableSelection.length === 0) return "#";
    const lines = tableSelection.map(
      (item) =>
        `• ${item.quantity}x ${item.name}${
          item.selectedOptionLabels.length > 0
            ? ` (${item.selectedOptionLabels.join(", ")})`
            : ""
        } — ${formatCurrency(item.unitPrice * item.quantity, currencyCode)}`
    );
    const tableHeader = tableNumber.trim()
      ? ` (Mesa ${tableNumber.trim()})`
      : "";
    const message =
      `Hola, comparto nuestra pre-selección de mesa${tableHeader} en *${restaurantName}*:\n\n` +
      lines.join("\n") +
      `\n\n• Total estimado${
        includeServiceTip ? " (con 10% servicio)" : ""
      }: *${formatCurrency(tableTotalWithTip, currencyCode)}*\n` +
      `• Por persona (${splitPeopleCount} ${
        splitPeopleCount === 1 ? "comensal" : "comensales"
      }): *${formatCurrency(perPersonAmount, currencyCode)}*`;

    return buildWhatsAppUrl(whatsappPhone, message);
  }, [
    tableSelection,
    tableNumber,
    restaurantName,
    currencyCode,
    includeServiceTip,
    tableTotalWithTip,
    splitPeopleCount,
    perPersonAmount,
    whatsappPhone,
  ]);

  function copyTransferInstructions() {
    navigator.clipboard.writeText(deliveryConfig.transferInstructions);
    setCopiedTransfer(true);
    toast.success("Datos de transferencia copiados al portapapeles");
    setTimeout(() => setCopiedTransfer(false), 2400);
  }

  function handleConfirmDirectOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCheckoutError(null);

    if (tableSelection.length === 0) {
      setCheckoutError("Agrega al menos un plato a tu pedido.");
      return;
    }

    if (
      fulfillmentType === "delivery" &&
      tableSubtotal < deliveryConfig.minOrderAmount
    ) {
      setCheckoutError(
        `El pedido mínimo a domicilio es de ${formatCurrency(
          deliveryConfig.minOrderAmount,
          currencyCode
        )}.`
      );
      return;
    }

    if (conflictingLocationItems.length > 0) {
      setCheckoutError(
        "Tienes platos exclusivos de otra sede en la bolsa. Ajusta la sede de despacho o retíralos antes de confirmar."
      );
      return;
    }

    if (!privacyAccepted) {
      setCheckoutError(
        "Por favor autoriza el uso de tus datos para coordinar la entrega."
      );
      return;
    }

    let computedPaymentDetails = "";
    if (paymentMethod === "cash") {
      if (cashNeedsChange) {
        if (!cashBillNumeric || cashBillNumeric < directOrderTotal) {
          setCheckoutError(
            `Ingresa un monto en efectivo igual o mayor al total (${formatCurrency(
              directOrderTotal,
              currencyCode
            )}) para calcular tus vueltas.`
          );
          return;
        }
        computedPaymentDetails = `Efectivo con ${formatCurrency(
          cashBillNumeric,
          currencyCode
        )} · Llevar cambio de ${formatCurrency(cashChangeAmount, currencyCode)}`;
      } else {
        computedPaymentDetails = "Efectivo · Cliente entrega valor exacto";
      }
    } else if (paymentMethod === "card_dataphone") {
      computedPaymentDetails = `Datáfono al entregar · Tarjeta ${cardType}`;
    } else {
      computedPaymentDetails =
        "Transferencia bancaria / Bre-B (envía comprobante por WhatsApp)";
    }

    startOrderTransition(async () => {
      const result = await submitDirectOrderAction({
        restaurantId,
        restaurantSlug,
        locationId: dispatchLocationObj?.id ?? null,
        fulfillmentType,
        tableNumber: fulfillmentType === "dine_in" ? tableNumber : "",
        pickupSlot: fulfillmentType === "pickup" ? pickupSlot : "",
        customerName,
        customerPhone,
        deliveryAddress:
          fulfillmentType === "delivery" ? deliveryAddress : "",
        deliveryNeighborhood:
          fulfillmentType === "delivery" ? deliveryNeighborhood : "",
        deliveryNotes,
        paymentMethod,
        paymentDetails: computedPaymentDetails,
        items: tableSelection.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          options: item.selectedOptionLabels,
        })),
        subtotalAmount: tableSubtotal,
        deliveryFee: computedDeliveryFee,
        totalAmount: directOrderTotal,
        privacyAccepted: true,
        websiteHoneypot: "",
      });

      if (!result.ok) {
        const msg =
          result.error ?? "Verifica los campos e intenta nuevamente.";
        setCheckoutError(msg);
        toast.error(msg);
        return;
      }

      const refCode = result.referenceCode ?? "PED-RECIBIDO";
      const itemLines = tableSelection.map(
        (it) =>
          `• ${it.quantity}x ${it.name}${
            it.selectedOptionLabels.length > 0
              ? ` (${it.selectedOptionLabels.join(", ")})`
              : ""
          } — ${formatCurrency(it.unitPrice * it.quantity, currencyCode)}`
      );

      const modeHeadline =
        fulfillmentType === "delivery"
          ? `🛵 *NUEVO PEDIDO A DOMICILIO · ${refCode}*`
          : `🛍️ *NUEVO PEDIDO PARA RECOGER · ${refCode}*`;

      const waMessage = [
        modeHeadline,
        `Restaurante: *${restaurantName}*${
          dispatchLocationObj ? ` (${dispatchLocationObj.name})` : ""
        }`,
        `Cliente: *${customerName.trim()}* (${customerPhone.trim()})`,
        fulfillmentType === "delivery"
          ? `Dirección: *${deliveryAddress.trim()}* (${deliveryNeighborhood.trim()})`
          : `Hora estimada de paso: *${pickupSlot}*`,
        deliveryNotes.trim() ? `Notas: ${deliveryNotes.trim()}` : null,
        "",
        "*Detalle del pedido:*",
        ...itemLines,
        "",
        `Subtotal: ${formatCurrency(tableSubtotal, currencyCode)}`,
        fulfillmentType === "delivery"
          ? `Domicilio: ${
              computedDeliveryFee === 0
                ? "SIN COSTO"
                : formatCurrency(computedDeliveryFee, currencyCode)
            }`
          : null,
        `*TOTAL A PAGAR: ${formatCurrency(directOrderTotal, currencyCode)}*`,
        `Pago: *${computedPaymentDetails}*`,
        paymentMethod === "transfer"
          ? "\n📎 Adjunto a continuación el comprobante de transferencia:"
          : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      const waUrl = buildWhatsAppUrl(targetWhatsAppPhone, waMessage);

      setConfirmedOrder({
        referenceCode: refCode,
        fulfillmentType,
        totalAmount: directOrderTotal,
        whatsappUrl: waUrl,
        paymentSummary: computedPaymentDetails,
      });
      setTableSelection([]);
      toast.success(`¡Pedido ${refCode} registrado exitosamente!`);
    });
  }

  const quickAddButtonLabel =
    fulfillmentType === "dine_in" ? "Mi Mesa" : "Pedir";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-28">
      {/* Editorial Menu Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-hairline pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {authenticityBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3 py-1 text-xs font-medium text-ivory">
                <Camera className="size-3.5 text-ember-glow" />
                {authenticityBadge}
              </span>
            )}
            {scheduleLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-3 py-1 text-xs text-ink-muted">
                <Clock className="size-3.5 text-ember" />
                {scheduleLabel}
              </span>
            )}
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {menuTitle}
          </h1>
        </div>

        {/* Search & Quick Filter Controls */}
        <div className="flex flex-col gap-2.5 sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[260px] sm:min-w-[280px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar corte, ingrediente o vino..."
                aria-label="Buscar en la carta"
                className="h-11 w-full rounded-full border border-hairline bg-canvas-elevated pl-10 pr-9 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ember focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyHighlights((prev) => !prev)}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                onlyHighlights
                  ? "border-ember bg-ember text-ivory"
                  : "border-hairline bg-canvas-elevated text-ink hover:border-ink/40"
              }`}
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span>Insignias del Chef</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                onlyAvailable
                  ? "border-obsidian bg-obsidian text-ivory"
                  : "border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
              }`}
            >
              Solo disponibles
            </button>
            {["Sin Gluten", "Vegetariano"].map((tag) => {
              const active = dietaryTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setDietaryTag(active ? null : tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-ember bg-ember/15 text-ember font-semibold"
                      : "border-hairline bg-canvas-elevated text-ink-muted hover:text-ink"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dual / Triple Customer Experience Switcher (Smart QR Context Detection) */}
      {(deliveryConfig.enabled || deliveryConfig.pickupEnabled) && (
        <div className="mb-4 rounded-2xl border border-hairline bg-canvas-elevated p-3 sm:px-5 sm:py-3.5">
          {isQrTableSession && fulfillmentType === "dine_in" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-ink">
                <UtensilsCrossed className="size-4 text-ember" />
                <span>
                  Estás viendo la carta en{" "}
                  <strong>
                    Modo Mesa{tableNumber ? ` #${tableNumber}` : ""}
                  </strong>
                  . Arma tu selección para mostrarla al mesero.
                </span>
              </div>
              {deliveryConfig.enabled && (
                <button
                  type="button"
                  onClick={() => setFulfillmentType("delivery")}
                  className="font-semibold text-ember underline-offset-2 hover:underline"
                >
                  ¿Prefieres pedir a domicilio?
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("dine_in")}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    fulfillmentType === "dine_in"
                      ? "bg-obsidian text-ivory shadow-xs"
                      : "bg-canvas text-ink-muted hover:text-ink"
                  }`}
                >
                  <UtensilsCrossed className="size-3.5 text-ember-glow" />
                  <span>En el Restaurante</span>
                </button>

                {deliveryConfig.enabled && (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("delivery")}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      fulfillmentType === "delivery"
                        ? "bg-ember text-ivory shadow-xs"
                        : "bg-canvas text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Bike className="size-3.5" />
                    <span>Pedir a Domicilio</span>
                  </button>
                )}

                {deliveryConfig.pickupEnabled && (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("pickup")}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      fulfillmentType === "pickup"
                        ? "bg-ember text-ivory shadow-xs"
                        : "bg-canvas text-ink-muted hover:text-ink"
                    }`}
                  >
                    <ShoppingBag className="size-3.5" />
                    <span>Pasar a Recoger</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-ink-muted">
                {fulfillmentType === "dine_in" && (
                  <span>
                    Pre-selecciona platos, divide la cuenta exacta o muéstrale a
                    tu mesero.
                  </span>
                )}
                {fulfillmentType === "delivery" && (
                  <span>
                    <strong className="text-ink">
                      Envío directo ({deliveryConfig.estimatedDeliveryMinutes}):
                    </strong>{" "}
                    {formatCurrency(deliveryConfig.deliveryFee, currencyCode)} ·{" "}
                    <span className="font-semibold text-sage">
                      Gratis desde{" "}
                      {formatCurrency(
                        deliveryConfig.freeDeliveryThreshold,
                        currencyCode
                      )}
                    </span>{" "}
                    · Pago en Efectivo, Datáfono o Transferencia.
                  </span>
                )}
                {fulfillmentType === "pickup" && (
                  <span>
                    <strong className="text-ink">
                      Listo en {deliveryConfig.estimatedPickupMinutes}:
                    </strong>{" "}
                    Sin costo de domicilio · Recoge directo en sede.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-Location Menu Selector & Differential Banner (Only rendered if restaurant has >1 location) */}
      {locations.length > 1 && (
        <div className="mb-5 rounded-2xl border border-hairline bg-canvas-elevated p-3.5 sm:px-5 sm:py-3.5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="size-4 shrink-0 text-ember" />
              <span className="font-semibold text-ink">
                Disponibilidad y especialidades por sede:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLocationId("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  selectedLocationId === "all"
                    ? "bg-obsidian text-ivory shadow-xs"
                    : "bg-canvas-muted text-ink-muted hover:text-ink"
                }`}
              >
                Todas las sedes ({locations.length})
              </button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLocationId(loc.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedLocationId === loc.id
                      ? "bg-ember text-ivory shadow-xs"
                      : "bg-canvas-muted text-ink-muted hover:text-ink"
                  }`}
                >
                  <span>{loc.name}</span>
                </button>
              ))}
            </div>
          </div>

          {activeLocationObj && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2.5 text-xs text-ink-muted">
              <p>
                Mostrando la carta disponible en{" "}
                <strong className="text-ink">{activeLocationObj.name}</strong> (
                {activeLocationObj.address_line}). Incluye cortes compartidos y
                especialidades exclusivas de esta sede.
              </p>
              {activeLocationObj.exclusive_features?.length > 0 && (
                <span className="rounded-full bg-ember/10 px-2.5 py-0.5 text-[11px] font-semibold text-ember">
                  Diferencial: {activeLocationObj.exclusive_features[0]}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Category Bar (Zero-Splash Mobile-First Navigation) */}
      <div
        role="tablist"
        aria-label="Categorías de la carta"
        className="sticky top-[105px] sm:top-[69px] z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-hairline bg-canvas/95 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-3 sm:py-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeCategorySlug === "all"}
          onClick={() => setActiveCategorySlug("all")}
          className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            activeCategorySlug === "all"
              ? "bg-obsidian text-ivory shadow-sm"
              : "bg-canvas-elevated text-ink-muted hover:text-ink"
          }`}
        >
          Toda la Carta
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategorySlug === cat.slug}
            onClick={() => setActiveCategorySlug(cat.slug)}
            className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCategorySlug === cat.slug
                ? "bg-obsidian text-ivory shadow-sm"
                : "bg-canvas-elevated text-ink-muted hover:text-ink"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Empty Search State */}
      {filteredCategories.length === 0 && (
        <div className="rounded-3xl border border-hairline bg-canvas-elevated p-12 text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-ember" />
          <h2 className="font-display text-2xl font-semibold text-ink">
            No encontramos platos que coincidan con tu filtro
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Prueba buscando otro corte, ingrediente o restablece los filtros
            para explorar toda nuestra carta.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setOnlyHighlights(false);
              setOnlyAvailable(false);
              setDietaryTag(null);
              setSelectedLocationId("all");
              setActiveCategorySlug("all");
            }}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-obsidian px-5 py-2.5 text-sm font-medium text-ivory transition hover:bg-ember"
          >
            Mostrar toda la carta
          </button>
        </div>
      )}

      {/* Category Sections */}
      <div className="flex flex-col gap-14">
        {filteredCategories.map((category, categoryIndex) => (
          <section
            key={category.id}
            id={`categoria-${category.slug}`}
            className="scroll-mt-44 sm:scroll-mt-36"
          >
            <div className="mb-6 border-b border-hairline pb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
                  {category.name}
                </h2>
                {category.subtitle && (
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-ember">
                    {category.subtitle}
                  </span>
                )}
              </div>
              {category.description && (
                <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                  {category.description}
                </p>
              )}
            </div>

            {category.display_mode === "compact_list" ? (
              /* Editorial Wine & Sides List with Rounded Square Reference Thumbnails */
              <div className="rounded-3xl border border-hairline bg-canvas-elevated p-5 sm:p-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                  <div className="flex items-center gap-2">
                    <Wine className="size-4 text-ember" />
                    <span>
                      Selección de Cava & Guarniciones con Referencia Visual
                    </span>
                  </div>
                  <span className="text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                    Toca cualquier vino o guarnición para ampliar su fotografía
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                  {category.products.map((product) => {
                    const isSoldOut =
                      product.availability_status === "sold_out";
                    const exclusiveLoc = product.exclusive_location_id
                      ? locationMap.get(product.exclusive_location_id)
                      : null;

                    return (
                      <div
                        key={product.id}
                        onClick={() => openProductDetail(product)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openProductDetail(product);
                          }
                        }}
                        className={`group flex items-start gap-4 rounded-2xl border border-dashed border-hairline bg-canvas/50 p-3.5 text-left transition cursor-pointer ${
                          isSoldOut
                            ? "opacity-60"
                            : "hover:border-ember hover:bg-canvas"
                        }`}
                      >
                        {product.image_url ? (
                          <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-obsidian shadow-xs">
                            <Image
                              src={product.image_url}
                              alt={product.image_alt ?? product.name}
                              fill
                              sizes="96px"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div className="flex size-20 sm:size-24 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-canvas-muted text-ember">
                            <Wine className="size-6" />
                          </div>
                        )}

                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="font-semibold text-ink group-hover:text-ember transition leading-snug">
                                {product.name}
                              </h3>
                              <span className="tabular-price shrink-0 font-mono text-sm sm:text-base font-semibold text-ink">
                                {formatCurrency(
                                  Number(product.base_price),
                                  currencyCode
                                )}
                              </span>
                            </div>

                            {product.short_description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                                {product.short_description}
                              </p>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {product.portion_label && (
                                <span className="text-[11px] font-medium text-ink-muted">
                                  {product.portion_label}
                                </span>
                              )}
                              {exclusiveLoc && (
                                <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold text-ember">
                                  Exclusivo {exclusiveLoc.name}
                                </span>
                              )}
                              {product.badges.slice(0, 2).map((badge) => (
                                <span
                                  key={badge}
                                  className="rounded-full bg-canvas-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>

                            {!isSoldOut && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductToTableSelection(product);
                                }}
                                aria-label={`Agregar ${product.name}`}
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas-elevated px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-ember hover:bg-ember hover:text-ivory"
                              >
                                <Plus className="size-3" />
                                <span>{quickAddButtonLabel}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* High-Impact Editorial Photo Grid */
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {category.products.map((product, productIndex) => {
                  const isSoldOut = product.availability_status === "sold_out";
                  const exclusiveLoc = product.exclusive_location_id
                    ? locationMap.get(product.exclusive_location_id)
                    : null;

                  return (
                    <article
                      key={product.id}
                      onClick={() => openProductDetail(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openProductDetail(product);
                        }
                      }}
                      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated transition duration-200 cursor-pointer ${
                        isSoldOut
                          ? "opacity-75"
                          : "hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-lg"
                      }`}
                    >
                      {product.image_url && (
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian">
                          <Image
                            src={product.image_url}
                            alt={product.image_alt ?? product.name}
                            fill
                            priority={categoryIndex === 0 && productIndex < 2}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className={`object-cover transition duration-500 ${
                              isSoldOut
                                ? "grayscale-[45%]"
                                : "group-hover:scale-105"
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-transparent" />

                          {/* Top Badges */}
                          <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-1.5">
                            {isSoldOut ? (
                              <span className="rounded-full bg-obsidian/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-warn border border-amber-warn/40">
                                Agotado por hoy
                              </span>
                            ) : (
                              <>
                                {product.is_chef_choice && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-obsidian/90 px-3 py-1 text-xs font-medium text-gold border border-gold/30">
                                    <Flame className="size-3 text-ember-glow" />
                                    Corte Insignia
                                  </span>
                                )}
                                {product.is_new && (
                                  <span className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                                    Nuevo
                                  </span>
                                )}
                                {exclusiveLoc && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-obsidian/90 px-3 py-1 text-xs font-medium text-ivory border border-ember/50">
                                    <MapPin className="size-3 text-ember-glow" />
                                    Exclusivo {exclusiveLoc.name}
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Price Pill Overlay */}
                          <div className="absolute bottom-3 right-3.5 rounded-full bg-obsidian/90 px-3.5 py-1.5 backdrop-blur-sm border border-obsidian-border">
                            <span className="tabular-price font-mono text-sm font-semibold text-ivory">
                              {formatCurrency(
                                Number(product.base_price),
                                currencyCode
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-display text-2xl font-semibold text-ink group-hover:text-ember transition">
                              {product.name}
                            </h3>
                            {!product.image_url && (
                              <span className="tabular-price font-mono text-base font-semibold text-ink">
                                {formatCurrency(
                                  Number(product.base_price),
                                  currencyCode
                                )}
                              </span>
                            )}
                          </div>

                          {product.short_description && (
                            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                              {product.short_description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5">
                          <span className="text-xs font-medium text-ink-muted">
                            {product.portion_label ?? "Preparado al momento"}
                          </span>

                          <div className="flex items-center gap-2">
                            {!isSoldOut && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (product.optionGroups.length > 0) {
                                    openProductDetail(product);
                                  } else {
                                    addProductToTableSelection(product);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-3 py-1 text-xs font-semibold text-ink transition hover:border-ember hover:bg-ember hover:text-ivory"
                              >
                                <Plus className="size-3.5" />
                                <span>{quickAddButtonLabel}</span>
                              </button>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ember group-hover:translate-x-0.5 transition">
                              {product.optionGroups.length > 0
                                ? "Términos y guarniciones"
                                : "Ver detalle"}
                              <ChevronRight className="size-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Footer Service & Transparency Notes */}
      {(serviceChargeNote || serviceNotes) && (
        <div className="mt-14 rounded-2xl border border-hairline bg-canvas-muted/60 p-5 text-xs text-ink-muted">
          <p className="font-semibold text-ink">{restaurantName}</p>
          {serviceChargeNote && <p className="mt-1">{serviceChargeNote}</p>}
          {serviceNotes && <p className="mt-1">{serviceNotes}</p>}
        </div>
      )}

      {/* Floating Bottom Bar: Adapts cleanly to Dine-In vs Delivery vs Pickup */}
      {(totalTableItems > 0 || confirmedOrder) && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => setIsTableSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-obsidian px-5 py-3.5 text-ivory shadow-2xl transition hover:border-gold"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember font-mono text-sm font-bold text-ivory">
                {confirmedOrder ? "✓" : totalTableItems}
              </span>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-gold">
                  {confirmedOrder
                    ? `Pedido Confirmado · ${confirmedOrder.referenceCode}`
                    : fulfillmentType === "delivery"
                      ? "Mi Pedido a Domicilio · Checkout Directo"
                      : fulfillmentType === "pickup"
                        ? "Mi Pedido para Recoger en Sede"
                        : "Mi Selección en Mesa · Mostrar al Mesero"}
                </span>
                <span className="block text-xs text-ivory-muted">
                  {confirmedOrder
                    ? "Toca para ver el código o enviar por WhatsApp"
                    : fulfillmentType === "dine_in"
                      ? "Divide cuenta, cambia a domicilio o comparte en WhatsApp"
                      : missingForFreeDelivery > 0
                        ? `Te faltan ${formatCurrency(
                            missingForFreeDelivery,
                            currencyCode
                          )} para envío gratis`
                        : "Completa dirección y medio de pago (Efectivo, Datáfono o Transferencia)"}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="tabular-price block font-mono text-base font-bold text-ivory">
                {formatCurrency(
                  confirmedOrder
                    ? confirmedOrder.totalAmount
                    : activeTotalDisplay,
                  currencyCode
                )}
              </span>
              <span className="block text-[10px] text-ivory-muted">
                {fulfillmentType === "dine_in" ? "Ver resumen >" : "Continuar >"}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Interactive Product Detail Sheet / Modal */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/75 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-hairline bg-canvas-elevated shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label="Cerrar detalle del plato"
              className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full bg-obsidian/85 text-ivory shadow-md transition hover:bg-obsidian"
            >
              <X className="size-5" />
            </button>

            <div className="flex-1 overflow-y-auto">
              {selectedProduct.image_url && (
                <div className="relative h-48 sm:h-52 w-full bg-obsidian">
                  <Image
                    src={selectedProduct.image_url}
                    alt={selectedProduct.image_alt ?? selectedProduct.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 600px"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 pr-10">
                  {selectedProduct.availability_status === "sold_out" && (
                    <span className="rounded-full bg-amber-warn/15 px-3 py-1 text-xs font-semibold text-amber-warn">
                      Agotado por hoy
                    </span>
                  )}
                  {selectedProduct.exclusive_location_id &&
                    locationMap.get(selectedProduct.exclusive_location_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-3 py-1 text-xs font-semibold text-ember">
                        <MapPin className="size-3" />
                        Exclusivo{" "}
                        {
                          locationMap.get(selectedProduct.exclusive_location_id)
                            ?.name
                        }
                      </span>
                    )}
                  {selectedProduct.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-canvas-muted px-2.5 py-1 text-xs font-medium text-ink-muted"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <h2
                  id="product-modal-title"
                  className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-ink"
                >
                  {selectedProduct.name}
                </h2>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {selectedProduct.portion_label && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-ember">
                      {selectedProduct.portion_label}
                    </p>
                  )}
                  {selectedProduct.optionGroups.length > 0 && (
                    <a
                      href="#product-modal-options"
                      className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-3 py-0.5 text-[11px] font-semibold text-ember transition hover:bg-ember hover:text-ivory"
                    >
                      <span>Personalizar término y guarnición ↓</span>
                    </a>
                  )}
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                  {selectedProduct.long_description ??
                    selectedProduct.short_description}
                </p>

                {selectedProduct.pairing_note && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold/30 bg-obsidian p-3.5 text-ivory">
                    <Wine className="mt-0.5 size-4 shrink-0 text-gold" />
                    <div>
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold">
                        Sugerencia de Maridaje · Sommelier
                      </span>
                      <p className="mt-0.5 text-xs leading-relaxed text-ivory-muted">
                        {selectedProduct.pairing_note}
                      </p>
                    </div>
                  </div>
                )}

                {selectedProduct.optionGroups.length > 0 && (
                  <div
                    id="product-modal-options"
                    className="mt-5 flex flex-col gap-5 border-t border-hairline pt-4"
                  >
                    {selectedProduct.optionGroups.map((group) => (
                      <div key={group.id}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-ink">
                            {group.name}
                          </h3>
                          {group.is_required && (
                            <span className="shrink-0 rounded-full bg-obsidian px-2.5 py-0.5 text-[11px] font-medium text-ivory">
                              Requerido
                            </span>
                          )}
                        </div>
                        {group.helper_text && (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {group.helper_text}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-col gap-2">
                          {group.options.map((opt) => {
                            const isSelected =
                              selectedOptions[group.id] === opt.id;
                            const delta = Number(opt.price_delta);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [group.id]: opt.id,
                                  }))
                                }
                                className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                                  isSelected
                                    ? "border-ember bg-ember/8 font-medium text-ink"
                                    : "border-hairline bg-canvas text-ink-muted hover:border-ink/30"
                                }`}
                              >
                                <span className="flex items-center gap-2.5">
                                  <span
                                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                      isSelected
                                        ? "border-ember bg-ember text-ivory"
                                        : "border-ink-muted"
                                    }`}
                                  >
                                    {isSelected && <Check className="size-2.5" />}
                                  </span>
                                  <span>{opt.name}</span>
                                </span>
                                <span className="tabular-price shrink-0 whitespace-nowrap font-mono text-xs font-semibold text-ink">
                                  {delta > 0
                                    ? `+ ${formatCurrency(delta, currencyCode)}`
                                    : "Incluido"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas-elevated px-6 py-4 sm:px-7">
              <div>
                <span className="block text-xs text-ink-muted">
                  Precio en carta{" "}
                  {selectedProduct.optionGroups.length > 0
                    ? "con selección"
                    : ""}
                </span>
                <span className="tabular-price font-mono text-2xl font-semibold text-ink">
                  {formatCurrency(computedDetailPrice, currencyCode)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {selectedProduct.availability_status !== "sold_out" && (
                  <button
                    type="button"
                    onClick={() => {
                      const chosenLabels = selectedProduct.optionGroups
                        .map((grp) => {
                          const chosenId = selectedOptions[grp.id];
                          return grp.options.find((o) => o.id === chosenId)
                            ?.name;
                        })
                        .filter((n): n is string => Boolean(n));

                      addProductToTableSelection(
                        selectedProduct,
                        computedDetailPrice,
                        chosenLabels
                      );
                      setSelectedProduct(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-ember px-5 py-2.5 text-xs sm:text-sm font-semibold text-ivory transition hover:bg-ember-hover"
                  >
                    <Plus className="size-4" />
                    <span>
                      {fulfillmentType === "dine_in"
                        ? "Agregar a mi mesa"
                        : "Agregar al pedido"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-obsidian px-4 py-2.5 text-xs sm:text-sm font-medium text-ivory transition hover:bg-obsidian/80"
                >
                  Seguir explorando
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dual Composer Sheet: Dine-In Shortlist & Bill Splitter OR Delivery/Pickup Checkout */}
      {isTableSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Resumen de Selección y Pedido"
          className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/80 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setIsTableSheetOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-obsidian-border bg-obsidian text-ivory shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + 1-Tap Experience Switcher inside the Drawer */}
            <div className="border-b border-obsidian-border px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {fulfillmentType === "delivery" ? (
                    <Bike className="size-5 text-ember-glow" />
                  ) : fulfillmentType === "pickup" ? (
                    <ShoppingBag className="size-5 text-ember-glow" />
                  ) : (
                    <ClipboardList className="size-5 text-ember-glow" />
                  )}
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-ivory">
                      {confirmedOrder
                        ? `Pedido Confirmado · ${confirmedOrder.referenceCode}`
                        : fulfillmentType === "delivery"
                          ? "Tu Pedido a Domicilio"
                          : fulfillmentType === "pickup"
                            ? "Tu Pedido para Recoger"
                            : "Mi Selección en Mesa"}
                    </h2>
                    <p className="text-xs text-ivory-muted">
                      {confirmedOrder
                        ? "Registrado en el sistema del restaurante"
                        : fulfillmentType === "dine_in"
                          ? "Muéstrale esta pantalla a tu mesero o divide la cuenta exacta"
                          : "Canal directo sin recargos · Pago contra entrega o transferencia"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTableSheetOpen(false)}
                  aria-label="Cerrar resumen de pedido"
                  className="flex size-9 items-center justify-center rounded-full bg-obsidian-card text-ivory-muted hover:text-ivory"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Mode Selector Pills inside Drawer */}
              {!confirmedOrder &&
                (deliveryConfig.enabled || deliveryConfig.pickupEnabled) && (
                  <div
                    role="tablist"
                    aria-label="¿Dónde vas a disfrutar tu pedido?"
                    className="grid grid-cols-3 gap-1.5 rounded-2xl border border-obsidian-border bg-obsidian-card p-1 text-xs"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={fulfillmentType === "dine_in"}
                      onClick={() => {
                        setFulfillmentType("dine_in");
                        setCheckoutError(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold transition ${
                        fulfillmentType === "dine_in"
                          ? "bg-ember text-ivory shadow-xs"
                          : "text-ivory-muted hover:text-ivory"
                      }`}
                    >
                      <UtensilsCrossed className="size-3.5" />
                      <span>En Mesa</span>
                    </button>

                    {deliveryConfig.enabled && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={fulfillmentType === "delivery"}
                        onClick={() => {
                          setFulfillmentType("delivery");
                          setCheckoutError(null);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold transition ${
                          fulfillmentType === "delivery"
                            ? "bg-ember text-ivory shadow-xs"
                            : "text-ivory-muted hover:text-ivory"
                        }`}
                      >
                        <Bike className="size-3.5" />
                        <span>Domicilio</span>
                      </button>
                    )}

                    {deliveryConfig.pickupEnabled && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={fulfillmentType === "pickup"}
                        onClick={() => {
                          setFulfillmentType("pickup");
                          setCheckoutError(null);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold transition ${
                          fulfillmentType === "pickup"
                            ? "bg-ember text-ivory shadow-xs"
                            : "text-ivory-muted hover:text-ivory"
                        }`}
                      >
                        <ShoppingBag className="size-3.5" />
                        <span>Recoger</span>
                      </button>
                    )}
                  </div>
                )}
            </div>

            {/* Confirmed Order State */}
            {confirmedOrder ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="rounded-3xl border border-sage/40 bg-obsidian-card p-6 text-center space-y-3">
                  <CheckCircle2 className="mx-auto size-11 text-sage" />
                  <span className="inline-block rounded-full bg-gold/15 px-3.5 py-1 font-mono text-xs font-bold text-gold">
                    CÓDIGO {confirmedOrder.referenceCode}
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-ivory">
                    ¡Recibimos tu pedido en cocina!
                  </h3>
                  <p className="text-xs leading-relaxed text-ivory-muted">
                    Tu orden por{" "}
                    <strong className="text-ivory">
                      {formatCurrency(confirmedOrder.totalAmount, currencyCode)}
                    </strong>{" "}
                    ({confirmedOrder.paymentSummary}) quedó registrada en el
                    sistema de <strong>{restaurantName}</strong>.
                  </p>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <a
                      href={confirmedOrder.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-5 py-3 text-sm font-semibold text-ivory shadow-lg transition hover:bg-ember-hover"
                    >
                      <MessageCircle className="size-4" />
                      <span>
                        Enviar confirmación por WhatsApp{" "}
                        {paymentMethod === "transfer" ? "(y comprobante)" : ""}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedOrder(null);
                        setIsTableSheetOpen(false);
                      }}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-obsidian-border text-xs font-semibold text-ivory-muted hover:text-ivory"
                    >
                      Volver a la carta
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Order / Table Shortlist Body */
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Itemized List */}
                <div className="space-y-2.5">
                  {tableSelection.map((item) => {
                    const exclusiveLoc = item.exclusiveLocationId
                      ? locationMap.get(item.exclusiveLocationId)
                      : null;

                    return (
                      <div
                        key={item.key}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-obsidian-border bg-obsidian-card p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-lg font-semibold text-ivory leading-snug">
                            {item.quantity}x {item.name}
                          </p>
                          {item.selectedOptionLabels.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-gold">
                              {item.selectedOptionLabels.map((lbl) => (
                                <li key={lbl}>• {lbl}</li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="tabular-price font-mono text-xs text-ivory-muted">
                              {formatCurrency(item.unitPrice, currencyCode)} c/u
                            </span>
                            {exclusiveLoc && (
                              <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-semibold text-ember-glow">
                                Exclusivo {exclusiveLoc.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="tabular-price font-mono text-sm font-semibold text-ivory">
                            {formatCurrency(
                              item.unitPrice * item.quantity,
                              currencyCode
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian px-2 py-1">
                            <button
                              type="button"
                              aria-label={`Quitar una unidad de ${item.name}`}
                              onClick={() =>
                                updateTableItemQuantity(item.key, -1)
                              }
                              className="flex size-6 items-center justify-center rounded-full text-ivory-muted hover:bg-obsidian-card hover:text-ivory"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="font-mono text-xs font-semibold px-1">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Sumar una unidad de ${item.name}`}
                              onClick={() =>
                                updateTableItemQuantity(item.key, 1)
                              }
                              className="flex size-6 items-center justify-center rounded-full text-ivory-muted hover:bg-obsidian-card hover:text-ivory"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* MODE 1: DINE-IN ("EN EL RESTAURANTE") */}
                {fulfillmentType === "dine_in" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-obsidian-border bg-obsidian-card px-4 py-3">
                      <label
                        htmlFor="dineInTableNumber"
                        className="text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                      >
                        Número de mesa (opcional)
                      </label>
                      <input
                        id="dineInTableNumber"
                        type="text"
                        value={tableNumber}
                        onChange={(e) =>
                          setTableNumber(e.target.value.slice(0, 16))
                        }
                        placeholder="Ej. 12 o Terraza 3"
                        className="h-9 w-36 rounded-xl border border-obsidian-border bg-obsidian px-3 text-right font-mono text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                      />
                    </div>

                    {/* Flexible 1–30 Diners Bill Splitter & Service Tip Calculator */}
                    <div className="rounded-2xl border border-gold/30 bg-obsidian-card/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-border pb-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                          <Users className="size-3.5" />
                          Dividir cuenta:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setSplitPeopleCount(n)}
                              className={`size-8 rounded-full font-mono text-xs font-semibold transition ${
                                splitPeopleCount === n
                                  ? "bg-ember text-ivory"
                                  : "bg-obsidian text-ivory-muted hover:text-ivory"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                          <div className="ml-1 flex items-center gap-1 rounded-full border border-obsidian-border bg-obsidian px-2 py-0.5">
                            <button
                              type="button"
                              aria-label="Menos comensales"
                              onClick={() =>
                                setSplitPeopleCount((c) => Math.max(1, c - 1))
                              }
                              className="flex size-6 items-center justify-center rounded-full text-xs text-ivory-muted hover:text-ivory"
                            >
                              −
                            </button>
                            <span className="min-w-6 text-center font-mono text-xs font-bold text-gold">
                              {splitPeopleCount}p
                            </span>
                            <button
                              type="button"
                              aria-label="Más comensales"
                              onClick={() =>
                                setSplitPeopleCount((c) => Math.min(30, c + 1))
                              }
                              className="flex size-6 items-center justify-center rounded-full text-xs text-ivory-muted hover:text-ivory"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="mt-3 flex cursor-pointer items-center justify-between text-xs text-ivory-muted">
                        <span>Incluir servicio voluntario sugerido (10%)</span>
                        <input
                          type="checkbox"
                          checked={includeServiceTip}
                          onChange={(e) =>
                            setIncludeServiceTip(e.target.checked)
                          }
                          className="size-4 accent-ember"
                        />
                      </label>

                      <div className="mt-3 flex items-baseline justify-between border-t border-obsidian-border pt-3">
                        <div>
                          <span className="block text-xs text-ivory-muted">
                            Total estimado de la mesa
                          </span>
                          <span className="tabular-price font-mono text-xl font-bold text-ivory">
                            {formatCurrency(tableTotalWithTip, currencyCode)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs text-gold">
                            Por persona ({splitPeopleCount}{" "}
                            {splitPeopleCount === 1
                              ? "comensal"
                              : "comensales"}
                            )
                          </span>
                          <span className="tabular-price font-mono text-lg font-bold text-gold">
                            {formatCurrency(perPersonAmount, currencyCode)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MODE 2 & 3: AT-HOME DELIVERY & PICKUP CHECKOUT FORM */
                  <form
                    id="direct-order-checkout-form"
                    onSubmit={handleConfirmDirectOrder}
                    className="space-y-4 border-t border-obsidian-border pt-4"
                  >
                    {/* Free Shipping / Min Order Commercial Indicator */}
                    {fulfillmentType === "delivery" && (
                      <div className="rounded-2xl border border-obsidian-border bg-obsidian-card px-4 py-3 text-xs">
                        {missingForMinOrder > 0 ? (
                          <p className="text-amber-warn font-medium">
                            Pedido mínimo a domicilio:{" "}
                            <strong>
                              {formatCurrency(
                                deliveryConfig.minOrderAmount,
                                currencyCode
                              )}
                            </strong>{" "}
                            (agrega{" "}
                            {formatCurrency(missingForMinOrder, currencyCode)}{" "}
                            más).
                          </p>
                        ) : qualifiesForFreeDelivery ? (
                          <p className="text-sage font-semibold">
                            ✓ ¡Tu pedido tiene envío SIN COSTO!
                          </p>
                        ) : (
                          <p className="text-ivory-muted">
                            Costo de envío:{" "}
                            <strong className="text-ivory">
                              {formatCurrency(
                                computedDeliveryFee,
                                currencyCode
                              )}
                            </strong>{" "}
                            · Agrega{" "}
                            <strong className="text-gold">
                              {formatCurrency(
                                missingForFreeDelivery,
                                currencyCode
                              )}
                            </strong>{" "}
                            más para envío gratis.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Multi-Location Dispatch Selector + Exclusivity Guard */}
                    {locations.length > 1 ? (
                      <div>
                        <label
                          htmlFor="dispatchLocationSelect"
                          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                        >
                          {fulfillmentType === "delivery"
                            ? "Sede desde donde despachamos *"
                            : "Sede donde pasas a recoger *"}
                        </label>
                        <select
                          id="dispatchLocationSelect"
                          value={dispatchLocationId}
                          onChange={(e) =>
                            setDispatchLocationId(e.target.value)
                          }
                          className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory focus:border-ember focus:outline-none"
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} · {loc.address_line}
                            </option>
                          ))}
                        </select>

                        {conflictingLocationItems.length > 0 && (
                          <div className="mt-2 rounded-xl border border-amber-warn/50 bg-amber-warn/15 p-3 text-xs text-ivory">
                            <p className="font-semibold text-amber-warn">
                              Atención: Plato exclusivo de otra sede
                            </p>
                            <p className="mt-0.5 text-ivory-muted">
                              <strong>
                                {conflictingLocationItems
                                  .map((i) => i.name)
                                  .join(", ")}
                              </strong>{" "}
                              solo se prepara en{" "}
                              {locationMap.get(
                                conflictingLocationItems[0]
                                  ?.exclusiveLocationId ?? ""
                              )?.name ?? "otra sede"}
                              .
                            </p>
                            {conflictingLocationItems[0]
                              ?.exclusiveLocationId && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDispatchLocationId(
                                    conflictingLocationItems[0]!
                                      .exclusiveLocationId!
                                  )
                                }
                                className="mt-2 rounded-full bg-ember px-3 py-1 text-[11px] font-semibold text-ivory"
                              >
                                Cambiar despacho a{" "}
                                {
                                  locationMap.get(
                                    conflictingLocationItems[0]
                                      .exclusiveLocationId
                                  )?.name
                                }
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      dispatchLocationObj && (
                        <div className="flex items-center gap-2 rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 py-2.5 text-xs text-ivory-muted">
                          <MapPin className="size-3.5 shrink-0 text-ember-glow" />
                          <span>
                            {fulfillmentType === "delivery"
                              ? "Despacho directo desde"
                              : "Punto de recogida:"}{" "}
                            <strong className="text-ivory">
                              {dispatchLocationObj.name}
                            </strong>{" "}
                            ({dispatchLocationObj.address_line})
                          </span>
                        </div>
                      )
                    )}

                    {/* Customer Name & Phone */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="orderCustomerName"
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                        >
                          Tu nombre *
                        </label>
                        <input
                          id="orderCustomerName"
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ej. Alejandro Gómez"
                          className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="orderCustomerPhone"
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                        >
                          WhatsApp / Celular *
                        </label>
                        <input
                          id="orderCustomerPhone"
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="310 555 0199"
                          className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 font-mono text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Delivery Address OR Pickup Time Slot */}
                    {fulfillmentType === "delivery" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="orderDeliveryAddress"
                            className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                          >
                            Dirección exacta y Apto / Torre *
                          </label>
                          <input
                            id="orderDeliveryAddress"
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Ej. Calle 94 # 11A-32 · Apto 502"
                            className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="orderDeliveryNeighborhood"
                            className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                          >
                            Barrio / Sector *
                          </label>
                          <input
                            id="orderDeliveryNeighborhood"
                            type="text"
                            required
                            value={deliveryNeighborhood}
                            onChange={(e) =>
                              setDeliveryNeighborhood(e.target.value)
                            }
                            placeholder="Ej. Chicó Norte"
                            className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="orderPickupSlot"
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                        >
                          ¿En cuánto tiempo pasas a recoger? *
                        </label>
                        <select
                          id="orderPickupSlot"
                          value={pickupSlot}
                          onChange={(e) => setPickupSlot(e.target.value)}
                          className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory focus:border-ember focus:outline-none"
                        >
                          {PICKUP_SLOT_OPTIONS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="orderDeliveryNotes"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted"
                      >
                        Indicaciones de entrega o cocina (opcional)
                      </label>
                      <input
                        id="orderDeliveryNotes"
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Ej. Portería sobre la carrera, salsas aparte, sin cebolla..."
                        className="h-10 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                      />
                    </div>

                    {/* Payment Method Selector: Cash, Card/Dataphone, Bank Transfer */}
                    <div className="space-y-2.5">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold">
                        ¿Cómo deseas pagar tu pedido? *
                      </span>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "cash"
                              ? "border-ember bg-ember/15 text-ivory"
                              : "border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
                          }`}
                        >
                          <Banknote className="size-4 text-ember-glow" />
                          <span>Efectivo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("card_dataphone")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "card_dataphone"
                              ? "border-ember bg-ember/15 text-ivory"
                              : "border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
                          }`}
                        >
                          <CreditCard className="size-4 text-ember-glow" />
                          <span>Tarjeta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("transfer")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "transfer"
                              ? "border-ember bg-ember/15 text-ivory"
                              : "border-obsidian-border bg-obsidian-card text-ivory-muted hover:text-ivory"
                          }`}
                        >
                          <Smartphone className="size-4 text-ember-glow" />
                          <span>Transferencia</span>
                        </button>
                      </div>

                      {/* Contextual Payment Details Box */}
                      {paymentMethod === "cash" && (
                        <div className="rounded-2xl border border-obsidian-border bg-obsidian-card p-3.5 space-y-2.5 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCashNeedsChange(false);
                                setCashBillInput("");
                              }}
                              className={`rounded-full px-3 py-1 font-semibold transition ${
                                !cashNeedsChange
                                  ? "bg-obsidian text-gold border border-gold/40"
                                  : "bg-obsidian/50 text-ivory-muted"
                              }`}
                            >
                              Entrego valor exacto
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashNeedsChange(true)}
                              className={`rounded-full px-3 py-1 font-semibold transition ${
                                cashNeedsChange
                                  ? "bg-obsidian text-gold border border-gold/40"
                                  : "bg-obsidian/50 text-ivory-muted"
                              }`}
                            >
                              Necesito vueltas / cambio
                            </button>
                          </div>

                          {cashNeedsChange && (
                            <div className="space-y-2 pt-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {suggestedBillAmounts.map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() =>
                                      setCashBillInput(String(amt))
                                    }
                                    className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                                      cashBillNumeric === amt
                                        ? "border-ember bg-ember text-ivory"
                                        : "border-obsidian-border bg-obsidian text-ivory-muted"
                                    }`}
                                  >
                                    {formatCurrency(amt, currencyCode)}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  id="cashBillAmountInput"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={cashBillInput}
                                  onChange={(e) =>
                                    setCashBillInput(
                                      sanitizeNumericInput(e.target.value, 8)
                                    )
                                  }
                                  placeholder="¿Con cuánto pagas? Ej. 200000"
                                  className="h-9 flex-1 rounded-xl border border-obsidian-border bg-obsidian px-3 font-mono text-xs text-ivory placeholder:text-ivory-muted/40 focus:border-ember focus:outline-none"
                                />
                                {cashBillNumeric >= directOrderTotal && (
                                  <span className="shrink-0 font-mono text-xs font-semibold text-sage">
                                    Vueltas:{" "}
                                    {formatCurrency(
                                      cashChangeAmount,
                                      currencyCode
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {paymentMethod === "card_dataphone" && (
                        <div className="rounded-2xl border border-obsidian-border bg-obsidian-card p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-ivory-muted">
                            Enviamos datáfono inalámbrico:
                          </span>
                          <div className="flex gap-1.5">
                            {(["Débito", "Crédito"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setCardType(t)}
                                className={`rounded-full px-3 py-1 font-semibold transition ${
                                  cardType === t
                                    ? "bg-ember text-ivory"
                                    : "bg-obsidian text-ivory-muted"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {paymentMethod === "transfer" && (
                        <div className="rounded-2xl border border-gold/30 bg-obsidian-card p-3.5 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-mono text-[11px] leading-relaxed text-ivory">
                              {deliveryConfig.transferInstructions}
                            </p>
                            <button
                              type="button"
                              onClick={copyTransferInstructions}
                              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-obsidian-border bg-obsidian px-2.5 py-1 text-[11px] font-semibold text-gold hover:border-gold"
                            >
                              {copiedTransfer ? (
                                <>
                                  <Check className="size-3 text-sage" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-ivory-muted">
                            Al confirmar se generará tu código de orden y podrás
                            adjuntar el comprobante directo en nuestro WhatsApp.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Totals Summary Card */}
                    <div className="rounded-2xl border border-gold/30 bg-obsidian-card/90 p-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-ivory-muted">
                        <span>Subtotal platos ({totalTableItems})</span>
                        <span className="tabular-price font-mono">
                          {formatCurrency(tableSubtotal, currencyCode)}
                        </span>
                      </div>
                      {fulfillmentType === "delivery" && (
                        <div className="flex justify-between text-ivory-muted">
                          <span>Costo de domicilio</span>
                          <span className="tabular-price font-mono">
                            {computedDeliveryFee === 0 ? (
                              <strong className="text-sage">SIN COSTO</strong>
                            ) : (
                              formatCurrency(computedDeliveryFee, currencyCode)
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between border-t border-obsidian-border pt-2">
                        <span className="font-semibold text-ivory">
                          Total a pagar
                        </span>
                        <span className="tabular-price font-mono text-xl font-bold text-gold">
                          {formatCurrency(directOrderTotal, currencyCode)}
                        </span>
                      </div>
                    </div>

                    {/* Privacy Consent */}
                    <label className="flex cursor-pointer items-start gap-2.5 text-[11px] text-ivory-muted">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="mt-0.5 size-3.5 accent-ember"
                      />
                      <span>{privacyPolicyText}</span>
                    </label>

                    {checkoutError && (
                      <div
                        role="alert"
                        className="rounded-xl border border-crimson/50 bg-crimson/15 px-3.5 py-2.5 text-xs font-medium text-ivory"
                      >
                        {checkoutError}
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* Drawer Footer Actions */}
            {!confirmedOrder && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-border bg-obsidian-card px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setTableSelection([]);
                    setIsTableSheetOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ivory-muted hover:text-crimson"
                >
                  <Trash2 className="size-3.5" />
                  <span>Vaciar</span>
                </button>

                {fulfillmentType === "dine_in" ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={shareSelectionWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>Compartir por WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setIsTableSheetOpen(false)}
                      className="inline-flex min-h-10 items-center rounded-full border border-obsidian-border px-4 py-2 text-xs font-semibold text-ivory"
                    >
                      Seguir viendo carta
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    form="direct-order-checkout-form"
                    disabled={
                      isSubmittingOrder ||
                      missingForMinOrder > 0 ||
                      conflictingLocationItems.length > 0
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ember px-6 py-2.5 text-xs sm:text-sm font-semibold text-ivory shadow-lg transition hover:bg-ember-hover disabled:opacity-50"
                  >
                    <ShieldCheck className="size-4" />
                    <span>
                      {isSubmittingOrder
                        ? "Registrando pedido..."
                        : `Confirmar pedido · ${formatCurrency(
                            directOrderTotal,
                            currencyCode
                          )}`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
