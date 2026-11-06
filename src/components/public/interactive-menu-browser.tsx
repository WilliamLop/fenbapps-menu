"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import type {
  CategoryWithProducts,
  ProductWithDetails,
  LocationRow,
} from "@/modules/tenant/queries";

interface InteractiveMenuBrowserProps {
  restaurantName: string;
  currencyCode: string;
  whatsappPhone?: string;
  authenticityBadge?: string;
  serviceChargeNote?: string;
  scheduleLabel?: string | null;
  serviceNotes?: string | null;
  categories: CategoryWithProducts[];
  locations?: LocationRow[];
  initialLocationSlug?: string;
}

interface TableSelectionItem {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptionLabels: string[];
  portionLabel: string | null;
}

export function InteractiveMenuBrowser({
  restaurantName,
  currencyCode,
  whatsappPhone = "+573105550193",
  authenticityBadge,
  serviceChargeNote,
  scheduleLabel,
  serviceNotes,
  categories,
  locations = [],
  initialLocationSlug,
}: InteractiveMenuBrowserProps) {
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyHighlights, setOnlyHighlights] = useState<boolean>(false);
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [dietaryTag, setDietaryTag] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithDetails | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  // Plus #1: Interactive Table Shortlist ("Mi Selección en Mesa") & Bill Splitter
  const [tableSelection, setTableSelection] = useState<TableSelectionItem[]>(
    []
  );
  const [isTableSheetOpen, setIsTableSheetOpen] = useState<boolean>(false);
  const [splitPeopleCount, setSplitPeopleCount] = useState<number>(2);
  const [includeServiceTip, setIncludeServiceTip] = useState<boolean>(true);

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
        },
      ];
    });

    toast.success(`"${product.name}" agregado a Mi Selección en Mesa`);
  }

  function updateTableItemQuantity(key: string, delta: number) {
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

  const tableTotalWithTip = includeServiceTip
    ? Math.round(tableSubtotal * 1.1)
    : tableSubtotal;

  const perPersonAmount =
    splitPeopleCount > 0
      ? Math.round(tableTotalWithTip / splitPeopleCount)
      : tableTotalWithTip;

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
    const message =
      `Hola, comparto nuestra pre-selección de mesa en *${restaurantName}*:\n\n` +
      lines.join("\n") +
      `\n\n• Total estimado${
        includeServiceTip ? " (con 10% servicio)" : ""
      }: *${formatCurrency(tableTotalWithTip, currencyCode)}*\n` +
      `• Por persona (${splitPeopleCount} comensales): *${formatCurrency(
        perPersonAmount,
        currencyCode
      )}*`;

    return buildWhatsAppUrl(whatsappPhone, message);
  }, [
    tableSelection,
    restaurantName,
    currencyCode,
    includeServiceTip,
    tableTotalWithTip,
    splitPeopleCount,
    perPersonAmount,
    whatsappPhone,
  ]);

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
            Carta de Fuego & Cava
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
                        {/* Square Thumbnail with Border Radius (Pillar 2) */}
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
                                aria-label={`Pre-seleccionar ${product.name}`}
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas-elevated px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-ember hover:bg-ember hover:text-ivory"
                              >
                                <Plus className="size-3" />
                                <span>Mesa</span>
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
                                <span>Mi Mesa</span>
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

      {/* Floating Bottom Bar: "Mi Selección en Mesa & Calculadora por Persona" */}
      {totalTableItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => setIsTableSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-obsidian px-5 py-3.5 text-ivory shadow-2xl transition hover:border-gold"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember font-mono text-sm font-bold text-ivory">
                {totalTableItems}
              </span>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-gold">
                  Mi Selección en Mesa · Mostrar al Mesero
                </span>
                <span className="block text-xs text-ivory-muted">
                  Toca para dividir cuenta por persona o compartir en WhatsApp
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="tabular-price block font-mono text-base font-bold text-ivory">
                {formatCurrency(tableTotalWithTip, currencyCode)}
              </span>
              <span className="block text-[10px] text-ivory-muted">
                Ver resumen &gt;
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

                {/* Plus #2: Sommelier Pairing Recommendation */}
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

                {/* Simple Variant / Option Groups (D1 Decision) */}
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
                    <span>Agregar a mi mesa</span>
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

      {/* Table Selection & Waiter Show Mode Modal ("Mi Selección en Mesa") */}
      {isTableSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mi Selección en Mesa"
          className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/80 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setIsTableSheetOpen(false)}
        >
          <div
            className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-obsidian-border bg-obsidian text-ivory shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-obsidian-border px-6 py-5">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="size-5 text-ember-glow" />
                <div>
                  <h2 className="font-display text-2xl font-semibold text-ivory">
                    Mi Selección en Mesa
                  </h2>
                  <p className="text-xs text-ivory-muted">
                    Muéstrale esta pantalla a tu mesero o divide la cuenta entre amigos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTableSheetOpen(false)}
                aria-label="Cerrar selección en mesa"
                className="flex size-9 items-center justify-center rounded-full bg-obsidian-card text-ivory-muted hover:text-ivory"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {tableSelection.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-obsidian-border bg-obsidian-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-semibold text-ivory">
                      {item.quantity}x {item.name}
                    </p>
                    {item.selectedOptionLabels.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-gold">
                        {item.selectedOptionLabels.map((lbl) => (
                          <li key={lbl}>• {lbl}</li>
                        ))}
                      </ul>
                    )}
                    <p className="tabular-price mt-1.5 font-mono text-xs text-ivory-muted">
                      {formatCurrency(item.unitPrice, currencyCode)} c/u
                    </p>
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
                        onClick={() => updateTableItemQuantity(item.key, -1)}
                        className="flex size-6 items-center justify-center rounded-full text-ivory-muted hover:bg-obsidian-card hover:text-ivory"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="font-mono text-xs font-semibold px-1">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateTableItemQuantity(item.key, 1)}
                        className="flex size-6 items-center justify-center rounded-full text-ivory-muted hover:bg-obsidian-card hover:text-ivory"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Bill Splitter & Service Tip Calculator */}
              <div className="rounded-2xl border border-gold/30 bg-obsidian-card/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-border pb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                    <Users className="size-3.5" />
                    Dividir cuenta entre comensales:
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 6].map((n) => (
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
                  </div>
                </div>

                <label className="mt-3 flex cursor-pointer items-center justify-between text-xs text-ivory-muted">
                  <span>Incluir servicio voluntario sugerido (10%)</span>
                  <input
                    type="checkbox"
                    checked={includeServiceTip}
                    onChange={(e) => setIncludeServiceTip(e.target.checked)}
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
                      {splitPeopleCount === 1 ? "comensal" : "comensales"})
                    </span>
                    <span className="tabular-price font-mono text-lg font-bold text-gold">
                      {formatCurrency(perPersonAmount, currencyCode)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

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
                <span>Vaciar lista</span>
              </button>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
