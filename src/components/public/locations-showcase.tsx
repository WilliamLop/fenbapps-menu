"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Sparkles,
  Images,
  CheckCircle2,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  UtensilsCrossed,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";
import type {
  LocationRow,
  EventSpaceRow,
  OpeningHourSlot,
} from "@/modules/tenant/queries";

interface LocationsShowcaseProps {
  restaurantName: string;
  restaurantSlug: string;
  locations: LocationRow[];
  eventSpaces: EventSpaceRow[];
}

function parseGallery(rawGallery: unknown, fallback: string | null): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  if (fallback && fallback.trim().length > 0) {
    seen.add(fallback.trim());
    list.push(fallback.trim());
  }
  if (Array.isArray(rawGallery)) {
    for (const item of rawGallery) {
      if (typeof item === "string" && item.trim().length > 0) {
        const clean = item.trim();
        if (!seen.has(clean)) {
          seen.add(clean);
          list.push(clean);
        }
      }
    }
  }
  return list;
}

export function LocationsShowcase({
  restaurantName,
  restaurantSlug,
  locations,
  eventSpaces,
}: LocationsShowcaseProps) {
  const [activeSlideByLoc, setActiveSlideByLoc] = useState<
    Record<string, number>
  >({});
  const [selectedLocModal, setSelectedLocModal] = useState<{
    loc: LocationRow;
    gallery: string[];
    slideIndex: number;
  } | null>(null);

  if (locations.length === 0) return null;

  const isSingleLocation = locations.length === 1;
  const gridColsClass = isSingleLocation
    ? "grid-cols-1"
    : locations.length === 2
      ? "grid-cols-1 lg:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id="sedes"
      className="scroll-mt-36 lg:scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6"
    >
      <div className="mb-10 flex flex-col justify-between gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">
            {isSingleLocation
              ? "El Establecimiento & Contacto Directo"
              : "Arquitectura, Sedes & Diferenciales"}
          </span>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {isSingleLocation
              ? "Nuestra Casa, Espacios y Horarios de Atención"
              : "Nuestras Sedes: Conoce Cada Espacio y su Personalidad"}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">
          {isSingleLocation
            ? `Recorre en imágenes cada ambiente de ${restaurantName}, revisa nuestros horarios de servicio y escríbenos directo sin intermediarios.`
            : `Cada sede de ${restaurantName} cuenta con arquitectura propia, salones para grupos y especialidades exclusivas. Explora sus galerías y horarios.`}
        </p>
      </div>

      <div className={`grid gap-8 ${gridColsClass}`}>
        {locations.map((loc) => {
          const hours = Array.isArray(loc.opening_hours)
            ? (loc.opening_hours as unknown as OpeningHourSlot[])
            : [];
          const gallery = parseGallery(loc.gallery_urls, loc.cover_image_url);
          const activeSlideIdx =
            (activeSlideByLoc[loc.id] ?? 0) % Math.max(1, gallery.length);
          const activeHeroSrc = gallery[activeSlideIdx] ?? gallery[0];
          const spacesInLoc = eventSpaces.filter(
            (sp) => sp.location_id === loc.id
          );
          const cleanLocName = isSingleLocation
            ? loc.name.replace(/\s*\(Única Sede\)/i, "")
            : loc.name;

          const waUrl = loc.whatsapp_phone
            ? buildWhatsAppUrl(
                loc.whatsapp_phone,
                `Hola ${restaurantName}${
                  isSingleLocation ? "" : ` (${loc.name})`
                }, quisiera hacer una consulta.`
              )
            : null;

          if (isSingleLocation) {
            /* Adaptive Single-Location Editorial Split Layout (Zero oversized vertical wall) */
            return (
              <article
                key={loc.id}
                className="overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-sm"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Left Column: Balanced Gallery Preview + Crisp Active Thumbnails */}
                  <div className="flex flex-col justify-between border-b border-hairline bg-canvas-muted/50 lg:col-span-7 lg:border-b-0 lg:border-r">
                    {activeHeroSrc && (
                      <div
                        onClick={() =>
                          setSelectedLocModal({
                            loc,
                            gallery,
                            slideIndex: activeSlideIdx,
                          })
                        }
                        className="group relative aspect-[16/10] min-h-[280px] w-full flex-1 cursor-pointer overflow-hidden bg-canvas-muted lg:aspect-auto"
                      >
                        <Image
                          src={activeHeroSrc}
                          alt={cleanLocName}
                          fill
                          sizes="(max-width: 1024px) 100vw, 58vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-obsidian/15 to-transparent" />

                        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                          <span className="rounded-full border border-obsidian-border bg-obsidian/90 px-3.5 py-1 text-xs font-semibold text-ivory">
                            {loc.neighborhood ?? loc.city}
                          </span>

                          {gallery.length > 1 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian/90 px-3.5 py-1 text-xs font-medium text-ivory">
                              <Images className="size-3.5 text-gold" />
                              <span>
                                Ver galería ({activeSlideIdx + 1}/
                                {gallery.length})
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="font-display text-2xl font-semibold text-ivory sm:text-3xl">
                            {cleanLocName}
                          </h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-ivory/95">
                            <MapPin className="size-4 shrink-0 text-gold" />
                            <span>
                              {loc.address_line} · {loc.city}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    {gallery.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 bg-canvas px-4 py-3 sm:px-5">
                        {gallery.slice(0, 4).map((imgUrl, idx) => {
                          const isCurrent = activeSlideIdx === idx;
                          return (
                            <button
                              key={imgUrl + idx}
                              type="button"
                              onClick={() =>
                                setActiveSlideByLoc((prev) => ({
                                  ...prev,
                                  [loc.id]: idx,
                                }))
                              }
                              aria-label={`Ver fotografía ${idx + 1} de ${cleanLocName}`}
                              className={`relative aspect-[16/10] overflow-hidden rounded-xl border bg-canvas-muted transition ${
                                isCurrent
                                  ? "border-ember ring-2 ring-ember"
                                  : "border-hairline opacity-80 hover:opacity-100"
                              }`}
                            >
                              <Image
                                src={imgUrl}
                                alt={`${cleanLocName} vista ${idx + 1}`}
                                fill
                                sizes="(max-width: 1024px) 24vw, 150px"
                                className="object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Establishment Story, Attributes, Compact Hours & Direct Actions */}
                  <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
                    <div className="space-y-5">
                      {loc.description && (
                        <p className="text-sm leading-relaxed text-ink-muted sm:text-base">
                          {loc.description}
                        </p>
                      )}

                      {loc.exclusive_features &&
                        loc.exclusive_features.length > 0 && (
                          <div className="rounded-2xl border border-ember/25 bg-surface-accent p-4">
                            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ember">
                              <Sparkles className="size-3.5 shrink-0" />
                              <span>Atributos del establecimiento</span>
                            </p>
                            <ul className="grid grid-cols-1 gap-2 text-sm text-ink">
                              {loc.exclusive_features.map((feat) => (
                                <li
                                  key={feat}
                                  className="flex items-start gap-2"
                                >
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                                  <span className="font-medium leading-snug">
                                    {feat}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {spacesInLoc.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            Espacios privados para eventos ({spacesInLoc.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {spacesInLoc.map((sp) => (
                              <Link
                                key={sp.id}
                                href={`/${restaurantSlug}/eventos?salon=${sp.slug}`}
                                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ember hover:text-ember"
                              >
                                <Users className="size-3.5 text-ember" />
                                <span>{sp.name}</span>
                                <span className="tabular-price font-mono text-xs text-ink-muted">
                                  ({sp.min_guests}–{sp.capacity_seated} pax)
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {hours.length > 0 && (
                        <div className="border-t border-hairline pt-4">
                          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink">
                            <Clock className="size-3.5 text-ember" />
                            <span>Horarios de atención</span>
                          </p>
                          <div className="space-y-2 text-sm">
                            {hours.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-hairline pb-1.5 last:border-b-0 last:pb-0"
                              >
                                <span className="font-medium text-ink">
                                  {slot.days}
                                </span>
                                <span className="tabular-price font-mono text-xs font-medium text-ink-muted">
                                  {slot.hours}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-hairline pt-5">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-4 py-2.5 text-xs font-semibold text-ivory shadow-xs transition hover:bg-ember-hover"
                        >
                          <MessageCircle className="size-4" />
                          <span>WhatsApp Directo</span>
                        </a>
                      )}
                      {loc.contact_phone && (
                        <span className="tabular-price inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3.5 py-2 text-xs font-mono text-ink">
                          <Phone className="size-3.5 text-ember" />
                          {loc.contact_phone}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLocModal({
                            loc,
                            gallery,
                            slideIndex: activeSlideIdx,
                          })
                        }
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-canvas px-4 py-2 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                      >
                        <Images className="size-3.5 text-ember" />
                        <span>Ampliar fotos</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          }

          /* Multi-Location Card Layout (2 or 3+ Sedes) */
          return (
            <article
              key={loc.id}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-xs transition hover:border-ember/40 hover:shadow-md"
            >
              <div>
                {activeHeroSrc && (
                  <div
                    onClick={() =>
                      setSelectedLocModal({
                        loc,
                        gallery,
                        slideIndex: activeSlideIdx,
                      })
                    }
                    className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden bg-canvas-muted"
                  >
                    <Image
                      src={activeHeroSrc}
                      alt={loc.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/20 to-transparent" />

                    <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 text-xs font-semibold text-ivory">
                        {loc.neighborhood ?? loc.city}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {loc.is_primary && (
                          <span className="rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                            Sede Principal
                          </span>
                        )}
                        {gallery.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 text-xs font-medium text-ivory">
                            <Images className="size-3.5 text-gold" />
                            <span>{gallery.length} fotos</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="font-display text-2xl font-semibold text-ivory sm:text-3xl">
                        {loc.name}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ivory/95 sm:text-sm">
                        <MapPin className="size-3.5 shrink-0 text-gold" />
                        <span>
                          {loc.address_line} · {loc.city}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {gallery.length > 1 && (
                  <div className="grid grid-cols-4 gap-1.5 border-b border-hairline bg-canvas px-5 py-2.5">
                    {gallery.slice(0, 4).map((imgUrl, idx) => {
                      const isCurrent = activeSlideIdx === idx;
                      return (
                        <button
                          key={imgUrl + idx}
                          type="button"
                          onClick={() =>
                            setActiveSlideByLoc((prev) => ({
                              ...prev,
                              [loc.id]: idx,
                            }))
                          }
                          aria-label={`Ver foto ${idx + 1} de ${loc.name}`}
                          className={`relative aspect-[16/10] overflow-hidden rounded-xl border bg-canvas-muted transition ${
                            isCurrent
                              ? "border-ember ring-1 ring-ember"
                              : "border-hairline opacity-80 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={imgUrl}
                            alt={`${loc.name} foto ${idx + 1}`}
                            fill
                            sizes="(max-width: 1024px) 24vw, 130px"
                            className="object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="p-6 sm:p-7">
                  {loc.description && (
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {loc.description}
                    </p>
                  )}

                  {loc.exclusive_features &&
                    loc.exclusive_features.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-ember/25 bg-surface-accent p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ember">
                          <Sparkles className="size-3.5" />
                          <span>Diferenciales de {loc.name}</span>
                        </p>
                        <ul className="grid grid-cols-1 gap-2 text-xs text-ink sm:grid-cols-2 sm:text-sm">
                          {loc.exclusive_features.map((feat) => (
                            <li key={feat} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                              <span className="font-medium leading-snug">
                                {feat}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {spacesInLoc.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Salones privados en esta sede ({spacesInLoc.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {spacesInLoc.map((sp) => (
                          <Link
                            key={sp.id}
                            href={`/${restaurantSlug}/eventos?sede=${loc.slug}&salon=${sp.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ember hover:text-ember"
                          >
                            <Users className="size-3.5 text-ember" />
                            <span>{sp.name}</span>
                            <span className="tabular-price font-mono text-xs text-ink-muted">
                              ({sp.min_guests}–{sp.capacity_seated} pax)
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {hours.length > 0 && (
                    <div className="mt-6 border-t border-hairline pt-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink">
                        <Clock className="size-3.5 text-ember" />
                        <span>Horarios de servicio</span>
                      </p>
                      <div className="flex flex-col gap-1.5 text-xs text-ink-muted sm:text-sm">
                        {hours.map((slot, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-ink">
                              {slot.days}
                            </span>
                            <span className="tabular-price font-mono text-xs">
                              {slot.hours}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-canvas/60 px-6 py-4 sm:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>WhatsApp {loc.name}</span>
                    </a>
                  )}
                  {loc.contact_phone && (
                    <span className="tabular-price inline-flex min-h-10 items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-3.5 py-2 text-xs font-mono text-ink-muted">
                      <Phone className="size-3.5 text-ember" />
                      {loc.contact_phone}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedLocModal({
                      loc,
                      gallery,
                      slideIndex: activeSlideIdx,
                    })
                  }
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ember/35 bg-surface-accent px-4 py-2 text-xs font-semibold text-ember transition hover:bg-ember hover:text-ivory"
                >
                  <Images className="size-3.5" />
                  <span>Conocer sede por dentro</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Light-First Editorial Establishment Gallery Modal */}
      {selectedLocModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${selectedLocModal.loc.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedLocModal(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ember">
                  {selectedLocModal.loc.neighborhood ??
                    selectedLocModal.loc.city}
                </span>
                <h3 className="font-display text-2xl font-semibold text-ink">
                  {isSingleLocation
                    ? selectedLocModal.loc.name.replace(
                        /\s*\(Única Sede\)/i,
                        ""
                      )
                    : selectedLocModal.loc.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocModal(null)}
                aria-label="Cerrar galería"
                className="flex size-10 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition hover:border-ember hover:text-ember"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedLocModal.gallery.length > 0 && (
                <div className="relative aspect-[16/9] w-full bg-canvas-muted">
                  <Image
                    src={
                      selectedLocModal.gallery[selectedLocModal.slideIndex] ??
                      selectedLocModal.gallery[0] ??
                      ""
                    }
                    alt={selectedLocModal.loc.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-cover"
                  />
                  {selectedLocModal.gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Foto anterior"
                        onClick={() =>
                          setSelectedLocModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slideIndex:
                                    (prev.slideIndex -
                                      1 +
                                      prev.gallery.length) %
                                    prev.gallery.length,
                                }
                              : null
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-ember"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Siguiente foto"
                        onClick={() =>
                          setSelectedLocModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slideIndex:
                                    (prev.slideIndex + 1) %
                                    prev.gallery.length,
                                }
                              : null
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-ember"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-5 p-6">
                <p className="text-sm leading-relaxed text-ink-muted sm:text-base">
                  {selectedLocModal.loc.description}
                </p>

                {selectedLocModal.loc.exclusive_features?.length > 0 && (
                  <div>
                    <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ember">
                      {isSingleLocation
                        ? "Experiencia y atributos de la casa"
                        : `¿Qué hace única a ${selectedLocModal.loc.name}?`}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedLocModal.loc.exclusive_features.map((feat) => (
                        <div
                          key={feat}
                          className="flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink"
                        >
                          <CheckCircle2 className="size-4 shrink-0 text-ember" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                  <div className="flex flex-wrap gap-2.5">
                    <Link
                      href={
                        isSingleLocation
                          ? `/${restaurantSlug}/menu`
                          : `/${restaurantSlug}/menu?sede=${selectedLocModal.loc.slug}`
                      }
                      onClick={() => setSelectedLocModal(null)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ember px-5 py-2.5 text-xs font-semibold text-ivory transition hover:bg-ember-hover"
                    >
                      <UtensilsCrossed className="size-3.5" />
                      <span>
                        {isSingleLocation
                          ? "Explorar Carta Digital"
                          : `Ver Carta de ${selectedLocModal.loc.name}`}
                      </span>
                    </Link>
                    <Link
                      href={
                        isSingleLocation
                          ? `/${restaurantSlug}/eventos`
                          : `/${restaurantSlug}/eventos?sede=${selectedLocModal.loc.slug}`
                      }
                      onClick={() => setSelectedLocModal(null)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-canvas px-5 py-2.5 text-xs font-semibold text-ink transition hover:border-ember hover:text-ember"
                    >
                      <Sparkles className="size-3.5 text-ember" />
                      <span>
                        {isSingleLocation
                          ? "Cotizar Salón Privado"
                          : `Cotizar Evento en ${selectedLocModal.loc.name}`}
                      </span>
                    </Link>
                  </div>

                  {selectedLocModal.loc.google_maps_url && (
                    <a
                      href={selectedLocModal.loc.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ember hover:underline"
                    >
                      <span>Abrir en Google Maps</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
