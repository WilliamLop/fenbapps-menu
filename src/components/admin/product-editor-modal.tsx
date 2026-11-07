"use client";

import { useState, useEffect, useRef, useId, useTransition } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  Award,
  Flame,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  AlertCircle,
  HelpCircle,
  Layers,
  MapPin,
  Save,
  Link as LinkIcon,
  Eye,
} from "lucide-react";
import { formatCurrency, sanitizeNumericInput } from "@/lib/utils";
import type {
  OperationalCategoryItem,
  OperationalOptionGroupItem,
  OperationalProductItem,
} from "@/modules/admin/queries";
import type { LocationRow } from "@/modules/tenant/queries";
import { adminUpsertProductAction } from "@/modules/admin/actions";

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedProduct: OperationalProductItem, isNew: boolean) => void;
  product?: OperationalProductItem | null; // null for Create mode
  categories: OperationalCategoryItem[];
  locations: LocationRow[];
  restaurantSlug: string;
  currencyCode: string;
}

const COMMON_BADGE_SUGGESTIONS = [
  "Sin Gluten",
  "Recomendado del Chef",
  "Nuevo en Carta",
  "Dry-Aged",
  "Brasa Viva",
  "Para Compartir",
  "Vegetariano",
  "Vegano",
  "Corte Insignia",
  "Edición Limitada",
  "Experiencia en Mesa",
  "Cocción Lenta",
];

