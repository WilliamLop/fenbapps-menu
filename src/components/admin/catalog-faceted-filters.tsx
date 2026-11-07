"use client";

import { useId } from "react";
import {
  Search,
  X,
  Filter,
  ArrowUpDown,
  Sparkles,
  Award,
  Flame,
  Layers,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type {
  OperationalCategoryItem,
  OperationalProductItem,
} from "@/modules/admin/queries";

export type SortOption =
  | "sort_order"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc";

export interface FacetedFilterState {
  searchQuery: string;
  categoryId: string; // "all" | category_id
  availabilityStatus: "all" | "available" | "sold_out" | "hidden";
  onlyRegionalDiff: boolean;
  onlyFeatured: boolean;
  onlyChefChoice: boolean;
  onlyNew: boolean;
  onlyWithOptions: boolean;
  priceMin: string;
  priceMax: string;
  sortBy: SortOption;
  pageSize: number; // 20, 50, 100, 0 (all)
  currentPage: number;
}

export const INITIAL_FACETED_FILTER_STATE: FacetedFilterState = {
  searchQuery: "",
  categoryId: "all",
  availabilityStatus: "all",
  onlyRegionalDiff: false,
  onlyFeatured: false,
  onlyChefChoice: false,
  onlyNew: false,
  onlyWithOptions: false,
  priceMin: "",
  priceMax: "",
  sortBy: "sort_order",
  pageSize: 20,
  currentPage: 1,
};

interface CatalogFacetedFiltersProps {
  filters: FacetedFilterState;
  onChange: (next: FacetedFilterState) => void;
  categories: OperationalCategoryItem[];
  allProducts: OperationalProductItem[];
  currencyCode: string;
  hasSelectedLocation: boolean;
  selectedLocationName?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function CatalogFacetedFilters({
  filters,
  onChange,
  categories,
  allProducts,
  currencyCode,
  hasSelectedLocation,
  selectedLocationName,
  isExpanded,
  onToggleExpanded,
}: CatalogFacetedFiltersProps) {
  const searchInputId = useId();
  const categorySelectId = useId();
  const sortSelectId = useId();
  const pageSizeSelectId = useId();
  const priceMinId = useId();
  const priceMaxId = useId();

  // Counts by status
  const totalCount = allProducts.length;
  const availableCount = allProducts.filter(
    (p) => p.availability_status === "available"
  ).length;
  const soldOutCount = allProducts.filter(
    (p) => p.availability_status === "sold_out"
  ).length;
  const hiddenCount = allProducts.filter(
    (p) => p.availability_status === "hidden"
  ).length;

  // Regional override count
  const regionalOverridesCount = allProducts.filter((p) => {
    if (hasSelectedLocation) {
      return (
        p.price_override != null &&
        p.global_base_price != null &&
        Number(p.price_override) !== Number(p.global_base_price)
      );
    }
    return (p.location_overrides_count ?? 0) > 0;
  }).length;

  const isAnyFilterActive =
    filters.searchQuery.trim().length > 0 ||
    filters.categoryId !== "all" ||
    filters.availabilityStatus !== "all" ||
    filters.onlyRegionalDiff ||
    filters.onlyFeatured ||
    filters.onlyChefChoice ||
    filters.onlyNew ||
    filters.onlyWithOptions ||
    filters.priceMin !== "" ||
    filters.priceMax !== "" ||
    filters.sortBy !== "sort_order";

  function handleResetFilters() {
    onChange({
      ...INITIAL_FACETED_FILTER_STATE,
      pageSize: filters.pageSize,
    });
  }

  function handleQuickPricePreset(min: string, max: string) {
    onChange({
      ...filters,
      priceMin: min,
      priceMax: max,
      currentPage: 1,
    });
  }

  return (
    <div className="space-y-3">
      {/* Primary Control Bar */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Bar */}
        <div className="relative min-w-[240px] flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            Buscar plato, ingrediente, porción o etiqueta
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id={searchInputId}
            type="search"
            value={filters.searchQuery}
            onChange={(e) =>
              onChange({
                ...filters,
                searchQuery: e.target.value,
                currentPage: 1,
              })
            }
            placeholder="Buscar plato, categoría, porción, badge..."
            className="h-10 w-full rounded-2xl border border-border-strong bg-canvas pr-9 pl-9 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-xs"
          />
          {filters.searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...filters, searchQuery: "", currentPage: 1 })
              }
              className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Quick Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="relative">
            <label htmlFor={categorySelectId} className="sr-only">
              Filtrar por categoría
            </label>
            <select
              id={categorySelectId}
              value={filters.categoryId}
              onChange={(e) =>
                onChange({
                  ...filters,
                  categoryId: e.target.value,
                  currentPage: 1,
                })
              }
              className="h-10 w-full sm:w-auto rounded-2xl border border-border-strong bg-canvas px-3.5 pr-8 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
            >
              <option value="all">Todas las categorías ({totalCount})</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.products_count})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Availability Status Pills */}
          <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-2xl border border-hairline bg-canvas p-1 text-xs">
            {(
              [
                { id: "all", label: "Todos", count: totalCount },
                {
                  id: "available",
                  label: "Disponibles",
                  count: availableCount,
                },
                { id: "sold_out", label: "Agotados", count: soldOutCount },
                { id: "hidden", label: "Ocultos", count: hiddenCount },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    availabilityStatus: st.id,
                    currentPage: 1,
                  })
                }
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 font-semibold transition ${
                  filters.availabilityStatus === st.id
                    ? "bg-ink text-ivory shadow-2xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    filters.availabilityStatus === st.id
                      ? "bg-ivory/20 text-ivory"
                      : "bg-surface-accent text-ink-muted"
                  }`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          {/* Toggle Advanced Filters Drawer */}
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition ${
              isExpanded || isAnyFilterActive
                ? "border-ember bg-surface-accent text-ember"
                : "border-border-strong bg-canvas text-ink hover:border-ember hover:text-ember"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filtros Facetados</span>
            {isAnyFilterActive && (
              <span className="size-1.5 rounded-full bg-ember" />
            )}
          </button>

          {/* Reset Filters */}
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="Restablecer todos los filtros"
              className="inline-flex h-10 items-center gap-1 rounded-2xl border border-hairline bg-canvas px-3 text-xs font-semibold text-crimson hover:bg-crimson/10"
            >
              <RotateCcw className="size-3" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Faceted Filter Panel */}
      {isExpanded && (
        <div className="rounded-2xl border border-hairline bg-canvas/70 p-4 text-xs shadow-2xs sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Insignias & Attributes */}
            <div>
              <span className="mb-2 block font-semibold uppercase tracking-wider text-ink-muted">
                Insignias &amp; Atributos
              </span>
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-ink hover:border-ember">
                  <input
                    type="checkbox"
                    checked={filters.onlyFeatured}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        onlyFeatured: e.target.checked,
                        currentPage: 1,
                      })
                    }
                    className="size-3.5 accent-ember"
                  />
                  <Sparkles className="size-3.5 text-ember" />
                  <span>Solo Destacados (Featured)</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-ink hover:border-ember">
                  <input
                    type="checkbox"
                    checked={filters.onlyChefChoice}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        onlyChefChoice: e.target.checked,
                        currentPage: 1,
                      })
                    }
                    className="size-3.5 accent-ember"
                  />
                  <Award className="size-3.5 text-sage" />
                  <span>Recomendados del Chef</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-ink hover:border-ember">
                  <input
                    type="checkbox"
                    checked={filters.onlyNew}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        onlyNew: e.target.checked,
                        currentPage: 1,
                      })
                    }
                    className="size-3.5 accent-ember"
                  />
                  <Flame className="size-3.5 text-ember" />
                  <span>Nuevos en Carta</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-ink hover:border-ember">
                  <input
                    type="checkbox"
                    checked={filters.onlyWithOptions}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        onlyWithOptions: e.target.checked,
                        currentPage: 1,
                      })
                    }
                    className="size-3.5 accent-ember"
                  />
                  <Layers className="size-3.5 text-accent-ink" />
                  <span>Con Opciones / Modificadores</span>
                </label>
              </div>
            </div>

            {/* Column 2: Price Range & Quick Presets */}
            <div>
              <span className="mb-2 block font-semibold uppercase tracking-wider text-ink-muted">
                Rango de Precio ({currencyCode})
              </span>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label htmlFor={priceMinId} className="sr-only">
                      Precio Mínimo
                    </label>
                    <input
                      id={priceMinId}
                      type="number"
                      placeholder="Mínimo"
                      value={filters.priceMin}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          priceMin: e.target.value,
                          currentPage: 1,
                        })
                      }
                      className="h-9 w-full rounded-xl border border-border-strong bg-canvas px-2.5 font-mono text-xs text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none"
                    />
                  </div>
                  <span className="text-ink-muted">–</span>
                  <div className="flex-1">
                    <label htmlFor={priceMaxId} className="sr-only">
                      Precio Máximo
                    </label>
                    <input
                      id={priceMaxId}
                      type="number"
                      placeholder="Máximo"
                      value={filters.priceMax}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          priceMax: e.target.value,
                          currentPage: 1,
                        })
                      }
                      className="h-9 w-full rounded-xl border border-border-strong bg-canvas px-2.5 font-mono text-xs text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickPricePreset("", "50000")}
                    className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:border-ember"
                  >
                    &lt; $50.000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPricePreset("50000", "100000")}
                    className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:border-ember"
                  >
                    $50k – $100k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPricePreset("100000", "")}
                    className="rounded-lg border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:border-ember"
                  >
                    &gt; $100.000
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3: Sede / Regional Diferenciales */}
            <div>
              <span className="mb-2 block font-semibold uppercase tracking-wider text-ink-muted">
                Diferenciales Regionales
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      onlyRegionalDiff: !filters.onlyRegionalDiff,
                      currentPage: 1,
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                    filters.onlyRegionalDiff
                      ? "border-ember bg-ember/15 text-ember"
                      : "border-hairline bg-canvas text-ink hover:border-ember"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-ember" />
                    <div>
                      <p className="font-semibold">
                        {hasSelectedLocation
                          ? `Tarifa ${selectedLocationName}`
                          : "Platos con Override"}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {hasSelectedLocation
                          ? "Solo con precio especial en esta sede"
                          : "Diferencial en alguna sede"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-accent px-2 py-0.5 font-mono text-xs font-semibold text-ember">
                    {regionalOverridesCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Column 4: Sorting & Page Size */}
            <div>
              <span className="mb-2 block font-semibold uppercase tracking-wider text-ink-muted">
                Orden &amp; Visualización
              </span>
              <div className="space-y-2">
                <div>
                  <label htmlFor={sortSelectId} className="sr-only">
                    Ordenar por
                  </label>
                  <div className="relative">
                    <ArrowUpDown className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-muted" />
                    <select
                      id={sortSelectId}
                      value={filters.sortBy}
                      onChange={(e) =>
                        onChange({
                          ...filters,
                          sortBy: e.target.value as SortOption,
                        })
                      }
                      className="h-9 w-full rounded-xl border border-border-strong bg-canvas pr-3 pl-8 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                    >
                      <option value="sort_order">
                        Orden de Carta (Defecto)
                      </option>
                      <option value="name_asc">Nombre: A – Z</option>
                      <option value="name_desc">Nombre: Z – A</option>
                      <option value="price_asc">
                        Precio: Menor a Mayor
                      </option>
                      <option value="price_desc">
                        Precio: Mayor a Menor
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <label
                    htmlFor={pageSizeSelectId}
                    className="font-medium text-ink-muted"
                  >
                    Por página:
                  </label>
                  <select
                    id={pageSizeSelectId}
                    value={filters.pageSize}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        pageSize: Number(e.target.value),
                        currentPage: 1,
                      })
                    }
                    className="h-8 rounded-lg border border-border-strong bg-canvas px-2 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                  >
                    <option value="20">20 platos</option>
                    <option value="50">50 platos</option>
                    <option value="100">100 platos</option>
                    <option value="0">Todos</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Badges Bar */}
      {isAnyFilterActive && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Filtros activos:
          </span>

          {filters.searchQuery.trim().length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>Texto: &quot;{filters.searchQuery}&quot;</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, searchQuery: "", currentPage: 1 })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de texto"
              >
                ✕
              </button>
            </span>
          )}

          {filters.categoryId !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>
                Categoría:{" "}
                {categories.find((c) => c.id === filters.categoryId)?.name ??
                  filters.categoryId}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, categoryId: "all", currentPage: 1 })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de categoría"
              >
                ✕
              </button>
            </span>
          )}

          {filters.availabilityStatus !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>
                Estado:{" "}
                {filters.availabilityStatus === "available"
                  ? "Disponibles"
                  : filters.availabilityStatus === "sold_out"
                  ? "Agotados"
                  : "Ocultos"}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    availabilityStatus: "all",
                    currentPage: 1,
                  })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de estado"
              >
                ✕
              </button>
            </span>
          )}

          {filters.onlyRegionalDiff && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-ember/15 px-2.5 py-0.5 font-medium text-ember">
              <span>Tarifa Regional Modificada</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    onlyRegionalDiff: false,
                    currentPage: 1,
                  })
                }
                className="text-ember hover:text-ink"
                aria-label="Quitar filtro de tarifa regional"
              >
                ✕
              </button>
            </span>
          )}

          {filters.onlyFeatured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>Solo Destacados</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    onlyFeatured: false,
                    currentPage: 1,
                  })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de destacados"
              >
                ✕
              </button>
            </span>
          )}

          {filters.onlyChefChoice && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>Solo Recomendados Chef</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    onlyChefChoice: false,
                    currentPage: 1,
                  })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de chef choice"
              >
                ✕
              </button>
            </span>
          )}

          {filters.onlyNew && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>Solo Nuevos</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, onlyNew: false, currentPage: 1 })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de nuevos"
              >
                ✕
              </button>
            </span>
          )}

          {filters.onlyWithOptions && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>Con Modificadores</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    onlyWithOptions: false,
                    currentPage: 1,
                  })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de modificadores"
              >
                ✕
              </button>
            </span>
          )}

          {(filters.priceMin !== "" || filters.priceMax !== "") && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-accent px-2.5 py-0.5 font-medium text-ink">
              <span>
                Precio:{" "}
                {filters.priceMin !== ""
                  ? formatCurrency(Number(filters.priceMin), currencyCode)
                  : "$0"}{" "}
                a{" "}
                {filters.priceMax !== ""
                  ? formatCurrency(Number(filters.priceMax), currencyCode)
                  : "∞"}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    priceMin: "",
                    priceMax: "",
                    currentPage: 1,
                  })
                }
                className="text-ink-muted hover:text-ink"
                aria-label="Quitar filtro de precio"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
