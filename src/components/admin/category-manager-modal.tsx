"use client";

import { useState, useId, useTransition } from "react";
import {
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  Layers,
  Save,
  RotateCcw,
} from "lucide-react";
import type { OperationalCategoryItem } from "@/modules/admin/queries";
import {
  adminUpsertCategoryAction,
  adminDeleteCategoryAction,
  adminReorderCategoriesAction,
} from "@/modules/admin/actions";
import { DeleteConfirmModal } from "./delete-confirm-modal";

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: OperationalCategoryItem[];
  restaurantSlug: string;
  onCategoriesChanged: (updatedCategories: OperationalCategoryItem[]) => void;
}

function slugifyCategory(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  restaurantSlug,
  onCategoriesChanged,
}: CategoryManagerModalProps) {
  const [localCategories, setLocalCategories] =
    useState<OperationalCategoryItem[]>(categories);
  const [editingCategory, setEditingCategory] =
    useState<OperationalCategoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [isSlugAuto, setIsSlugAuto] = useState(true);
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDisplayMode, setFormDisplayMode] = useState<
    "editorial_grid" | "compact_list" | "featured_cards"
  >("editorial_grid");
  const [formIsActive, setFormIsActive] = useState(true);

  // Deletion flow
  const [categoryToDelete, setCategoryToDelete] =
    useState<OperationalCategoryItem | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameInputId = useId();
  const slugInputId = useId();
  const subtitleInputId = useId();
  const descInputId = useId();
  const modeInputId = useId();
  const reassignSelectId = useId();

  // Reset local state when opened or categories prop updates
  useState(() => {
    setLocalCategories(categories);
  });

  function resetForm() {
    setEditingCategory(null);
    setIsCreating(false);
    setFormName("");
    setFormSlug("");
    setIsSlugAuto(true);
    setFormSubtitle("");
    setFormDescription("");
    setFormDisplayMode("editorial_grid");
    setFormIsActive(true);
    setErrorMessage(null);
  }

  function handleStartCreate() {
    resetForm();
    setIsCreating(true);
  }

  function handleStartEdit(cat: OperationalCategoryItem) {
    setEditingCategory(cat);
    setIsCreating(false);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setIsSlugAuto(false);
    setFormSubtitle(cat.subtitle ?? "");
    setFormDescription(cat.description ?? "");
    setFormDisplayMode(cat.display_mode);
    setFormIsActive(cat.is_active);
    setErrorMessage(null);
  }

  function handleMove(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === localCategories.length - 1)
    ) {
      return;
    }

    const nextCategories = [...localCategories];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = nextCategories[index]!;
    nextCategories[index] = nextCategories[targetIndex]!;
    nextCategories[targetIndex] = temp;

    // Recalculate sort_order
    const updated = nextCategories.map((c, i) => ({
      ...c,
      sort_order: i + 1,
    }));

    setLocalCategories(updated);

    startTransition(async () => {
      const orders = updated.map((c) => ({
        id: c.id,
        sort_order: c.sort_order,
      }));
      const res = await adminReorderCategoriesAction({
        restaurantSlug,
        categoryOrders: orders,
      });

      if (!res.ok) {
        setErrorMessage(res.error ?? "No fue posible reordenar las categorías.");
        setLocalCategories(categories);
      } else {
        setSuccessMessage("Orden de categorías actualizado en PostgreSQL.");
        onCategoriesChanged(updated);
      }
    });
  }

  function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (formName.trim().length < 2) {
      setErrorMessage("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    if (formSlug.trim().length < 2) {
      setErrorMessage("El slug debe tener al menos 2 caracteres.");
      return;
    }

    startTransition(async () => {
      const res = await adminUpsertCategoryAction({
        restaurantSlug,
        categoryId: editingCategory?.id,
        name: formName.trim(),
        slug: formSlug.trim(),
        subtitle: formSubtitle.trim() || null,
        description: formDescription.trim() || null,
        displayMode: formDisplayMode,
        isActive: formIsActive,
        sortOrder:
          editingCategory?.sort_order ?? localCategories.length + 1,
      });

      if (!res.ok) {
        setErrorMessage(res.error ?? "Error al guardar la categoría.");
        return;
      }

      let updatedList: OperationalCategoryItem[];
      if (editingCategory) {
        updatedList = localCategories.map((c) =>
          c.id === editingCategory.id
            ? {
                ...c,
                name: formName.trim(),
                slug: formSlug.trim(),
                subtitle: formSubtitle.trim() || null,
                description: formDescription.trim() || null,
                display_mode: formDisplayMode,
                is_active: formIsActive,
              }
            : c
        );
        setSuccessMessage(`Categoría "${formName}" actualizada con éxito.`);
      } else {
        const newCat: OperationalCategoryItem = {
          id: res.categoryId ?? "temp-id",
          menu_id: categories[0]?.menu_id ?? "menu-id",
          name: formName.trim(),
          slug: formSlug.trim(),
          subtitle: formSubtitle.trim() || null,
          description: formDescription.trim() || null,
          display_mode: formDisplayMode,
          is_active: formIsActive,
          sort_order: localCategories.length + 1,
          products_count: 0,
        };
        updatedList = [...localCategories, newCat];
        setSuccessMessage(`Categoría "${formName}" creada con éxito.`);
      }

      setLocalCategories(updatedList);
      onCategoriesChanged(updatedList);
      resetForm();
    });
  }

  function handleConfirmDelete() {
    if (!categoryToDelete) return;
    setErrorMessage(null);

    startTransition(async () => {
      const res = await adminDeleteCategoryAction({
        restaurantSlug,
        categoryId: categoryToDelete.id,
        reassignToCategoryId: reassignTargetId || null,
      });

      if (!res.ok) {
        setErrorMessage(res.error ?? "Error al eliminar la categoría.");
        setCategoryToDelete(null);
        return;
      }

      const updatedList = localCategories.filter(
        (c) => c.id !== categoryToDelete.id
      );
      setLocalCategories(updatedList);
      onCategoriesChanged(updatedList);
      setSuccessMessage(
        `Categoría "${categoryToDelete.name}" eliminada correctamente.`
      );
      setCategoryToDelete(null);
      setReassignTargetId("");
    });
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md"
      >
        <div
          className="fixed inset-0 bg-obsidian/80"
          onClick={() => {
            if (!isPending) onClose();
          }}
        />

        <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ember/15 px-2.5 py-0.5 text-xs font-semibold text-ember">
                  Estructura de Carta
                </span>
                <span className="text-xs text-ink-muted">/{restaurantSlug}</span>
              </div>
              <h2
                id="category-manager-title"
                className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl"
              >
                Gestor de Categorías en Vivo
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

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-crimson/30 bg-crimson/10 p-3 text-xs text-crimson">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-sage/30 bg-sage/10 p-3 text-xs text-sage">
              <Check className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Inline Creation / Edit Form */}
            {(isCreating || editingCategory) && (
              <form
                onSubmit={handleSaveCategory}
                className="mb-6 rounded-2xl border border-ember/30 bg-surface-accent/70 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between border-b border-hairline pb-3">
                  <h3 className="font-semibold text-sm text-ink">
                    {editingCategory
                      ? `Editar Categoría: ${editingCategory.name}`
                      : "Nueva Categoría"}
                  </h3>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-ink-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={nameInputId}
                        className="block text-xs font-semibold text-ink"
                      >
                        Nombre de la Categoría *
                      </label>
                      <input
                        id={nameInputId}
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => {
                          setFormName(e.target.value);
                          if (isSlugAuto) {
                            setFormSlug(slugifyCategory(e.target.value));
                          }
                        }}
                        placeholder="Ej. Guarniciones de Fuego"
                        className="mt-1 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 text-xs text-ink focus:border-ember focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={slugInputId}
                          className="block text-xs font-semibold text-ink"
                        >
                          Slug / URL *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsSlugAuto(!isSlugAuto)}
                          className="text-[11px] font-medium text-ember hover:underline"
                        >
                          {isSlugAuto ? "Manual" : "Auto"}
                        </button>
                      </div>
                      <input
                        id={slugInputId}
                        type="text"
                        required
                        disabled={isSlugAuto}
                        value={formSlug}
                        onChange={(e) =>
                          setFormSlug(slugifyCategory(e.target.value))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 font-mono text-xs text-ink focus:border-ember focus:outline-none disabled:bg-canvas/50 disabled:text-ink-muted"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={subtitleInputId}
                        className="block text-xs font-semibold text-ink"
                      >
                        Subtítulo Editorial (Opcional)
                      </label>
                      <input
                        id={subtitleInputId}
                        type="text"
                        value={formSubtitle}
                        onChange={(e) => setFormSubtitle(e.target.value)}
                        placeholder="Ej. Para abrir conversación al centro"
                        className="mt-1 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 text-xs text-ink focus:border-ember focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={modeInputId}
                        className="block text-xs font-semibold text-ink"
                      >
                        Modo de Visualización
                      </label>
                      <select
                        id={modeInputId}
                        value={formDisplayMode}
                        onChange={(e) =>
                          setFormDisplayMode(
                            e.target.value as typeof formDisplayMode
                          )
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 text-xs font-semibold text-ink focus:border-ember focus:outline-none"
                      >
                        <option value="editorial_grid">
                          Grilla Editorial (Platos Principales)
                        </option>
                        <option value="compact_list">
                          Lista Compacta (Vinos, Cava, Bebidas)
                        </option>
                        <option value="featured_cards">
                          Tarjetas Destacadas
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={descInputId}
                      className="block text-xs font-semibold text-ink"
                    >
                      Descripción de Categoría
                    </label>
                    <input
                      id={descInputId}
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Breve nota sobre los ingredientes o técnicas de esta sección..."
                      className="mt-1 h-9 w-full rounded-xl border border-border-strong bg-canvas px-3 text-xs text-ink focus:border-ember focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="size-3.5 accent-ember"
                      />
                      <span>Categoría Activa (Visible en Carta)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-xl border border-border-strong bg-canvas px-3 py-1.5 text-xs font-semibold text-ink hover:border-ember"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-1.5 text-xs font-semibold text-ivory shadow-2xs hover:bg-ember-hover disabled:opacity-50"
                      >
                        <Save className="size-3.5" />
                        <span>
                          {isPending
                            ? "Guardando..."
                            : editingCategory
                            ? "Actualizar"
                            : "Crear Categoría"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Category List */}
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold text-ink">
                Categorías en Carta ({localCategories.length})
              </span>

              {!isCreating && !editingCategory && (
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-ember px-3.5 py-1.5 text-xs font-semibold text-ivory shadow-2xs hover:bg-ember-hover"
                >
                  <Plus className="size-3.5" />
                  <span>Nueva Categoría</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-canvas">
              {localCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-surface-accent font-mono text-xs font-semibold text-ember">
                      {idx + 1}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-sm text-ink">
                          {cat.name}
                        </h4>
                        <span className="rounded-full bg-surface-accent px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                          {cat.products_count}{" "}
                          {cat.products_count === 1 ? "plato" : "platos"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cat.is_active
                              ? "bg-sage/15 text-sage"
                              : "bg-canvas-muted text-ink-muted"
                          }`}
                        >
                          {cat.is_active ? "Activa" : "Inactiva"}
                        </span>
                        <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[10px] text-ink-muted">
                          {cat.display_mode === "editorial_grid"
                            ? "Grilla Editorial"
                            : cat.display_mode === "compact_list"
                            ? "Lista Compacta"
                            : "Tarjetas"}
                        </span>
                      </div>

                      {cat.subtitle && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {cat.subtitle}
                        </p>
                      )}
                      <p className="font-mono text-[11px] text-ink-subtle">
                        Slug: #{cat.slug}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={idx === 0 || isPending}
                      onClick={() => handleMove(idx, "up")}
                      className="rounded-xl border border-hairline p-1.5 text-ink-muted hover:border-ember hover:text-ink disabled:opacity-30"
                      aria-label="Subir categoría"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === localCategories.length - 1 || isPending}
                      onClick={() => handleMove(idx, "down")}
                      className="rounded-xl border border-hairline p-1.5 text-ink-muted hover:border-ember hover:text-ink disabled:opacity-30"
                      aria-label="Bajar categoría"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStartEdit(cat)}
                      className="inline-flex items-center gap-1 rounded-xl border border-hairline px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-ember hover:text-ember"
                    >
                      <Pencil className="size-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setCategoryToDelete(cat);
                        // Default reassign target to another category if any exist
                        const otherCat = localCategories.find(
                          (c) => c.id !== cat.id
                        );
                        setReassignTargetId(otherCat?.id ?? "");
                      }}
                      className="rounded-xl p-1.5 text-ink-muted hover:bg-crimson/10 hover:text-crimson"
                      aria-label={`Eliminar categoría ${cat.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-hairline bg-canvas/40 px-6 py-3.5 text-right">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-ivory hover:bg-ink/80"
            >
              Listo
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Eliminar Categoría"
          description={
            categoryToDelete.products_count > 0
              ? `Esta categoría contiene ${categoryToDelete.products_count} plato(s). Para eliminarla de forma segura, selecciona a qué categoría mover sus platos:`
              : "¿Estás seguro de eliminar esta categoría de la carta?"
          }
          itemName={categoryToDelete.name}
          isPending={isPending}
        />
      )}
    </>
  );
}