const DEMO_IMAGE_PRESETS = [
  {
    label: "Ribeye a la Brasa",
    url: "/demo/casa-brasa/hero-steak.jpg",
  },
  {
    label: "Pulpo al Rescoldo",
    url: "/demo/casa-brasa/octopus-starter.jpg",
  },
  {
    label: "Tuétano & Tartar",
    url: "/demo/casa-brasa/marrow-tartare.jpg",
  },
  {
    label: "Tomahawk Imperial",
    url: "/demo/casa-brasa/tomahawk-steak.jpg",
  },
  {
    label: "Chuletón Wagyu",
    url: "/demo/casa-brasa/wagyu-chuleton.jpg",
  },
  {
    label: "Old Fashioned Ahumado",
    url: "/demo/casa-brasa/smoked-cocktail.jpg",
  },
  {
    label: "Copa Malbec Cava",
    url: "/demo/casa-brasa/wine-malbec.jpg",
  },
  {
    label: "Pasta Trufada",
    url: "/demo/botanica-brunch/dish-rigatoni-truffle.jpg",
  },
  {
    label: "Tostadas Benedictinas",
    url: "/demo/botanica-brunch/dish-avocado-toast.jpg",
  },
  {
    label: "Pancakes de Huerta",
    url: "/demo/botanica-brunch/dish-ricotta-pancakes.jpg",
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function ProductEditorModal({
  isOpen,
  onClose,
  onSaved,
  product,
  categories,
  locations,
  restaurantSlug,
  currencyCode,
}: ProductEditorModalProps) {
  const isEditMode = Boolean(product);
  const [activeTab, setActiveTab] = useState<
    "general" | "precios" | "descripcion" | "modificadores"
  >("general");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugAuto, setIsSlugAuto] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [portionLabel, setPortionLabel] = useState("");
  const [exclusiveLocationId, setExclusiveLocationId] = useState<string>("");

  const [isFeatured, setIsFeatured] = useState(false);
  const [isChefChoice, setIsChefChoice] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [badgeInput, setBadgeInput] = useState("");

  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "available" | "sold_out" | "hidden"
  >("available");

  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");

  const [optionGroups, setOptionGroups] = useState<
    OperationalOptionGroupItem[]
  >([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputId = useId();
  const slugInputId = useId();
  const categoryInputId = useId();
  const portionInputId = useId();
  const locationInputId = useId();
  const priceInputId = useId();
  const comparePriceInputId = useId();
  const shortDescInputId = useId();
  const longDescInputId = useId();
  const imageInputId = useId();
  const altInputId = useId();
  const badgeInputId = useId();

  // Reset or populate fields when modal opens
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setName(product.name);
        setSlug(product.slug);
        setIsSlugAuto(false);
        setCategoryId(product.category_id);
        setPortionLabel(product.portion_label ?? "");
        setExclusiveLocationId(product.exclusive_location_id ?? "");
        setIsFeatured(Boolean(product.is_featured));
        setIsChefChoice(Boolean(product.is_chef_choice));
        setIsNew(Boolean(product.is_new));
        setBadges(product.badges ?? []);
        setBasePrice(String(product.global_base_price ?? product.base_price));
        setCompareAtPrice(
          product.compare_at_price ? String(product.compare_at_price) : ""
        );
        setAvailabilityStatus(product.availability_status);
        setShortDescription(product.short_description ?? "");
        setLongDescription(product.long_description ?? "");
        setImageUrl(product.image_url ?? "");
        setImageAlt(product.image_alt ?? "");
        setOptionGroups(
          product.option_groups ? JSON.parse(JSON.stringify(product.option_groups)) : []
        );
      } else {
        setName("");
        setSlug("");
        setIsSlugAuto(true);
        setCategoryId(categories[0]?.id ?? "");
        setPortionLabel("");
        setExclusiveLocationId("");
        setIsFeatured(false);
        setIsChefChoice(false);
        setIsNew(false);
        setBadges([]);
        setBasePrice("45000");
        setCompareAtPrice("");
        setAvailabilityStatus("available");
        setShortDescription("");
        setLongDescription("");
        setImageUrl("");
        setImageAlt("");
        setOptionGroups([]);
      }
      setActiveTab("general");
      setErrorMessage(null);
    }
  }, [isOpen, product, categories]);

  // Handle auto-slug updating when name changes
  function handleNameChange(newName: string) {
    setName(newName);
    if (isSlugAuto) {
      setSlug(slugify(newName));
    }
  }

  function handleAddBadge(tagToAdd: string) {
    const trimmed = tagToAdd.trim();
    if (trimmed.length > 0 && !badges.includes(trimmed)) {
      setBadges([...badges, trimmed]);
      setBadgeInput("");
    }
  }

  function handleRemoveBadge(tagToRemove: string) {
    setBadges(badges.filter((b) => b !== tagToRemove));
  }

  // Option Groups handlers
  function handleAddOptionGroup() {
    setOptionGroups([
      ...optionGroups,
      {
        name: "Opciones adicionales",
        helper_text: "Selecciona una opción",
        is_required: false,
        min_selections: 0,
        max_selections: 1,
        sort_order: optionGroups.length + 1,
        options: [
          {
            name: "Opción estándar",
            price_delta: 0,
            is_available: true,
            sort_order: 1,
          },
        ],
      },
    ]);
  }

  function handleRemoveOptionGroup(index: number) {
    setOptionGroups(optionGroups.filter((_, i) => i !== index));
  }

  function handleUpdateOptionGroup(
    index: number,
    patch: Partial<OperationalOptionGroupItem>
  ) {
    setOptionGroups(
      optionGroups.map((grp, i) => (i === index ? { ...grp, ...patch } : grp))
    );
  }

  function handleAddOptionToGroup(groupIndex: number) {
    const targetGroup = optionGroups[groupIndex];
    if (!targetGroup) return;
    const newOptions = [
      ...targetGroup.options,
      {
        name: "Nueva opción",
        price_delta: 0,
        is_available: true,
        sort_order: targetGroup.options.length + 1,
      },
    ];
    handleUpdateOptionGroup(groupIndex, { options: newOptions });
  }

  function handleUpdateOptionInGroup(
    groupIndex: number,
    optionIndex: number,
    patch: Partial<OperationalOptionGroupItem["options"][0]>
  ) {
    const targetGroup = optionGroups[groupIndex];
    if (!targetGroup) return;
    const newOptions = targetGroup.options.map((opt, oi) =>
      oi === optionIndex ? { ...opt, ...patch } : opt
    );
    handleUpdateOptionGroup(groupIndex, { options: newOptions });
  }

  function handleRemoveOptionFromGroup(
    groupIndex: number,
    optionIndex: number
  ) {
    const targetGroup = optionGroups[groupIndex];
    if (!targetGroup) return;
    const newOptions = targetGroup.options.filter((_, oi) => oi !== optionIndex);
    handleUpdateOptionGroup(groupIndex, { options: newOptions });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const parsedPrice = Number(basePrice);
    if (isNaN(parsedPrice) || parsedPrice < 1000) {
      setErrorMessage("El precio base debe ser de al menos $1.000 COP.");
      setActiveTab("precios");
      return;
    }

    if (name.trim().length < 2) {
      setErrorMessage("El nombre del plato debe tener al menos 2 caracteres.");
      setActiveTab("general");
      return;
    }

    if (slug.trim().length < 2) {
      setErrorMessage("El slug del plato debe tener al menos 2 caracteres.");
      setActiveTab("general");
      return;
    }

    if (!categoryId) {
      setErrorMessage("Debes asignar una categoría al plato.");
      setActiveTab("general");
      return;
    }

    const parsedComparePrice = compareAtPrice.trim()
      ? Number(compareAtPrice)
      : null;

    if (
      parsedComparePrice !== null &&
      (!isNaN(parsedComparePrice) && parsedComparePrice <= parsedPrice)
    ) {
      setErrorMessage(
        "El precio antes/tachado debe ser mayor al precio base actual."
      );
      setActiveTab("precios");
      return;
    }

    startTransition(async () => {
      const res = await adminUpsertProductAction({
        restaurantSlug,
        productId: product?.id,
        categoryId,
        name: name.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim() || null,
        longDescription: longDescription.trim() || null,
        basePrice: parsedPrice,
        compareAtPrice: parsedComparePrice,
        portionLabel: portionLabel.trim() || null,
        imageUrl: imageUrl.trim() || null,
        imageAlt: imageAlt.trim() || null,
        availabilityStatus,
        isFeatured,
        isNew,
        isChefChoice,
        badges,
        exclusiveLocationId: exclusiveLocationId || null,
        sortOrder: product?.sort_order ?? 0,
        optionGroups: optionGroups.map((grp) => ({
          name: grp.name,
          helperText: grp.helper_text ?? null,
          isRequired: grp.is_required,
          minSelections: grp.min_selections,
          maxSelections: grp.max_selections,
          sortOrder: grp.sort_order,
          options: grp.options.map((opt) => ({
            name: opt.name,
            priceDelta: opt.price_delta,
            isAvailable: opt.is_available,
            sortOrder: opt.sort_order,
          })),
        })),
      });

      if (!res.ok) {
        setErrorMessage(res.error ?? "No fue posible guardar el plato.");
        return;
      }

      const categoryObj = categories.find((c) => c.id === categoryId);
      const locationObj = locations.find((l) => l.id === exclusiveLocationId);

      const savedProductItem: OperationalProductItem = {
        id: res.productId ?? product?.id ?? "temp-id",
        slug: slug.trim(),
        name: name.trim(),
        short_description: shortDescription.trim() || null,
        long_description: longDescription.trim() || null,
        global_base_price: parsedPrice,
        base_price: parsedPrice,
        compare_at_price: parsedComparePrice,
        availability_status: availabilityStatus,
        is_featured: isFeatured,
        is_new: isNew,
        is_chef_choice: isChefChoice,
        badges,
        portion_label: portionLabel.trim() || null,
        image_url: imageUrl.trim() || null,
        image_alt: imageAlt.trim() || null,
        category_id: categoryId,
        category_name: categoryObj?.name ?? "Carta",
        exclusive_location_id: exclusiveLocationId || null,
        exclusive_location_name: locationObj?.name ?? null,
        sort_order: product?.sort_order ?? 0,
        option_groups: optionGroups,
        updated_at: new Date().toISOString(),
      };

      onSaved(savedProductItem, !isEditMode);
      onClose();
    });
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md"
    >
      <div
        className="fixed inset-0 bg-obsidian/80"
        onClick={() => {
          if (!isPending) onClose();
        }}
      />

      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ember/15 px-2.5 py-0.5 text-xs font-semibold text-ember">
                {isEditMode ? "Modificar Plato" : "Nuevo Plato"}
              </span>
              <span className="text-xs text-ink-muted">/{restaurantSlug}</span>
            </div>
            <h2
              id="product-editor-title"
              className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl"
            >
              {isEditMode ? `Editar: ${name || "Plato"}` : "Crear Plato en Carta"}
            </h2>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-hairline bg-canvas/40 px-6 text-xs">
          {(
            [
              { id: "general", label: "1. Ficha General" },
              { id: "precios", label: "2. Precios & Estado" },
              { id: "descripcion", label: "3. Textos & Foto" },
              {
                id: "modificadores",
                label: `4. Modificadores (${optionGroups.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-3 font-semibold transition ${
                activeTab === tab.id
                  ? "border-ember text-ember"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-crimson/30 bg-crimson/10 p-3 text-xs text-crimson">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* TAB 1: GENERAL */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={nameInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Nombre del Plato *
                    </label>
                    <input
                      id={nameInputId}
                      type="text"
                      required
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ej. Bife de Chorizo Madurado"
                      className="mt-1 h-10 w-full rounded-2xl border border-border-strong bg-canvas px-3.5 text-xs text-ink focus:border-ember focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={slugInputId}
                        className="block text-xs font-semibold text-ink"
                      >
                        Identificador / Slug *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsSlugAuto(!isSlugAuto)}
                        className="text-[11px] font-medium text-ember hover:underline"
                      >
                        {isSlugAuto ? "Editar a mano" : "Generar automático"}
                      </button>
                    </div>
                    <div className="relative mt-1">
                      <input
                        id={slugInputId}
                        type="text"
                        required
                        disabled={isSlugAuto}
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        placeholder="bife-de-chorizo"
                        className="h-10 w-full rounded-2xl border border-border-strong bg-canvas px-3.5 font-mono text-xs text-ink focus:border-ember focus:outline-none disabled:bg-canvas/50 disabled:text-ink-muted"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor={categoryInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Categoría en Carta *
                    </label>
                    <select
                      id={categoryInputId}
                      required
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="mt-1 h-10 w-full rounded-2xl border border-border-strong bg-canvas px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={portionInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Porción / Presentación
                    </label>
                    <input
                      id={portionInputId}
                      type="text"
                      value={portionLabel}
                      onChange={(e) => setPortionLabel(e.target.value)}
                      placeholder="Ej. 400g · Incluye 1 guarnición"
                      className="mt-1 h-10 w-full rounded-2xl border border-border-strong bg-canvas px-3.5 text-xs text-ink focus:border-ember focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={locationInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Alcance de Sede
                    </label>
                    <select
                      id={locationInputId}
                      value={exclusiveLocationId}
                      onChange={(e) => setExclusiveLocationId(e.target.value)}
                      className="mt-1 h-10 w-full rounded-2xl border border-border-strong bg-canvas px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                    >
                      <option value="">Todas las sedes (Global)</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          Exclusivo: {loc.city} ({loc.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Insignias Toggles */}
                <div>
                  <span className="block text-xs font-semibold text-ink">
                    Insignias de Promoción
                  </span>
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition ${
                        isFeatured
                          ? "border-ember bg-ember/15 text-ember"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="size-4 accent-ember"
                      />
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-xs">
                          <Sparkles className="size-3.5" />
                          <span>Plato Destacado</span>
                        </div>
                        <p className="text-[11px] text-ink-muted">
                          Resaltado en cabecera de categoría
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition ${
                        isChefChoice
                          ? "border-sage bg-sage/15 text-sage"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChefChoice}
                        onChange={(e) => setIsChefChoice(e.target.checked)}
                        className="size-4 accent-sage"
                      />
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-xs">
                          <Award className="size-3.5" />
                          <span>Recomendado Chef</span>
                        </div>
                        <p className="text-[11px] text-ink-muted">
                          Insignia de sello culinario
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition ${
                        isNew
                          ? "border-amber-warn bg-amber-warn/15 text-amber-warn"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isNew}
                        onChange={(e) => setIsNew(e.target.checked)}
                        className="size-4 accent-amber-warn"
                      />
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-xs">
                          <Flame className="size-3.5" />
                          <span>Nuevo en Carta</span>
                        </div>
                        <p className="text-[11px] text-ink-muted">
                          Etiqueta de lanzamiento
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Badges / Tags */}
                <div>
                  <label
                    htmlFor={badgeInputId}
                    className="block text-xs font-semibold text-ink"
                  >
                    Etiquetas &amp; Badges Adicionales
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id={badgeInputId}
                      type="text"
                      value={badgeInput}
                      onChange={(e) => setBadgeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddBadge(badgeInput);
                        }
                      }}
                      placeholder="Escribe una etiqueta y pulsa Enter..."
                      className="h-10 flex-1 rounded-2xl border border-border-strong bg-canvas px-3.5 text-xs text-ink focus:border-ember focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddBadge(badgeInput)}
                      className="rounded-2xl border border-border-strong bg-canvas px-4 text-xs font-semibold text-ink hover:border-ember hover:text-ember"
                    >
                      Añadir
                    </button>
                  </div>

                  {/* Active Badges */}
                  {badges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-accent px-2.5 py-0.5 text-xs font-medium text-ink"
                        >
                          <span>{b}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBadge(b)}
                            className="text-ink-muted hover:text-crimson"
                            aria-label={`Quitar etiqueta ${b}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggested Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                    <span>Sugerencias rápidas:</span>
                    {COMMON_BADGE_SUGGESTIONS.filter(
                      (sug) => !badges.includes(sug)
                    ).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddBadge(sug)}
                        className="rounded-lg border border-hairline bg-canvas px-2 py-0.5 text-ink hover:border-ember hover:text-ember"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRECIOS & ESTADO */}
            {activeTab === "precios" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={priceInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Precio Base en Carta ({currencyCode}) *
                    </label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-xs text-ink-muted">
                        $
                      </span>
                      <input
                        id={priceInputId}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        value={basePrice}
                        onChange={(e) =>
                          setBasePrice(sanitizeNumericInput(e.target.value, 8))
                        }
                        placeholder="45000"
                        className="h-10 w-full rounded-2xl border border-border-strong bg-canvas pr-4 pl-8 font-mono text-sm font-semibold text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    {basePrice && (
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        {formatCurrency(Number(basePrice), currencyCode)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={comparePriceInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Precio Anterior / Tachado (Opcional)
                    </label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-xs text-ink-muted">
                        $
                      </span>
                      <input
                        id={comparePriceInputId}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={compareAtPrice}
                        onChange={(e) =>
                          setCompareAtPrice(
                            sanitizeNumericInput(e.target.value, 8)
                          )
                        }
                        placeholder="Ej. 52000"
                        className="h-10 w-full rounded-2xl border border-border-strong bg-canvas pr-4 pl-8 font-mono text-sm text-ink focus:border-ember focus:outline-none"
                      />
                    </div>
                    {compareAtPrice && (
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        Tachado:{" "}
                        <span className="line-through">
                          {formatCurrency(
                            Number(compareAtPrice),
                            currencyCode
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-ink">
                    Estado Inicial de Disponibilidad
                  </span>
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setAvailabilityStatus("available")}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        availabilityStatus === "available"
                          ? "border-sage bg-sage/15 text-sage"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <span className="size-2.5 rounded-full bg-sage" />
                      <div>
                        <p className="text-xs font-semibold">Disponible</p>
                        <p className="text-[11px] text-ink-muted">
                          Visible en carta y ordenable
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailabilityStatus("sold_out")}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        availabilityStatus === "sold_out"
                          ? "border-amber-warn bg-amber-warn/15 text-amber-warn"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <span className="size-2.5 rounded-full bg-amber-warn" />
                      <div>
                        <p className="text-xs font-semibold">Agotado Hoy (86)</p>
                        <p className="text-[11px] text-ink-muted">
                          Visible pero bloqueado en cocina
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailabilityStatus("hidden")}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        availabilityStatus === "hidden"
                          ? "border-ink bg-ink text-ivory"
                          : "border-hairline bg-canvas text-ink hover:border-border-strong"
                      }`}
                    >
                      <span className="size-2.5 rounded-full bg-current" />
                      <div>
                        <p className="text-xs font-semibold">Oculto</p>
                        <p
                          className={`text-[11px] ${
                            availabilityStatus === "hidden"
                              ? "text-ivory-muted"
                              : "text-ink-muted"
                          }`}
                        >
                          Fuera de carta pública
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TEXTOS & FOTO */}
            {activeTab === "descripcion" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={shortDescInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Descripción Corta para la Carta (Máx 280 caracteres)
                    </label>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {shortDescription.length}/280
                    </span>
                  </div>
                  <textarea
                    id={shortDescInputId}
                    rows={2}
                    maxLength={280}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Descripción apetitosa que acompaña el plato en la carta digital..."
                    className="mt-1 w-full rounded-2xl border border-border-strong bg-canvas p-3 text-xs leading-relaxed text-ink focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={longDescInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Historia / Notas de Cocina &amp; Maridaje (Drawer Detallado)
                    </label>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {longDescription.length}/1000
                    </span>
                  </div>
                  <textarea
                    id={longDescInputId}
                    rows={3}
                    maxLength={1000}
                    value={longDescription}
                    onChange={(e) => setLongDescription(e.target.value)}
                    placeholder="Detalles sobre el corte, tiempo de maduración, madera usada o sugerencia de copa..."
                    className="mt-1 w-full rounded-2xl border border-border-strong bg-canvas p-3 text-xs leading-relaxed text-ink focus:border-ember focus:outline-none"
                  />
                </div>

                {/* Photography */}
                <div className="rounded-2xl border border-hairline bg-canvas p-4">
                  <span className="block text-xs font-semibold text-ink">
                    Fotografía del Plato
                  </span>

                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                    {/* Live Preview */}
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface-accent">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={imageAlt || name || "Foto del plato"}
                          fill
                          sizes="96px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center text-ink-muted">
                          <ImageIcon className="size-6" />
                          <span className="mt-1 text-[10px]">Sin foto</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2.5">
                      <div>
                        <label
                          htmlFor={imageInputId}
                          className="block text-[11px] font-semibold text-ink"
                        >
                          URL de Imagen
                        </label>
                        <input
                          id={imageInputId}
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://... o /demo/casa-brasa/..."
                          className="mt-0.5 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-xs text-ink focus:border-ember focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={altInputId}
                          className="block text-[11px] font-semibold text-ink"
                        >
                          Texto Alternativo (Accesibilidad WCAG)
                        </label>
                        <input
                          id={altInputId}
                          type="text"
                          value={imageAlt}
                          onChange={(e) => setImageAlt(e.target.value)}
                          placeholder="Ej. Bife de chorizo trinchado sobre piedra caliente"
                          className="mt-0.5 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 text-xs text-ink focus:border-ember focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Preset Selector */}
                  <div className="mt-3.5 border-t border-hairline pt-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      Presets de Fotografía Demo:
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {DEMO_IMAGE_PRESETS.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => {
                            setImageUrl(preset.url);
                            if (!imageAlt) setImageAlt(preset.label);
                          }}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                            imageUrl === preset.url
                              ? "border-ember bg-ember/15 text-ember font-semibold"
                              : "border-hairline bg-canvas text-ink hover:border-ember"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MODIFICADORES & OPCIONES */}
            {activeTab === "modificadores" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-ink">
                      Grupos de Opciones &amp; Modificadores
                    </h3>
                    <p className="text-[11px] text-ink-muted">
                      Configura términos de cocción, guarniciones incluidas o
                      adicionales con costo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOptionGroup}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-ember px-3.5 py-1.5 text-xs font-semibold text-ivory shadow-2xs hover:bg-ember-hover"
                  >
                    <Plus className="size-3.5" />
                    <span>Añadir Grupo</span>
                  </button>
                </div>

                {optionGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
                    <Layers className="mx-auto size-8 text-ink-muted" />
                    <p className="mt-2 text-xs font-semibold text-ink">
                      Este plato no tiene grupos de modificadores
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Puedes añadir opciones como punto de carne, tipo de leche o salsas.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddOptionGroup}
                      className="mt-3 inline-flex items-center gap-1 rounded-xl bg-canvas px-3 py-1.5 text-xs font-semibold text-ember hover:bg-surface-accent"
                    >
                      <Plus className="size-3" />
                      <span>Crear primer grupo</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {optionGroups.map((group, gIdx) => (
                      <div
                        key={gIdx}
                        className="rounded-2xl border border-hairline bg-canvas p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                              Nombre del Grupo
                            </label>
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) =>
                                handleUpdateOptionGroup(gIdx, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Ej. Término de la carne"
                              className="mt-0.5 h-8 w-full rounded-xl border border-border-strong bg-canvas px-2.5 font-semibold text-ink focus:border-ember focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="flex cursor-pointer items-center gap-1.5 font-medium text-ink">
                              <input
                                type="checkbox"
                                checked={group.is_required}
                                onChange={(e) =>
                                  handleUpdateOptionGroup(gIdx, {
                                    is_required: e.target.checked,
                                    min_selections: e.target.checked ? 1 : 0,
                                  })
                                }
                                className="size-3.5 accent-ember"
                              />
                              <span>Requerido</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveOptionGroup(gIdx)}
                              className="rounded-lg p-1 text-ink-muted hover:bg-crimson/10 hover:text-crimson"
                              aria-label="Eliminar grupo de opciones"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Helper Text & Min/Max */}
                        <div className="grid grid-cols-1 gap-2 pt-2.5 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                              Texto de Ayuda (Opcional)
                            </label>
                            <input
                              type="text"
                              value={group.helper_text ?? ""}
                              onChange={(e) =>
                                handleUpdateOptionGroup(gIdx, {
                                  helper_text: e.target.value,
                                })
                              }
                              placeholder="Ej. El chef recomienda Término Medio"
                              className="mt-0.5 h-8 w-full rounded-xl border border-border-strong bg-canvas px-2.5 text-ink focus:border-ember focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <div>
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                                Mín.
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={group.min_selections}
                                onChange={(e) =>
                                  handleUpdateOptionGroup(gIdx, {
                                    min_selections: Number(e.target.value),
                                  })
                                }
                                className="mt-0.5 h-8 w-14 rounded-xl border border-border-strong bg-canvas px-2 font-mono text-ink focus:border-ember focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                                Máx.
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={group.max_selections}
                                onChange={(e) =>
                                  handleUpdateOptionGroup(gIdx, {
                                    max_selections: Number(e.target.value),
                                  })
                                }
                                className="mt-0.5 h-8 w-14 rounded-xl border border-border-strong bg-canvas px-2 font-mono text-ink focus:border-ember focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="mt-3 space-y-1.5 border-t border-hairline pt-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                            Opciones del grupo:
                          </span>

                          {group.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className="flex items-center gap-2 rounded-xl bg-canvas-elevated p-2"
                            >
                              <input
                                type="text"
                                value={opt.name}
                                onChange={(e) =>
                                  handleUpdateOptionInGroup(gIdx, oIdx, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Nombre de la opción"
                                className="h-7 flex-1 rounded-lg border border-border-strong bg-canvas px-2 text-ink focus:border-ember focus:outline-none"
                              />

                              <div className="flex items-center gap-1 font-mono">
                                <span className="text-[11px] text-ink-muted">
                                  +$
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={opt.price_delta}
                                  onChange={(e) =>
                                    handleUpdateOptionInGroup(gIdx, oIdx, {
                                      price_delta: Number(
                                        sanitizeNumericInput(e.target.value, 8)
                                      ),
                                    })
                                  }
                                  className="h-7 w-20 rounded-lg border border-border-strong bg-canvas px-2 text-right text-xs text-ink focus:border-ember focus:outline-none"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOptionFromGroup(gIdx, oIdx)
                                }
                                className="p-1 text-ink-muted hover:text-crimson"
                                aria-label="Eliminar opción"
                              >
                                ✕
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleAddOptionToGroup(gIdx)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ember hover:underline"
                          >
                            + Añadir opción a este grupo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-hairline bg-canvas/40 px-6 py-3.5">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="rounded-2xl border border-border-strong bg-canvas px-4 py-2 text-xs font-semibold text-ink hover:border-ember disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-ember px-5 py-2.5 text-xs font-semibold text-ivory shadow-2xs transition hover:bg-ember-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="size-3.5" />
              <span>
                {isPending
                  ? "Guardando en PostgreSQL..."
                  : isEditMode
                  ? "Guardar Cambios"
                  : "Crear Plato"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
