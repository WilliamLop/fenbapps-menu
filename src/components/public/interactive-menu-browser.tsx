"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  Search,
  Sparkles,
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
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { BrandIcon } from "@/components/public/brand-icon";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
} from "@/lib/utils";
import {
  resolveLocationDeliveryConfig,
  resolveProductForLocation,
} from "@/lib/saas-entitlements";
import type {
  CategoryWithProducts,
  ProductWithDetails,
  LocationRow,
  RestaurantDeliveryConfig,
  TenantBrandIcon,
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
  brandIcon?: TenantBrandIcon;
  searchPlaceholder?: string;
  signatureBadgeLabel?: string;
  menuTitle?: string;
  currencyCode: string;
  whatsappPhone?: string;
  privacyPolicyText?: string;
  deliveryConfig: RestaurantDeliveryConfig;
  tableShortlistEnabled?: boolean;
  directOrdersEnabled?: boolean;
  isVitrineOnly?: boolean;
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
  selectedOptionIds?: string[];
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
  brandIcon = "utensils",
  searchPlaceholder = "Buscar plato, bebida o ingrediente...",
  signatureBadgeLabel = "Especialidad de la Casa",
  menuTitle = "Carta Principal",
  currencyCode,
  whatsappPhone = "",
  privacyPolicyText = "Autorizo el uso de mis datos de contacto para gestionar la entrega de mi pedido.",
  deliveryConfig,
  tableShortlistEnabled = true,
  directOrdersEnabled = true,
  isVitrineOnly = false,
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
  const storageKey = `fenbapps:cart:v2:${restaurantSlug}`;
  const isQrTableSession = Boolean(
    (initialTableNumber && initialTableNumber.trim().length > 0) ||
      (initialMode && initialMode.trim().toLowerCase() === "mesa")
  );

  const cities = useMemo(
    () =>
      Array.from(new Set(locations.map((l) => (l.city || "Bogotá").trim()))),
    [locations]
  );
  const isMultiCity = cities.length > 1;

  const [activeCategorySlug, setActiveCategorySlug] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (initialLocationSlug && locations.length > 0) {
      const normalized = initialLocationSlug.trim().toLowerCase();
      const matched = locations.find(
        (l) => l.slug.toLowerCase() === normalized || l.id === normalized
      );
      if (matched) return (matched.city || "Bogotá").trim();
    }
    return "all";
  });
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
    directOrdersEnabled
      ? resolveInitialMode(initialMode, initialTableNumber, deliveryConfig)
      : "dine_in"
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

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationRow>();
    for (const loc of locations) {
      map.set(loc.id, loc);
    }
    return map;
  }, [locations]);

  const productLookupMap = useMemo(() => {
    const map = new Map<string, ProductWithDetails>();
    for (const cat of categories) {
      for (const prod of cat.products) {
        map.set(prod.id, prod);
      }
    }
    return map;
  }, [categories]);

  const activeLocationObj =
    selectedLocationId !== "all"
      ? locationMap.get(selectedLocationId) ?? null
      : null;

  const dispatchLocationObj =
    locationMap.get(dispatchLocationId) ?? locations[0] ?? null;

  const effectiveDeliveryConfig = useMemo(
    () =>
      resolveLocationDeliveryConfig(
        dispatchLocationObj?.delivery_config,
        deliveryConfig,
        directOrdersEnabled
      ),
    [dispatchLocationObj, deliveryConfig, directOrdersEnabled]
  );

  // Clamp fulfillmentType and drawer if plan entitlements change live
  useEffect(() => {
    if (!directOrdersEnabled && fulfillmentType !== "dine_in") {
      setFulfillmentType("dine_in");
      return;
    }
    if (fulfillmentType === "delivery" && !effectiveDeliveryConfig.enabled) {
      setFulfillmentType(
        effectiveDeliveryConfig.pickupEnabled ? "pickup" : "dine_in"
      );
    } else if (
      fulfillmentType === "pickup" &&
      !effectiveDeliveryConfig.pickupEnabled
    ) {
      setFulfillmentType(
        effectiveDeliveryConfig.enabled ? "delivery" : "dine_in"
      );
    }
  }, [
    directOrdersEnabled,
    fulfillmentType,
    effectiveDeliveryConfig.enabled,
    effectiveDeliveryConfig.pickupEnabled,
  ]);

  useEffect(() => {
    if ((!tableShortlistEnabled || isVitrineOnly) && isTableSheetOpen) {
      setIsTableSheetOpen(false);
    }
  }, [tableShortlistEnabled, isVitrineOnly, isTableSheetOpen]);

  // Keep selectedLocationId valid if locations list shrinks (e.g. simulating Basic plan)
  useEffect(() => {
    if (
      selectedLocationId !== "all" &&
      !locationMap.has(selectedLocationId)
    ) {
      setSelectedLocationId("all");
      setSelectedCity("all");
    }
    if (dispatchLocationId && !locationMap.has(dispatchLocationId)) {
      setDispatchLocationId(locations[0]?.id ?? "");
    }
  }, [selectedLocationId, dispatchLocationId, locationMap, locations]);

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
          directOrdersEnabled &&
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
    directOrdersEnabled,
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

  useEffect(() => {
    if (selectedLocationId !== "all") {
      setDispatchLocationId(selectedLocationId);
      const loc = locationMap.get(selectedLocationId);
      if (loc) {
        setSelectedCity((loc.city || "Bogotá").trim());
      }
    }
  }, [selectedLocationId, locationMap]);

  const effectiveCatalogLocationId =
    selectedLocationId !== "all"
      ? selectedLocationId
      : fulfillmentType !== "dine_in" && dispatchLocationObj
      ? dispatchLocationObj.id
      : locations.length === 1 && locations[0]
      ? locations[0].id
      : "all";

  // Reconcile cart unitPrice whenever location or catalog prices change
  useEffect(() => {
    if (!hasHydratedStorage || tableSelection.length === 0) return;
    const pricingLocId =
      fulfillmentType !== "dine_in" && dispatchLocationObj
        ? dispatchLocationObj.id
        : effectiveCatalogLocationId;

    setTableSelection((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const prod = productLookupMap.get(item.productId);
        if (!prod) return item;
        const locState = resolveProductForLocation(prod, pricingLocId);
        let optionsDelta = 0;
        if (item.selectedOptionIds && item.selectedOptionIds.length > 0) {
          const optSet = new Set(item.selectedOptionIds);
          for (const grp of prod.optionGroups) {
            for (const opt of grp.options) {
              if (optSet.has(opt.id)) {
                optionsDelta += Number(opt.price_delta);
              }
            }
          }
        } else if (item.selectedOptionLabels.length > 0) {
          const lblSet = new Set(item.selectedOptionLabels);
          for (const grp of prod.optionGroups) {
            for (const opt of grp.options) {
              if (lblSet.has(opt.name)) {
                optionsDelta += Number(opt.price_delta);
              }
            }
          }
        }
        const expectedUnitPrice = locState.effectivePrice + optionsDelta;
        if (expectedUnitPrice !== item.unitPrice) {
          changed = true;
          return { ...item, unitPrice: expectedUnitPrice };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [
    hasHydratedStorage,
    fulfillmentType,
    dispatchLocationObj,
    effectiveCatalogLocationId,
    productLookupMap,
    tableSelection.length,
  ]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .filter(
        (cat) => activeCategorySlug === "all" || cat.slug === activeCategorySlug
      )
      .map((cat) => {
        const matchingProducts = cat.products.filter((prod) => {
          const locState = resolveProductForLocation(
            prod,
            effectiveCatalogLocationId
          );
          if (!locState.isOffered || locState.availabilityStatus === "hidden") {
            return false;
          }
          if (
            isMultiCity &&
            selectedCity !== "all" &&
            effectiveCatalogLocationId === "all" &&
            prod.exclusive_location_id
          ) {
            const exLoc = locationMap.get(prod.exclusive_location_id);
            if ((exLoc?.city || "Bogotá").trim() !== selectedCity) {
              return false;
            }
          }
          if (onlyHighlights && !prod.is_featured && !prod.is_chef_choice) {
            return false;
          }
          if (onlyAvailable && locState.availabilityStatus !== "available") {
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
    effectiveCatalogLocationId,
    isMultiCity,
    selectedCity,
    locationMap,
    searchQuery,
    onlyHighlights,
    onlyAvailable,
    dietaryTag,
  ]);

  function handleSelectCategoryTab(slug: string) {
    setActiveCategorySlug(slug);
    const anchor = document.getElementById("menu-categories-anchor");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      if (rect.top < 0) {
        anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

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

  const selectedProductLocState = useMemo(
    () =>
      selectedProduct
        ? resolveProductForLocation(selectedProduct, effectiveCatalogLocationId)
        : null,
    [selectedProduct, effectiveCatalogLocationId]
  );

  const computedDetailPrice = useMemo(() => {
    if (!selectedProduct || !selectedProductLocState) return 0;
    let total = selectedProductLocState.effectivePrice;
    for (const grp of selectedProduct.optionGroups) {
      const chosenId = selectedOptions[grp.id];
      const chosenOpt = grp.options.find((o) => o.id === chosenId);
      if (chosenOpt) {
        total += Number(chosenOpt.price_delta);
      }
    }
    return total;
  }, [selectedProduct, selectedProductLocState, selectedOptions]);

  function addProductToTableSelection(
    product: ProductWithDetails,
    customUnitPrice?: number,
    customOptionLabels?: string[],
    customOptionIds?: string[]
  ) {
    if (!tableShortlistEnabled || isVitrineOnly) {
      return;
    }

    const locState = resolveProductForLocation(
      product,
      effectiveCatalogLocationId
    );
    if (!locState.isOffered || locState.availabilityStatus === "sold_out") {
      toast.error("Este plato se encuentra agotado en esta sede por hoy.");
      return;
    }

    const defaultAvailableOptions = product.optionGroups
      .map((g) => g.options.find((o) => o.is_available))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));

    const optionLabels =
      customOptionLabels ?? defaultAvailableOptions.map((o) => o.name);
    const optionIds =
      customOptionIds ?? defaultAvailableOptions.map((o) => o.id);

    const defaultDelta = defaultAvailableOptions.reduce(
      (sum, o) => sum + Number(o.price_delta),
      0
    );

    const unitPrice = customUnitPrice ?? locState.effectivePrice + defaultDelta;
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
          selectedOptionIds: optionIds,
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
    setTableSelection((prev) => {
      const next = prev
        .map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0);

      if (next.length === 0) {
        setIsTableSheetOpen(false);
      }
      return next;
    });
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

  // Delivery & Pickup Calculations (Per-Location Logistics!)
  const qualifiesForFreeDelivery =
    effectiveDeliveryConfig.freeDeliveryThreshold > 0 &&
    tableSubtotal >= effectiveDeliveryConfig.freeDeliveryThreshold;

  const computedDeliveryFee =
    fulfillmentType === "delivery"
      ? qualifiesForFreeDelivery
        ? 0
        : effectiveDeliveryConfig.deliveryFee
      : 0;

  const missingForFreeDelivery =
    fulfillmentType === "delivery" &&
    effectiveDeliveryConfig.freeDeliveryThreshold > tableSubtotal
      ? effectiveDeliveryConfig.freeDeliveryThreshold - tableSubtotal
      : 0;

  const missingForMinOrder =
    fulfillmentType === "delivery" &&
    effectiveDeliveryConfig.minOrderAmount > tableSubtotal
      ? effectiveDeliveryConfig.minOrderAmount - tableSubtotal
      : 0;

  const directOrderTotal = tableSubtotal + computedDeliveryFee;

  const conflictingLocationItems = useMemo(() => {
    if (
      fulfillmentType === "dine_in" ||
      locations.length <= 1 ||
      !dispatchLocationId
    ) {
      return [];
    }
    return tableSelection.filter((item) => {
      if (
        item.exclusiveLocationId &&
        item.exclusiveLocationId !== dispatchLocationId
      ) {
        return true;
      }
      const prod = productLookupMap.get(item.productId);
      if (!prod) return false;
      const locState = resolveProductForLocation(prod, dispatchLocationId);
      return !locState.isOffered || locState.availabilityStatus === "sold_out";
    });
  }, [
    fulfillmentType,
    locations.length,
    dispatchLocationId,
    tableSelection,
    productLookupMap,
  ]);

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
    if (tableSelection.length === 0 || !targetWhatsAppPhone) return null;
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

    return buildWhatsAppUrl(targetWhatsAppPhone, message);
  }, [
    tableSelection,
    targetWhatsAppPhone,
    tableNumber,
    restaurantName,
    currencyCode,
    includeServiceTip,
    tableTotalWithTip,
    splitPeopleCount,
    perPersonAmount,
  ]);

  function copyTransferInstructions() {
    navigator.clipboard.writeText(effectiveDeliveryConfig.transferInstructions);
    setCopiedTransfer(true);
    toast.success("Datos de transferencia copiados al portapapeles");
    setTimeout(() => setCopiedTransfer(false), 2400);
  }

  function handleConfirmDirectOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCheckoutError(null);

    if (!directOrdersEnabled || isVitrineOnly) {
      setCheckoutError(
        "El canal de pedidos directos no está activo en este plan."
      );
      return;
    }

    if (tableSelection.length === 0) {
      setCheckoutError("Agrega al menos un plato a tu pedido.");
      return;
    }

    if (
      fulfillmentType === "delivery" &&
      tableSubtotal < effectiveDeliveryConfig.minOrderAmount
    ) {
      setCheckoutError(
        `El pedido mínimo a domicilio en esta sede es de ${formatCurrency(
          effectiveDeliveryConfig.minOrderAmount,
          currencyCode
        )}.`
      );
      return;
    }

    if (conflictingLocationItems.length > 0) {
      setCheckoutError(
        "Tienes platos agotados o exclusivos de otra sede en la bolsa. Ajusta la sede de despacho o retíralos antes de confirmar."
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
          optionIds: item.selectedOptionIds ?? [],
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
          dispatchLocationObj && locations.length > 1
            ? ` (${dispatchLocationObj.name} · ${dispatchLocationObj.city})`
            : ""
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

      const waUrl = targetWhatsAppPhone
        ? buildWhatsAppUrl(targetWhatsAppPhone, waMessage)
        : "#";

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

  const canUseShortlist = tableShortlistEnabled && !isVitrineOnly;
  const quickAddButtonLabel =
    fulfillmentType === "dine_in" ? "Mi Mesa" : "Pedir";

  const enabledModesCount =
    1 +
    Number(effectiveDeliveryConfig.enabled) +
    Number(effectiveDeliveryConfig.pickupEnabled);

  const drawerModeCols =
    enabledModesCount === 3
      ? "grid-cols-3"
      : enabledModesCount === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-28">
      {/* Editorial Menu Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-hairline pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {authenticityBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/25 bg-surface-accent px-3 py-1 text-xs font-semibold text-ember">
                <Camera className="size-3.5 shrink-0" />
                <span>{authenticityBadge}</span>
              </span>
            )}
            {scheduleLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-3 py-1 text-xs text-ink-muted">
                <Clock className="size-3.5 shrink-0 text-ember" />
                <span>{scheduleLabel}</span>
              </span>
            )}
            {!canUseShortlist && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-3 py-1 text-xs font-semibold text-ink-muted">
                <Eye className="size-3.5 shrink-0 text-ember" />
                <span>Carta Informativa de Consulta</span>
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
            <div className="relative min-w-[260px] sm:min-w-[290px]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Buscar en la carta"
                suppressHydrationWarning
                className="h-11 w-full rounded-full border border-border-strong bg-canvas-elevated pr-9 pl-10 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyHighlights((prev) => !prev)}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                onlyHighlights
                  ? "border-ember bg-ember text-ivory shadow-2xs"
                  : "border-border-strong bg-canvas-elevated text-ink hover:border-ember hover:text-ember"
              }`}
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span>Recomendados</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                onlyAvailable
                  ? "border-ink bg-ink text-ivory"
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
                      ? "border-ember bg-surface-accent text-ember font-semibold"
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
      {canUseShortlist &&
        (effectiveDeliveryConfig.enabled ||
          effectiveDeliveryConfig.pickupEnabled) && (
          <div className="mb-4 rounded-2xl border border-hairline bg-canvas-elevated p-3.5 sm:px-5">
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
                {effectiveDeliveryConfig.enabled && (
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
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("dine_in")}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      fulfillmentType === "dine_in"
                        ? "bg-ink text-ivory shadow-2xs"
                        : "border border-hairline bg-canvas text-ink-muted hover:text-ink"
                    }`}
                  >
                    <UtensilsCrossed
                      className={`size-3.5 ${
                        fulfillmentType === "dine_in"
                          ? "text-gold"
                          : "text-ember"
                      }`}
                    />
                    <span>En el Restaurante</span>
                  </button>

                  {effectiveDeliveryConfig.enabled && (
                    <button
                      type="button"
                      onClick={() => setFulfillmentType("delivery")}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        fulfillmentType === "delivery"
                          ? "bg-ember text-ivory shadow-2xs"
                          : "border border-hairline bg-canvas text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Bike className="size-3.5" />
                      <span>Pedir a Domicilio</span>
                    </button>
                  )}

                  {effectiveDeliveryConfig.pickupEnabled && (
                    <button
                      type="button"
                      onClick={() => setFulfillmentType("pickup")}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        fulfillmentType === "pickup"
                          ? "bg-ember text-ivory shadow-2xs"
                          : "border border-hairline bg-canvas text-ink-muted hover:text-ink"
                      }`}
                    >
                      <ShoppingBag className="size-3.5" />
                      <span>Pasar a Recoger</span>
                    </button>
                  )}
                </div>

                <div className="text-xs leading-relaxed text-ink-muted">
                  {fulfillmentType === "dine_in" && (
                    <span>
                      Pre-selecciona platos, divide la cuenta exacta o muéstrale
                      a tu mesero.
                    </span>
                  )}
                  {fulfillmentType === "delivery" && (
                    <span>
                      <strong className="font-semibold text-ink">
                        Envío directo
                        {dispatchLocationObj && locations.length > 1
                          ? ` (${dispatchLocationObj.name} · ${effectiveDeliveryConfig.estimatedDeliveryMinutes})`
                          : ` (${effectiveDeliveryConfig.estimatedDeliveryMinutes})`}
                        :
                      </strong>{" "}
                      {formatCurrency(
                        effectiveDeliveryConfig.deliveryFee,
                        currencyCode
                      )}{" "}
                      ·{" "}
                      <span className="font-semibold text-sage">
                        Gratis desde{" "}
                        {formatCurrency(
                          effectiveDeliveryConfig.freeDeliveryThreshold,
                          currencyCode
                        )}
                      </span>{" "}
                      · Efectivo, Datáfono o Bre-B.
                    </span>
                  )}
                  {fulfillmentType === "pickup" && (
                    <span>
                      <strong className="font-semibold text-ink">
                        Listo en{" "}
                        {effectiveDeliveryConfig.estimatedPickupMinutes}:
                      </strong>{" "}
                      Sin recargos · Recoge directo en{" "}
                      {dispatchLocationObj && locations.length > 1
                        ? dispatchLocationObj.name
                        : "el restaurante"}
                      .
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Multi-City & Multi-Location Menu Selector (Hidden automatically when restaurant has 1 location) */}
      {locations.length > 1 && (
        <div className="mb-5 space-y-2.5 rounded-2xl border border-hairline bg-canvas-elevated p-3.5 sm:px-5">
          {isMultiCity && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="size-4 shrink-0 text-ember" />
                <span className="font-semibold text-ink">
                  1. Selecciona tu ciudad:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCity("all");
                    setSelectedLocationId("all");
                  }}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    selectedCity === "all"
                      ? "bg-ink text-ivory shadow-2xs"
                      : "bg-canvas-muted text-ink-muted hover:text-ink"
                  }`}
                >
                  Todas las ciudades ({cities.length})
                </button>
                {cities.map((city) => {
                  const locsInCity = locations.filter(
                    (l) => (l.city || "Bogotá").trim() === city
                  );
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setSelectedCity(city);
                        if (locsInCity.length === 1 && locsInCity[0]) {
                          setSelectedLocationId(locsInCity[0].id);
                        } else {
                          setSelectedLocationId("all");
                          if (locsInCity[0]) {
                            setDispatchLocationId(locsInCity[0].id);
                          }
                        }
                      }}
                      className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                        selectedCity === city
                          ? "bg-ember text-ivory shadow-2xs"
                          : "bg-canvas-muted text-ink-muted hover:text-ink"
                      }`}
                    >
                      {city} ({locsInCity.length})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs">
              {!isMultiCity && (
                <MapPin className="size-4 shrink-0 text-ember" />
              )}
              <span className="font-semibold text-ink">
                {isMultiCity
                  ? "2. Sede y disponibilidad en vivo:"
                  : "Disponibilidad y especialidades por sede:"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedLocationId("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedLocationId === "all"
                    ? "bg-ink text-ivory shadow-2xs"
                    : "bg-canvas-muted text-ink-muted hover:text-ink"
                }`}
              >
                {isMultiCity && selectedCity !== "all"
                  ? `Todas en ${selectedCity}`
                  : `Todas las sedes (${locations.length})`}
              </button>
              {locations
                .filter(
                  (loc) =>
                    !isMultiCity ||
                    selectedCity === "all" ||
                    (loc.city || "Bogotá").trim() === selectedCity
                )
                .map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedLocationId === loc.id
                        ? "bg-ember text-ivory shadow-2xs"
                        : "bg-canvas-muted text-ink-muted hover:text-ink"
                    }`}
                  >
                    <span>
                      {isMultiCity && selectedCity === "all"
                        ? `${loc.city} · ${loc.name}`
                        : loc.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {activeLocationObj && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2.5 text-xs text-ink-muted">
              <p>
                Mostrando precios y stock en vivo de{" "}
                <strong className="font-semibold text-ink">
                  {activeLocationObj.name} · {activeLocationObj.city}
                </strong>{" "}
                ({activeLocationObj.address_line}).
              </p>
              {activeLocationObj.exclusive_features?.length > 0 && (
                <span className="rounded-full border border-ember/25 bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                  Diferencial: {activeLocationObj.exclusive_features[0]}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div id="menu-categories-anchor" className="scroll-mt-32 lg:scroll-mt-24" />

      {/* Sticky Category Bar (Calibrated to Navbar Heights across Mobile, Tablet & Desktop) */}
      <div
        role="tablist"
        aria-label="Categorías de la carta"
        className="sticky top-[118px] lg:top-[75px] z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-hairline bg-canvas/95 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-3 sm:py-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeCategorySlug === "all"}
          onClick={() => handleSelectCategoryTab("all")}
          className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeCategorySlug === "all"
              ? "bg-ink text-ivory shadow-2xs"
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
            onClick={() => handleSelectCategoryTab(cat.slug)}
            className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeCategorySlug === cat.slug
                ? "bg-ember text-ivory shadow-2xs"
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
            Prueba buscando otro plato o restablece los filtros activos para
            explorar toda nuestra carta.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setOnlyHighlights(false);
              setOnlyAvailable(false);
              setDietaryTag(null);
              setSelectedCity("all");
              setSelectedLocationId("all");
              setActiveCategorySlug("all");
            }}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ivory transition hover:bg-ember-hover"
          >
            Mostrar toda la carta
          </button>
        </div>
      )}

      {/* Category Sections */}
      <div className="flex flex-col gap-14">
        {filteredCategories.map((category, categoryIndex) => {
          const isSingleItemCategory = category.products.length === 1;

          return (
            <section
              key={category.id}
              id={`categoria-${category.slug}`}
              className="scroll-mt-44 lg:scroll-mt-36"
            >
              <div className="mb-6 border-b border-hairline pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
                    {category.name}
                  </h2>
                  {category.subtitle && (
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
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
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    <div className="flex items-center gap-2">
                      <Wine className="size-4 text-ember" />
                      <span>Selección de Cava & Acompañamientos</span>
                    </div>
                    <span className="text-xs font-normal normal-case tracking-normal text-ink-muted">
                      Toca cualquier referencia para ampliar su nota de cata
                    </span>
                  </div>

                  <div
                    className={`grid grid-cols-1 gap-x-8 gap-y-5 ${
                      isSingleItemCategory ? "" : "md:grid-cols-2"
                    }`}
                  >
                    {category.products.map((product) => {
                      const locState = resolveProductForLocation(
                        product,
                        effectiveCatalogLocationId
                      );
                      const isSoldOut =
                        locState.availabilityStatus === "sold_out";
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
                          className={`group flex items-start gap-4 rounded-2xl border border-hairline bg-canvas p-3.5 text-left transition cursor-pointer ${
                            isSoldOut
                              ? "border-dashed bg-canvas-muted/50"
                              : "hover:border-ember hover:shadow-2xs"
                          }`}
                        >
                          {product.image_url ? (
                            <div
                              className={`relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-canvas-muted shadow-2xs ${
                                isSoldOut ? "grayscale-[55%] opacity-75" : ""
                              }`}
                            >
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
                                <h3 className="font-semibold text-ink transition group-hover:text-ember leading-snug">
                                  {product.name}
                                </h3>
                                <span className="tabular-price shrink-0 font-mono text-sm sm:text-base font-semibold text-ember">
                                  {formatCurrency(
                                    locState.effectivePrice,
                                    currencyCode
                                  )}
                                </span>
                              </div>

                              {product.short_description && (
                                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                                  {product.short_description}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isSoldOut && (
                                  <span className="rounded-full bg-amber-warn/15 px-2.5 py-0.5 text-xs font-semibold text-amber-warn">
                                    Agotado hoy
                                  </span>
                                )}
                                {product.portion_label && (
                                  <span className="text-xs font-medium text-ink-muted">
                                    {product.portion_label}
                                  </span>
                                )}
                                {exclusiveLoc && locations.length > 1 && (
                                  <span className="rounded-full bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                                    Exclusivo {exclusiveLoc.name}
                                  </span>
                                )}
                                {product.badges.slice(0, 2).map((badge) => (
                                  <span
                                    key={badge}
                                    className="rounded-full bg-canvas-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>

                              {canUseShortlist && !isSoldOut && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addProductToTableSelection(product);
                                  }}
                                  aria-label={`Agregar ${product.name}`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border-strong bg-canvas-elevated px-3 py-1 text-xs font-semibold text-ink transition hover:border-ember hover:bg-ember hover:text-ivory"
                                >
                                  <Plus className="size-3.5" />
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
                /* High-Impact Editorial Photo Grid (Single-Item Categories Expand Horizontally) */
                <div
                  className={
                    isSingleItemCategory
                      ? "grid grid-cols-1 gap-6"
                      : "grid grid-cols-1 gap-6 md:grid-cols-2"
                  }
                >
                  {category.products.map((product, productIndex) => {
                    const locState = resolveProductForLocation(
                      product,
                      effectiveCatalogLocationId
                    );
                    const isSoldOut =
                      locState.availabilityStatus === "sold_out";
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
                        className={`group relative overflow-hidden rounded-3xl border bg-canvas-elevated transition duration-200 cursor-pointer ${
                          isSingleItemCategory && product.image_url
                            ? "grid grid-cols-1 lg:grid-cols-12"
                            : "flex flex-col"
                        } ${
                          isSoldOut
                            ? "border-dashed border-border-strong"
                            : "border-hairline hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-lg"
                        }`}
                      >
                        {product.image_url && (
                          <div
                            className={`relative w-full overflow-hidden bg-canvas-muted ${
                              isSingleItemCategory
                                ? "aspect-[16/10] lg:col-span-6 lg:aspect-auto lg:min-h-[290px]"
                                : "aspect-[16/10]"
                            }`}
                          >
                            <Image
                              src={product.image_url}
                              alt={product.image_alt ?? product.name}
                              fill
                              priority={categoryIndex === 0 && productIndex < 2}
                              sizes="(max-width: 768px) 100vw, 50vw"
                              className={`object-cover transition duration-500 ${
                                isSoldOut
                                  ? "grayscale-[55%] opacity-80"
                                  : "group-hover:scale-105"
                              }`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-transparent" />

                            {/* Top Badges */}
                            <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
                              {isSoldOut ? (
                                <span className="rounded-full border border-obsidian-border bg-obsidian/92 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-on-dark">
                                  Agotado por hoy
                                </span>
                              ) : (
                                <>
                                  {product.is_chef_choice && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-obsidian/90 px-3 py-1 text-xs font-medium text-gold">
                                      <BrandIcon
                                        icon={brandIcon}
                                        className="size-3.5 text-ember-glow"
                                      />
                                      <span>{signatureBadgeLabel}</span>
                                    </span>
                                  )}
                                  {product.is_new && (
                                    <span className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                                      Nuevo
                                    </span>
                                  )}
                                  {exclusiveLoc && locations.length > 1 && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 text-xs font-medium text-ivory">
                                      <MapPin className="size-3 text-gold" />
                                      <span>Exclusivo {exclusiveLoc.name}</span>
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Price Pill Overlay */}
                            <div className="absolute right-3.5 bottom-3 rounded-full border border-obsidian-border bg-obsidian/92 px-3.5 py-1.5 backdrop-blur-xs">
                              <span className="tabular-price font-mono text-sm font-semibold text-ivory">
                                {formatCurrency(
                                  locState.effectivePrice,
                                  currencyCode
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        <div
                          className={`flex flex-1 flex-col justify-between p-5 sm:p-6 ${
                            isSingleItemCategory && product.image_url
                              ? "lg:col-span-6 lg:p-8"
                              : ""
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-display text-2xl font-semibold text-ink transition group-hover:text-ember sm:text-[26px]">
                                {product.name}
                              </h3>
                              {!product.image_url && (
                                <span className="tabular-price font-mono text-base font-semibold text-ember">
                                  {formatCurrency(
                                    locState.effectivePrice,
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

                            {isSingleItemCategory && product.pairing_note && (
                              <p className="mt-3 rounded-xl border border-hairline bg-surface-accent/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
                                <strong className="font-semibold text-ink">
                                  Nota del Sommelier:
                                </strong>{" "}
                                {product.pairing_note}
                              </p>
                            )}
                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5">
                            <span className="text-xs font-medium text-ink-muted">
                              {isSoldOut
                                ? "No disponible temporalmente"
                                : (product.portion_label ??
                                  "Preparado al momento")}
                            </span>

                            <div className="flex items-center gap-2">
                              {canUseShortlist && !isSoldOut && (
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
                                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border-strong bg-canvas px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-ember hover:bg-ember hover:text-ivory"
                                >
                                  <Plus className="size-3.5" />
                                  <span>{quickAddButtonLabel}</span>
                                </button>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-ember transition group-hover:translate-x-0.5">
                                {canUseShortlist &&
                                product.optionGroups.length > 0
                                  ? "Personalizar opciones"
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
          );
        })}
      </div>

      {/* Footer Service & Transparency Notes */}
      {(serviceChargeNote || serviceNotes) && (
        <div className="mt-14 rounded-2xl border border-hairline bg-canvas-elevated p-5 text-xs leading-relaxed text-ink-muted">
          <p className="font-semibold text-ink">{restaurantName}</p>
          {serviceChargeNote && <p className="mt-1">{serviceChargeNote}</p>}
          {serviceNotes && <p className="mt-1">{serviceNotes}</p>}
        </div>
      )}

      {/* Floating Bottom Bar: High-Contrast Pill Adapting to Dine-In vs Delivery vs Pickup */}
      {canUseShortlist && (totalTableItems > 0 || confirmedOrder) && (
        <div className="fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => setIsTableSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-obsidian-border bg-obsidian px-5 py-3.5 text-ivory shadow-2xl transition hover:border-gold"
          >
            <div className="flex min-w-0 items-center gap-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember font-mono text-sm font-bold text-ivory">
                {confirmedOrder ? "✓" : totalTableItems}
              </span>
              <div className="min-w-0">
                <span className="block truncate text-xs font-semibold uppercase tracking-wider text-gold">
                  {confirmedOrder
                    ? `Pedido Confirmado · ${confirmedOrder.referenceCode}`
                    : fulfillmentType === "delivery"
                      ? "Mi Pedido a Domicilio · Checkout Directo"
                      : fulfillmentType === "pickup"
                        ? "Mi Pedido para Recoger"
                        : "Mi Selección en Mesa · Mostrar al Mesero"}
                </span>
                <span className="block truncate text-xs text-ivory-muted">
                  {confirmedOrder
                    ? "Toca para ver el código o enviar por WhatsApp"
                    : fulfillmentType === "dine_in"
                      ? "Divide cuenta, cambia a domicilio o comparte"
                      : missingForFreeDelivery > 0
                        ? `Te faltan ${formatCurrency(
                            missingForFreeDelivery,
                            currencyCode
                          )} para envío gratis`
                        : "Completa entrega y medio de pago"}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="tabular-price block font-mono text-base font-bold text-ivory">
                {formatCurrency(
                  confirmedOrder
                    ? confirmedOrder.totalAmount
                    : activeTotalDisplay,
                  currencyCode
                )}
              </span>
              <span className="block text-xs font-medium text-gold">
                {fulfillmentType === "dine_in" ? "Ver lista →" : "Continuar →"}
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
            className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label="Cerrar detalle del plato"
              className="absolute top-4 right-4 z-20 flex size-10 items-center justify-center rounded-full bg-obsidian/85 text-ivory shadow-md transition hover:bg-obsidian"
            >
              <X className="size-5" />
            </button>

            <div className="flex-1 overflow-y-auto">
              {selectedProduct.image_url && (
                <div className="relative h-52 w-full bg-canvas-muted sm:h-56">
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
                  {selectedProductLocState?.availabilityStatus ===
                    "sold_out" && (
                    <span className="rounded-full bg-amber-warn/15 px-3 py-1 text-xs font-semibold text-amber-warn">
                      Agotado por hoy
                    </span>
                  )}
                  {selectedProduct.exclusive_location_id &&
                    locations.length > 1 &&
                    locationMap.get(selectedProduct.exclusive_location_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-accent px-3 py-1 text-xs font-semibold text-ember">
                        <MapPin className="size-3.5" />
                        <span>
                          Exclusivo{" "}
                          {
                            locationMap.get(
                              selectedProduct.exclusive_location_id
                            )?.name
                          }
                        </span>
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
                  className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl"
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
                      className="inline-flex items-center gap-1 rounded-full bg-surface-accent px-3 py-1 text-xs font-semibold text-ember transition hover:bg-ember hover:text-ivory"
                    >
                      <span>Personalizar opciones ↓</span>
                    </a>
                  )}
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                  {selectedProduct.long_description ??
                    selectedProduct.short_description}
                </p>

                {selectedProduct.pairing_note && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-ember/25 bg-surface-accent/70 p-4 text-ink">
                    <Wine className="mt-0.5 size-4 shrink-0 text-ember" />
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-ember">
                        Sugerencia de Maridaje
                      </span>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
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
                            <span className="shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-ivory">
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
                                    ? "border-ember bg-surface-accent/70 font-semibold text-ink"
                                    : "border-border-strong bg-canvas text-ink-muted hover:border-ember hover:text-ink"
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
                                    {isSelected && (
                                      <Check className="size-2.5" />
                                    )}
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

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas px-6 py-4 sm:px-7">
              <div>
                <span className="block text-xs text-ink-muted">
                  Precio en carta{" "}
                  {selectedProduct.optionGroups.length > 0
                    ? "con selección"
                    : ""}
                </span>
                <span className="tabular-price font-mono text-2xl font-bold text-ink">
                  {formatCurrency(computedDetailPrice, currencyCode)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {canUseShortlist &&
                  selectedProductLocState?.availabilityStatus !==
                    "sold_out" && (
                    <button
                      type="button"
                      onClick={() => {
                        const chosenOptions = selectedProduct.optionGroups
                          .map((grp) => {
                            const chosenId = selectedOptions[grp.id];
                            return grp.options.find((o) => o.id === chosenId);
                          })
                          .filter((o): o is NonNullable<typeof o> =>
                            Boolean(o)
                          );

                        addProductToTableSelection(
                          selectedProduct,
                          computedDetailPrice,
                          chosenOptions.map((o) => o.name),
                          chosenOptions.map((o) => o.id)
                        );
                        setSelectedProduct(null);
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
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
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-canvas-elevated px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ember hover:text-ember"
                >
                  Seguir viendo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Light-First Order & Table Selection Drawer (High Readability & Clear Borders) */}
      {isTableSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Resumen de Selección y Pedido"
          className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/75 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setIsTableSheetOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + Experience Mode Tabs */}
            <div className="space-y-3 border-b border-hairline bg-canvas px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-accent text-ember">
                    {fulfillmentType === "delivery" ? (
                      <Bike className="size-5" />
                    ) : fulfillmentType === "pickup" ? (
                      <ShoppingBag className="size-5" />
                    ) : (
                      <ClipboardList className="size-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-ink">
                      {confirmedOrder
                        ? `Pedido Confirmado · ${confirmedOrder.referenceCode}`
                        : fulfillmentType === "delivery"
                          ? "Tu Pedido a Domicilio"
                          : fulfillmentType === "pickup"
                            ? "Tu Pedido para Recoger"
                            : "Mi Selección en Mesa"}
                    </h2>
                    <p className="text-xs text-ink-muted">
                      {confirmedOrder
                        ? "Registrado en el sistema oficial del restaurante"
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
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas-elevated text-ink-muted transition hover:border-ember hover:text-ink"
                >
                  <X className="size-5" />
                </button>
              </div>

              {!confirmedOrder && enabledModesCount > 1 && (
                <div
                  role="tablist"
                  aria-label="¿Dónde vas a disfrutar tu pedido?"
                  className={`grid ${drawerModeCols} gap-1.5 rounded-2xl border border-hairline bg-canvas-muted/80 p-1 text-xs`}
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
                        ? "bg-ink text-ivory shadow-2xs"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <UtensilsCrossed className="size-3.5" />
                    <span>En Mesa</span>
                  </button>

                  {effectiveDeliveryConfig.enabled && (
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
                          ? "bg-ember text-ivory shadow-2xs"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Bike className="size-3.5" />
                      <span>Domicilio</span>
                    </button>
                  )}

                  {effectiveDeliveryConfig.pickupEnabled && (
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
                          ? "bg-ember text-ivory shadow-2xs"
                          : "text-ink-muted hover:text-ink"
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
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="space-y-3 rounded-3xl border border-sage/35 bg-canvas p-6 text-center">
                  <CheckCircle2 className="mx-auto size-11 text-sage" />
                  <span className="inline-block rounded-full border border-ember/30 bg-surface-accent px-3.5 py-1 font-mono text-xs font-bold text-ember">
                    CÓDIGO {confirmedOrder.referenceCode}
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-ink">
                    ¡Recibimos tu pedido en cocina!
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    Tu orden por{" "}
                    <strong className="font-semibold text-ink">
                      {formatCurrency(confirmedOrder.totalAmount, currencyCode)}
                    </strong>{" "}
                    ({confirmedOrder.paymentSummary}) quedó registrada en{" "}
                    <strong className="font-semibold text-ink">
                      {restaurantName}
                    </strong>
                    .
                  </p>

                  <div className="flex flex-col gap-2.5 pt-2">
                    <a
                      href={confirmedOrder.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-5 py-3 text-sm font-semibold text-ivory shadow-md transition hover:bg-ember-hover"
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
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-border-strong bg-canvas-elevated text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                    >
                      Volver a la carta
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Order / Table Shortlist Body */
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {/* Itemized List */}
                <div className="space-y-2.5">
                  {tableSelection.map((item) => {
                    const exclusiveLoc = item.exclusiveLocationId
                      ? locationMap.get(item.exclusiveLocationId)
                      : null;

                    return (
                      <div
                        key={item.key}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-hairline bg-canvas p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-lg font-semibold leading-snug text-ink">
                            {item.quantity}x {item.name}
                          </p>
                          {item.selectedOptionLabels.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs font-medium text-ember">
                              {item.selectedOptionLabels.map((lbl) => (
                                <li key={lbl}>• {lbl}</li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="tabular-price font-mono text-xs text-ink-muted">
                              {formatCurrency(item.unitPrice, currencyCode)} c/u
                            </span>
                            {exclusiveLoc && locations.length > 1 && (
                              <span className="rounded-full bg-surface-accent px-2.5 py-0.5 text-xs font-semibold text-ember">
                                Exclusivo {exclusiveLoc.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="tabular-price font-mono text-sm font-semibold text-ink">
                            {formatCurrency(
                              item.unitPrice * item.quantity,
                              currencyCode
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 rounded-full border border-border-strong bg-canvas-elevated px-2 py-1">
                            <button
                              type="button"
                              aria-label={`Quitar una unidad de ${item.name}`}
                              onClick={() =>
                                updateTableItemQuantity(item.key, -1)
                              }
                              className="flex size-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-canvas-muted hover:text-ink"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="px-1 font-mono text-xs font-semibold text-ink">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Sumar una unidad de ${item.name}`}
                              onClick={() =>
                                updateTableItemQuantity(item.key, 1)
                              }
                              className="flex size-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-canvas-muted hover:text-ink"
                            >
                              <Plus className="size-3.5" />
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
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas px-4 py-3">
                      <label
                        htmlFor="dineInTableNumber"
                        className="text-xs font-semibold text-ink"
                      >
                        Número de mesa{" "}
                        <span className="font-normal text-ink-muted">
                          (opcional)
                        </span>
                      </label>
                      <input
                        id="dineInTableNumber"
                        type="text"
                        value={tableNumber}
                        onChange={(e) =>
                          setTableNumber(e.target.value.slice(0, 16))
                        }
                        placeholder="Ej. 12 o Terraza 3"
                        className="h-10 w-40 rounded-xl border border-border-strong bg-canvas-elevated px-3 text-right font-mono text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                      />
                    </div>

                    {/* Flexible 1–30 Diners Bill Splitter & Service Tip Calculator */}
                    <div className="rounded-2xl border border-ember/25 bg-surface-accent/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                          <Users className="size-4 text-ember" />
                          <span>Dividir cuenta entre:</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setSplitPeopleCount(n)}
                              className={`size-8 rounded-full font-mono text-xs font-semibold transition ${
                                splitPeopleCount === n
                                  ? "bg-ember text-ivory shadow-2xs"
                                  : "border border-hairline bg-canvas text-ink-muted hover:text-ink"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                          <div className="ml-1 flex items-center gap-1 rounded-full border border-border-strong bg-canvas px-2 py-0.5">
                            <button
                              type="button"
                              aria-label="Menos comensales"
                              onClick={() =>
                                setSplitPeopleCount((c) => Math.max(1, c - 1))
                              }
                              className="flex size-6 items-center justify-center rounded-full text-sm font-bold text-ink-muted hover:text-ink"
                            >
                              −
                            </button>
                            <span className="min-w-7 text-center font-mono text-xs font-bold text-ember">
                              {splitPeopleCount}p
                            </span>
                            <button
                              type="button"
                              aria-label="Más comensales"
                              onClick={() =>
                                setSplitPeopleCount((c) => Math.min(30, c + 1))
                              }
                              className="flex size-6 items-center justify-center rounded-full text-sm font-bold text-ink-muted hover:text-ink"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="mt-3 flex cursor-pointer items-center justify-between text-xs font-medium text-ink">
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

                      <div className="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
                        <div>
                          <span className="block text-xs text-ink-muted">
                            Total estimado de la mesa
                          </span>
                          <span className="tabular-price font-mono text-xl font-bold text-ink">
                            {formatCurrency(tableTotalWithTip, currencyCode)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-semibold text-ember">
                            Por persona ({splitPeopleCount}{" "}
                            {splitPeopleCount === 1
                              ? "comensal"
                              : "comensales"}
                            )
                          </span>
                          <span className="tabular-price font-mono text-lg font-bold text-ember">
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
                    className="space-y-4 border-t border-hairline pt-4"
                  >
                    {/* Free Shipping / Min Order Commercial Indicator */}
                    {fulfillmentType === "delivery" && (
                      <div className="rounded-2xl border border-hairline bg-canvas px-4 py-3 text-xs">
                        {missingForMinOrder > 0 ? (
                          <p className="font-semibold text-amber-warn">
                            Pedido mínimo a domicilio en esta sede:{" "}
                            <strong>
                              {formatCurrency(
                                effectiveDeliveryConfig.minOrderAmount,
                                currencyCode
                              )}
                            </strong>{" "}
                            (agrega{" "}
                            {formatCurrency(missingForMinOrder, currencyCode)}{" "}
                            más).
                          </p>
                        ) : qualifiesForFreeDelivery ? (
                          <p className="font-semibold text-sage">
                            ✓ ¡Tu pedido califica para envío SIN COSTO!
                          </p>
                        ) : (
                          <p className="text-ink-muted">
                            Costo de envío:{" "}
                            <strong className="font-semibold text-ink">
                              {formatCurrency(
                                computedDeliveryFee,
                                currencyCode
                              )}
                            </strong>{" "}
                            · Agrega{" "}
                            <strong className="font-semibold text-ember">
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

                    {/* Multi-City & Multi-Location Dispatch Selector + Exclusivity/Stock Guard */}
                    {locations.length > 1 ? (
                      <div>
                        <label
                          htmlFor="dispatchLocationSelect"
                          className="mb-1.5 block text-xs font-semibold text-ink"
                        >
                          {fulfillmentType === "delivery"
                            ? "Ciudad y sede desde donde despachamos *"
                            : "Ciudad y sede donde pasas a recoger *"}
                        </label>
                        <select
                          id="dispatchLocationSelect"
                          value={dispatchLocationId}
                          onChange={(e) =>
                            setDispatchLocationId(e.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-xs"
                        >
                          {isMultiCity
                            ? cities.map((city) => (
                                <optgroup key={city} label={city}>
                                  {locations
                                    .filter(
                                      (l) =>
                                        (l.city || "Bogotá").trim() === city
                                    )
                                    .map((loc) => (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.name} · {loc.address_line}
                                      </option>
                                    ))}
                                </optgroup>
                              ))
                            : locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} · {loc.address_line}
                                </option>
                              ))}
                        </select>

                        {conflictingLocationItems.length > 0 && (
                          <div className="mt-2 rounded-xl border border-amber-warn/40 bg-amber-warn/10 p-3 text-xs text-ink">
                            <p className="font-semibold text-amber-warn">
                              Atención: Platos no disponibles en{" "}
                              {dispatchLocationObj?.name ?? "esta sede"}
                            </p>
                            <p className="mt-0.5 text-ink-muted">
                              <strong>
                                {conflictingLocationItems
                                  .map((i) => i.name)
                                  .join(", ")}
                              </strong>{" "}
                              está agotado o es exclusivo de otra sede.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const badKeys = new Set(
                                    conflictingLocationItems.map((i) => i.key)
                                  );
                                  setTableSelection((prev) =>
                                    prev.filter((it) => !badKeys.has(it.key))
                                  );
                                }}
                                className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory"
                              >
                                Retirar de mi pedido
                              </button>
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
                                  className="rounded-full border border-border-strong bg-canvas px-3 py-1 text-xs font-semibold text-ink"
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
                          </div>
                        )}
                      </div>
                    ) : (
                      dispatchLocationObj && (
                        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-xs text-ink-muted">
                          <MapPin className="size-4 shrink-0 text-ember" />
                          <span>
                            {fulfillmentType === "delivery"
                              ? "Despacho directo desde"
                              : "Punto de recogida:"}{" "}
                            <strong className="font-semibold text-ink">
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
                          className="mb-1 block text-xs font-semibold text-ink"
                        >
                          Tu nombre <span className="text-ember">*</span>
                        </label>
                        <input
                          id="orderCustomerName"
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ej. Alejandro Gómez"
                          className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="orderCustomerPhone"
                          className="mb-1 block text-xs font-semibold text-ink"
                        >
                          WhatsApp / Celular{" "}
                          <span className="text-ember">*</span>
                        </label>
                        <input
                          id="orderCustomerPhone"
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="310 555 0199"
                          className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Delivery Address OR Pickup Time Slot */}
                    {fulfillmentType === "delivery" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="orderDeliveryAddress"
                            className="mb-1 block text-xs font-semibold text-ink"
                          >
                            Dirección exacta y Apto / Torre{" "}
                            <span className="text-ember">*</span>
                          </label>
                          <input
                            id="orderDeliveryAddress"
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Ej. Calle 94 # 11A-32 · Apto 502"
                            className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="orderDeliveryNeighborhood"
                            className="mb-1 block text-xs font-semibold text-ink"
                          >
                            Barrio / Sector{" "}
                            <span className="text-ember">*</span>
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
                            className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="orderPickupSlot"
                          className="mb-1 block text-xs font-semibold text-ink"
                        >
                          ¿En cuánto tiempo pasas a recoger?{" "}
                          <span className="text-ember">*</span>
                        </label>
                        <select
                          id="orderPickupSlot"
                          value={pickupSlot}
                          onChange={(e) => setPickupSlot(e.target.value)}
                          className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-xs"
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
                        className="mb-1 block text-xs font-semibold text-ink"
                      >
                        Indicaciones de entrega o cocina{" "}
                        <span className="font-normal text-ink-muted">
                          (opcional)
                        </span>
                      </label>
                      <input
                        id="orderDeliveryNotes"
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Ej. Portería sobre la carrera, salsas aparte, sin cebolla..."
                        className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
                      />
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-2.5">
                      <span className="block text-xs font-semibold text-ink">
                        ¿Cómo deseas pagar tu pedido?{" "}
                        <span className="text-ember">*</span>
                      </span>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "cash"
                              ? "border-ember bg-surface-accent text-ink shadow-2xs"
                              : "border-border-strong bg-canvas text-ink-muted hover:text-ink"
                          }`}
                        >
                          <Banknote className="size-4 text-ember" />
                          <span>Efectivo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("card_dataphone")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "card_dataphone"
                              ? "border-ember bg-surface-accent text-ink shadow-2xs"
                              : "border-border-strong bg-canvas text-ink-muted hover:text-ink"
                          }`}
                        >
                          <CreditCard className="size-4 text-ember" />
                          <span>Tarjeta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("transfer")}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition ${
                            paymentMethod === "transfer"
                              ? "border-ember bg-surface-accent text-ink shadow-2xs"
                              : "border-border-strong bg-canvas text-ink-muted hover:text-ink"
                          }`}
                        >
                          <Smartphone className="size-4 text-ember" />
                          <span>Transferencia</span>
                        </button>
                      </div>

                      {paymentMethod === "cash" && (
                        <div className="space-y-2.5 rounded-2xl border border-hairline bg-canvas p-3.5 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCashNeedsChange(false);
                                setCashBillInput("");
                              }}
                              className={`rounded-full border px-3 py-1 font-semibold transition ${
                                !cashNeedsChange
                                  ? "border-ink bg-ink text-ivory"
                                  : "border-border-strong bg-canvas-elevated text-ink-muted hover:text-ink"
                              }`}
                            >
                              Entrego valor exacto
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashNeedsChange(true)}
                              className={`rounded-full border px-3 py-1 font-semibold transition ${
                                cashNeedsChange
                                  ? "border-ink bg-ink text-ivory"
                                  : "border-border-strong bg-canvas-elevated text-ink-muted hover:text-ink"
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
                                    className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold transition ${
                                      cashBillNumeric === amt
                                        ? "border-ember bg-ember text-ivory"
                                        : "border-border-strong bg-canvas-elevated text-ink-muted hover:text-ink"
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
                                  className="h-10 flex-1 rounded-xl border border-border-strong bg-canvas-elevated px-3 font-mono text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-canvas p-3.5 text-xs">
                          <span className="text-ink-muted">
                            Enviamos datáfono inalámbrico:
                          </span>
                          <div className="flex gap-1.5">
                            {(["Débito", "Crédito"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setCardType(t)}
                                className={`rounded-full border px-3 py-1 font-semibold transition ${
                                  cardType === t
                                    ? "border-ember bg-ember text-ivory"
                                    : "border-border-strong bg-canvas-elevated text-ink-muted hover:text-ink"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {paymentMethod === "transfer" && (
                        <div className="space-y-2 rounded-2xl border border-ember/25 bg-surface-accent/65 p-3.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-mono text-xs leading-relaxed text-ink">
                              {effectiveDeliveryConfig.transferInstructions}
                            </p>
                            <button
                              type="button"
                              onClick={copyTransferInstructions}
                              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong bg-canvas px-3 py-1 text-xs font-semibold text-ember transition hover:border-ember"
                            >
                              {copiedTransfer ? (
                                <>
                                  <Check className="size-3.5 text-sage" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-ink-muted">
                            Al confirmar se generará tu código de orden y podrás
                            adjuntar el comprobante directo en nuestro WhatsApp.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Totals Summary Card */}
                    <div className="space-y-1.5 rounded-2xl border border-ember/30 bg-surface-accent/65 p-4 text-xs">
                      <div className="flex justify-between text-ink-muted">
                        <span>Subtotal platos ({totalTableItems})</span>
                        <span className="tabular-price font-mono font-medium text-ink">
                          {formatCurrency(tableSubtotal, currencyCode)}
                        </span>
                      </div>
                      {fulfillmentType === "delivery" && (
                        <div className="flex justify-between text-ink-muted">
                          <span>Costo de domicilio</span>
                          <span className="tabular-price font-mono">
                            {computedDeliveryFee === 0 ? (
                              <strong className="font-semibold text-sage">
                                SIN COSTO
                              </strong>
                            ) : (
                              formatCurrency(computedDeliveryFee, currencyCode)
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between border-t border-hairline pt-2">
                        <span className="text-sm font-semibold text-ink">
                          Total a pagar
                        </span>
                        <span className="tabular-price font-mono text-xl font-bold text-ember">
                          {formatCurrency(directOrderTotal, currencyCode)}
                        </span>
                      </div>
                    </div>

                    {/* Privacy Consent */}
                    <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-ink-muted">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 accent-ember"
                      />
                      <span>{privacyPolicyText}</span>
                    </label>

                    {checkoutError && (
                      <div
                        role="alert"
                        className="rounded-xl border border-crimson/40 bg-crimson/10 px-3.5 py-2.5 text-xs font-semibold text-crimson"
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-canvas px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setTableSelection([]);
                    setIsTableSheetOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-crimson"
                >
                  <Trash2 className="size-3.5" />
                  <span>Vaciar</span>
                </button>

                {fulfillmentType === "dine_in" ? (
                  <div className="flex items-center gap-2">
                    {shareSelectionWhatsAppUrl && (
                      <a
                        href={shareSelectionWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
                      >
                        <MessageCircle className="size-3.5" />
                        <span>Compartir por WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTableSheetOpen(false)}
                      className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-canvas-elevated px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
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
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-ivory shadow-md transition hover:bg-ember-hover disabled:opacity-50"
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
