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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type {
  CategoryWithProducts,
  ProductWithDetails,
} from "@/modules/tenant/queries";

interface InteractiveMenuBrowserProps {
  restaurantName: string;
  currencyCode: string;
  authenticityBadge?: string;
  serviceChargeNote?: string;
  scheduleLabel?: string | null;
  serviceNotes?: string | null;
  categories: CategoryWithProducts[];
}

export function InteractiveMenuBrowser({
  restaurantName,
  currencyCode,
  authenticityBadge,
  serviceChargeNote,
  scheduleLabel,
  serviceNotes,
  categories,
}: InteractiveMenuBrowserProps) {
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyHighlights, setOnlyHighlights] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithDetails | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .filter(
        (cat) => activeCategorySlug === "all" || cat.slug === activeCategorySlug
      )
      .map((cat) => {
        const matchingProducts = cat.products.filter((prod) => {
          if (onlyHighlights && !prod.is_featured && !prod.is_chef_choice) {
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
  }, [categories, activeCategorySlug, searchQuery, onlyHighlights]);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
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
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-[260px]">
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
            <Sparkles className="size-3.5" />
            <span>Insignias del Chef</span>
          </button>
        </div>
      </div>

      {/* Sticky Category Bar (Zero-Splash Mobile-First Navigation) */}
      <div
        role="tablist"
        aria-label="Categorías de la carta"
        className="sticky top-[69px] z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-hairline bg-canvas/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-3"
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
            Prueba buscando otro corte, ingrediente o restablece los filtros para explorar toda nuestra carta.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setOnlyHighlights(false);
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
        {filteredCategories.map((category) => (
          <section
            key={category.id}
            id={`categoria-${category.slug}`}
            className="scroll-mt-36"
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
              /* Editorial Printed Wine & Sides List (Zero Empty Image Boxes!) */
              <div className="rounded-3xl border border-hairline bg-canvas-elevated p-6 sm:p-8">
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                  <Wine className="size-4 text-ember" />
                  <span>Selección en Formato de Carta Clásica</span>
                </div>
                <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
                  {category.products.map((product) => {
                    const isSoldOut =
                      product.availability_status === "sold_out";
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
                        className={`group flex flex-col justify-between border-b border-dashed border-hairline pb-4 text-left transition cursor-pointer ${
                          isSoldOut ? "opacity-60" : "hover:border-ember"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-semibold text-ink group-hover:text-ember transition">
                            {product.name}
                          </h3>
                          <span className="tabular-price shrink-0 font-mono text-base font-semibold text-ink">
                            {formatCurrency(
                              Number(product.base_price),
                              currencyCode
                            )}
                          </span>
                        </div>
                        {product.short_description && (
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                            {product.short_description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {product.portion_label && (
                            <span className="text-[11px] font-medium text-ink-muted">
                              {product.portion_label}
                            </span>
                          )}
                          {product.badges.map((badge) => (
                            <span
                              key={badge}
                              className="rounded-full bg-canvas-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* High-Impact Editorial Photo Grid */
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {category.products.map((product) => {
                  const isSoldOut = product.availability_status === "sold_out";
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

                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ember group-hover:translate-x-0.5 transition">
                            {product.optionGroups.length > 0
                              ? "Ver términos y guarniciones"
                              : "Ver detalle del plato"}
                            <ChevronRight className="size-3.5" />
                          </span>
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
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-canvas-elevated shadow-2xl sm:rounded-3xl border border-hairline"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedProduct.image_url && (
              <div className="relative aspect-[16/10] w-full bg-obsidian">
                <Image
                  src={selectedProduct.image_url}
                  alt={selectedProduct.image_alt ?? selectedProduct.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  aria-label="Cerrar detalle del plato"
                  className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-obsidian"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}

            <div className="p-6 sm:p-7">
              {!selectedProduct.image_url && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Cerrar detalle"
                    className="flex size-10 items-center justify-center rounded-full bg-canvas-muted text-ink"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {selectedProduct.availability_status === "sold_out" && (
                  <span className="rounded-full bg-amber-warn/15 px-3 py-1 text-xs font-semibold text-amber-warn">
                    Agotado por hoy
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
                className="mt-2 font-display text-3xl font-semibold text-ink"
              >
                {selectedProduct.name}
              </h2>

              {selectedProduct.portion_label && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ember">
                  {selectedProduct.portion_label}
                </p>
              )}

              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {selectedProduct.long_description ??
                  selectedProduct.short_description}
              </p>

              {/* Simple Variant / Option Groups (D1 Decision) */}
              {selectedProduct.optionGroups.length > 0 && (
                <div className="mt-6 flex flex-col gap-5 border-t border-hairline pt-5">
                  {selectedProduct.optionGroups.map((group) => (
                    <div key={group.id}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-ink">
                          {group.name}
                        </h3>
                        {group.is_required && (
                          <span className="rounded-full bg-obsidian px-2.5 py-0.5 text-[11px] font-medium text-ivory">
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
                              className={`flex min-h-11 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                                isSelected
                                  ? "border-ember bg-ember/8 font-medium text-ink"
                                  : "border-hairline bg-canvas text-ink-muted hover:border-ink/30"
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`flex size-4 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? "border-ember bg-ember text-ivory"
                                      : "border-ink-muted"
                                  }`}
                                >
                                  {isSelected && <Check className="size-2.5" />}
                                </span>
                                <span>{opt.name}</span>
                              </span>
                              <span className="tabular-price font-mono text-xs font-semibold text-ink">
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

              <div className="mt-7 flex items-center justify-between border-t border-hairline pt-4">
                <div>
                  <span className="block text-xs text-ink-muted">
                    Precio en carta {selectedProduct.optionGroups.length > 0 ? "con selección" : ""}
                  </span>
                  <span className="tabular-price font-mono text-2xl font-semibold text-ink">
                    {formatCurrency(computedDetailPrice, currencyCode)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-obsidian px-6 py-2.5 text-sm font-medium text-ivory transition hover:bg-ember"
                >
                  Seguir explorando
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
