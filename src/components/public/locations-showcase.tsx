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
  const list: string[] = [];
  if (Array.isArray(rawGallery)) {
    for (const item of rawGallery) {
      if (typeof item === "string" && item.trim().length > 0) {
        list.push(item);
      }
    }
  }
  if (list.length === 0 && fallback) {
    list.push(fallback);
  }
  return list;
}

export function LocationsShowcase({
  restaurantName,
  restaurantSlug,
  locations,
  eventSpaces,
}: LocationsShowcaseProps) {
  const [selectedLocModal, setSelectedLocModal] = useState<{
    loc: LocationRow;
    gallery: string[];
    slideIndex: number;
  } | null>(null);

  if (locations.length === 0) return null;

  const isSingleLocation = locations.length === 1;

  return (
    <section id="sedes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-10 flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
            {isSingleLocation
              ? "El Establecimiento & Contacto Directo"
              : "Arquitectura, Sedes & Diferenciales"}
          </span>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {isSingleLocation
              ? "Nuestra Casa, Espacios y Horarios de Atención"
              : "Nuestras Sedes: Conoce el Establecimiento y su Diferencial"}
          </h2>
        </div>
        {!isSingleLocation && (
          <p className="max-w-md text-sm text-ink-muted">
            Cada sede de {restaurantName} tiene su propia personalidad arquitectónica, salones privados y especialidades de horno. Explora sus fotografías y diferenciales.
          </p>
        )}
      </div>

      <div
        className={`grid grid-cols-1 gap-8 ${
          isSingleLocation ? "lg:grid-cols-1" : "lg:grid-cols-2"
        }`}
      >
        {locations.map((loc) => {
          const hours = Array.isArray(loc.opening_hours)
            ? (loc.opening_hours as unknown as OpeningHourSlot[])
            : [];
          const gallery = parseGallery(loc.gallery_urls, loc.cover_image_url);
          const spacesInLoc = eventSpaces.filter(
            (sp) => sp.location_id === loc.id
          );
          const waUrl = loc.whatsapp_phone
            ? buildWhatsAppUrl(
                loc.whatsapp_phone,
                `Hola ${restaurantName} (${loc.name}), quisiera hacer una consulta.`
              )
            : null;

          return (
            <article
              key={loc.id}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated shadow-xs transition hover:border-ember/40 hover:shadow-md"
            >
              <div>
                {/* Visual Establishment Header + Gallery Trigger */}
                {gallery.length > 0 && (
                  <div
                    onClick={() =>
                      setSelectedLocModal({
                        loc,
                        gallery,
                        slideIndex: 0,
                      })
                    }
                    className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden bg-obsidian"
                  >
                    <Image
                      src={gallery[0] ?? "/demo/casa-brasa/sede-parque-93.jpg"}
                      alt={loc.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/20 to-transparent" />

                    <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-obsidian/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold border border-obsidian-border">
                        {loc.neighborhood ?? loc.city}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {loc.is_primary && !isSingleLocation && (
                          <span className="rounded-full bg-ember px-3 py-1 text-[11px] font-semibold text-ivory">
                            Sede Principal
                          </span>
                        )}
                        {gallery.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-obsidian/90 px-3 py-1 text-xs font-medium text-ivory border border-obsidian-border">
                            <Images className="size-3.5 text-ember-glow" />
                            <span>Ver {gallery.length} fotos</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="font-display text-3xl font-semibold text-ivory">
                          {loc.name}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ivory/90">
                          <MapPin className="size-3.5 shrink-0 text-ember-glow" />
                          <span>
                            {loc.address_line} · {loc.city}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thumbnail Strip for the Establishment */}
                {gallery.length > 1 && (
                  <div className="grid grid-cols-4 gap-1.5 border-b border-hairline bg-canvas px-5 py-2.5">
                    {gallery.slice(0, 4).map((imgUrl, idx) => (
                      <button
                        key={imgUrl + idx}
                        type="button"
                        onClick={() =>
                          setSelectedLocModal({
                            loc,
                            gallery,
                            slideIndex: idx,
                          })
                        }
                        className="relative aspect-[16/10] overflow-hidden rounded-xl border border-hairline opacity-80 transition hover:border-ember hover:opacity-100"
                      >
                        <Image
                          src={imgUrl}
                          alt={`${loc.name} foto ${idx + 1}`}
                          fill
                          sizes="110px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  {loc.description && (
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {loc.description}
                    </p>
                  )}

                  {/* Differential Matrix: What makes this location unique */}
                  {loc.exclusive_features &&
                    loc.exclusive_features.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-ember/20 bg-ember/5 p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ember">
                          <Sparkles className="size-3.5" />
                          <span>
                            {isSingleLocation
                              ? "Atributos & Experiencia del Establecimiento"
                              : `Diferenciales Exclusivos de ${loc.name}`}
                          </span>
                        </p>
                        <ul className="grid grid-cols-1 gap-2 text-xs text-ink sm:grid-cols-2">
                          {loc.exclusive_features.map((feat) => (
                            <li key={feat} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ember" />
                              <span className="font-medium">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Event Salons hosted in this location */}
                  {spacesInLoc.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Salones para eventos en esta sede ({spacesInLoc.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {spacesInLoc.map((sp) => (
                          <Link
                            key={sp.id}
                            href={`/${restaurantSlug}/eventos`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ember hover:text-ember"
                          >
                            <Users className="size-3.5 text-ember" />
                            <span>{sp.name}</span>
                            <span className="font-mono text-[11px] text-ink-muted">
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
                      <div className="flex flex-col gap-1.5 text-xs text-ink-muted">
                        {hours.map((slot, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between"
                          >
                            <span className="font-medium text-ink">
                              {slot.days}
                            </span>
                            <span className="tabular-price font-mono">
                              {slot.hours}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-canvas/50 px-6 py-4 sm:px-8">
                <div className="flex flex-wrap items-center gap-2">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-ivory transition hover:bg-ember"
                    >
                      <MessageCircle className="size-3.5 text-ember-glow" />
                      <span>WhatsApp {loc.name}</span>
                    </a>
                  )}
                  {loc.contact_phone && (
                    <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-hairline bg-canvas-elevated px-3.5 py-2 text-xs font-mono text-ink-muted">
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
                      slideIndex: 0,
                    })
                  }
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-4 py-2 text-xs font-semibold text-ember transition hover:bg-ember hover:text-ivory"
                >
                  <Images className="size-3.5" />
                  <span>Conocer sede por dentro</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Interactive Establishment Dossier & Gallery Modal */}
      {selectedLocModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${selectedLocModal.loc.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedLocModal(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian-card text-ivory shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-obsidian-border px-6 py-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">
                  {selectedLocModal.loc.neighborhood ??
                    selectedLocModal.loc.city}
                </span>
                <h3 className="font-display text-2xl font-semibold text-ivory">
                  {selectedLocModal.loc.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocModal(null)}
                aria-label="Cerrar galería de la sede"
                className="flex size-10 items-center justify-center rounded-full bg-obsidian text-ivory hover:bg-ember"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedLocModal.gallery.length > 0 && (
                <div className="relative aspect-[16/9] w-full bg-obsidian">
                  <Image
                    src={
                      selectedLocModal.gallery[selectedLocModal.slideIndex] ??
                      selectedLocModal.gallery[0] ??
                      "/demo/casa-brasa/sede-parque-93.jpg"
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
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-obsidian/80 text-ivory hover:bg-ember"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        type="button"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-obsidian/80 text-ivory hover:bg-ember"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="p-6 space-y-5">
                <p className="text-sm leading-relaxed text-ivory-muted">
                  {selectedLocModal.loc.description}
                </p>

                {selectedLocModal.loc.exclusive_features?.length > 0 && (
                  <div>
                    <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gold">
                      ¿Qué hace única a esta sede?
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedLocModal.loc.exclusive_features.map((feat) => (
                        <div
                          key={feat}
                          className="flex items-center gap-2 rounded-xl border border-obsidian-border bg-obsidian px-3.5 py-2.5 text-xs text-ivory"
                        >
                          <CheckCircle2 className="size-4 shrink-0 text-ember-glow" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-obsidian-border pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/${restaurantSlug}/menu`}
                      onClick={() => setSelectedLocModal(null)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ivory hover:bg-ember-hover"
                    >
                      <UtensilsCrossed className="size-3.5" />
                      <span>Ver Carta de esta Sede</span>
                    </Link>
                    <Link
                      href={`/${restaurantSlug}/eventos`}
                      onClick={() => setSelectedLocModal(null)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian px-4 py-2 text-xs font-semibold text-ivory hover:border-gold"
                    >
                      <Sparkles className="size-3.5 text-gold" />
                      <span>Cotizar Salón en esta Sede</span>
                    </Link>
                  </div>

                  {selectedLocModal.loc.google_maps_url && (
                    <a
                      href={selectedLocModal.loc.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                    >
                      <span>Abrir ubicación en Google Maps</span>
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
