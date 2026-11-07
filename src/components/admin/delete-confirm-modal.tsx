"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName: string;
  isPending: boolean;
  confirmLabel?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  isPending,
  confirmLabel = "Sí, eliminar permanentemente",
}: DeleteConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
    >
      <div
        className="fixed inset-0 bg-obsidian/75"
        onClick={() => {
          if (!isPending) onClose();
        }}
      />

      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated p-6 text-ink shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-crimson/15 text-crimson">
            <AlertTriangle className="size-6" />
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4">
          <h3
            id="delete-dialog-title"
            className="font-display text-xl font-semibold text-ink"
          >
            {title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {description}
          </p>

          <div className="mt-3 rounded-2xl border border-crimson/25 bg-crimson/5 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-crimson">
              Elemento a eliminar:
            </span>
            <p className="mt-0.5 font-semibold text-ink break-words">
              {itemName}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-2xl border border-border-strong bg-canvas px-4 py-2.5 text-xs font-semibold text-ink transition hover:border-ember disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-crimson px-4 py-2.5 text-xs font-semibold text-ivory shadow-2xs transition hover:bg-crimson/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            <span>{isPending ? "Eliminando..." : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
