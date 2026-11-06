"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import {
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Building2,
  Clock,
  Info,
  ArrowRight,
  MapPin,
  Images,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency,
  buildWhatsAppUrl,
  sanitizeNumericInput,
  getBogotaTodayIso,
  getRestaurantRefPrefix,
  getAdaptiveThreeColumnGrid,
} from "@/lib/utils";
import {
  TIME_SLOT_VALUES,
  TIME_SLOT_LABELS,
} from "@/lib/validators/events";
import { submitEventInquiryAction } from "@/modules/events/actions";
import type {
  EventSpaceRow,
  EventPackageRow,
  LocationRow,
  PackageExtraItem,
} from "@/modules/tenant/queries";

interface EventInquiryComposerProps {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  currencyCode: string;
  whatsappPhone: string;
  privacyPolicyText: string;
  locations: LocationRow[];
  spaces: EventSpaceRow[];
  packages: EventPackageRow[];
  initialLocationSlug?: string;
  initialSpaceSlug?: string;
  initialPackageSlug?: string;
}

const CELEBRATION_PRESETS = [
  "Cumpleaños",
  "Cena Corporativa / Junta Directiva",
  "Aniversario / Pedida de Mano",
  "Grado / Celebración Familiar",
  "Despedida / Cierre de Año",
  "Otro / A medida",
] as const;

function getDefaultFutureDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function extractGalleryUrls(
  rawGallery: unknown,
  fallbackCover: string | null
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  if (fallbackCover && fallbackCover.trim().length > 0) {
    const cleanCover = fallbackCover.trim();
    seen.add(cleanCover);
    urls.push(cleanCover);
  }
  if (Array.isArray(rawGallery)) {
    for (const item of rawGallery) {
      if (typeof item === "string" && item.trim().length > 0) {
        const clean = item.trim();
        if (!seen.has(clean)) {
          seen.add(clean);
          urls.push(clean);
        }
      }
    }
  }
  return urls;
}

function extractPackageExtras(rawExtras: unknown): PackageExtraItem[] {
  if (!Array.isArray(rawExtras)) return [];
  const result: PackageExtraItem[] = [];
  for (const item of rawExtras) {
    if (
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      "price" in item &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).price === "string"
    ) {
      result.push({
        name: String((item as Record<string, unknown>).name),
        price: String((item as Record<string, unknown>).price),
      });
    }
  }
  return result;
}

function inferDefaultTimeSlotForPackage(
  pkg: EventPackageRow | undefined
): (typeof TIME_SLOT_VALUES)[number] {
  if (!pkg) return "dinner";
  const text = `${pkg.slug} ${pkg.name}`.toLowerCase();
  if (text.includes("brunch") || text.includes("desayuno") || text.includes("manana")) {
    return "breakfast";
  }
  return "dinner";
}

export function EventInquiryComposer({
  restaurantId,
  restaurantSlug,
  restaurantName,
  currencyCode,
  whatsappPhone,
  privacyPolicyText,
  locations,
  spaces,
  packages,
  initialLocationSlug,
  initialSpaceSlug,
  initialPackageSlug,
}: EventInquiryComposerProps) {
  const initialMatchedLocation = locations.find(
    (l) => l.slug === initialLocationSlug
  );
  const initialMatchedSpace = spaces.find((s) => s.slug === initialSpaceSlug);
  const initialMatchedPackage = packages.find(
    (p) => p.slug === initialPackageSlug
  );

  const defaultSpace =
    initialMatchedSpace ??
    (initialMatchedLocation
      ? spaces.find((s) => s.location_id === initialMatchedLocation.id)
      : undefined) ??
    spaces[0];

  const defaultLocationId =
    initialMatchedLocation?.id ??
    defaultSpace?.location_id ??
    locations[0]?.id ??
    "";

  const defaultPackage = initialMatchedPackage ?? packages[0];

  const [spaceLocationFilter, setSpaceLocationFilter] = useState<string>(
    initialMatchedLocation && locations.length > 1
      ? initialMatchedLocation.id
      : "all"
  );
  const [activeSlideBySpace, setActiveSlideBySpace] = useState<
    Record<string, number>
  >({});
  const [lightboxSpace, setLightboxSpace] = useState<{
    space: EventSpaceRow;
    images: string[];
    index: number;
  } | null>(null);

  const [selectedLocationId, setSelectedLocationId] =
    useState<string>(defaultLocationId);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    defaultSpace?.id ?? ""
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    defaultPackage?.id ?? ""
  );

  const [celebrationPreset, setCelebrationPreset] = useState<string>(
    defaultPackage?.event_category === "corporate"
      ? "Cena Corporativa / Junta Directiva"
      : "Cumpleaños"
  );
  const [customCelebrationText, setCustomCelebrationText] =
    useState<string>("");

  const minTentativeDate = useMemo(() => getBogotaTodayIso(), []);
  const [tentativeDate, setTentativeDate] = useState<string>(
    getDefaultFutureDateString()
  );
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<
    (typeof TIME_SLOT_VALUES)[number]
  >(() => inferDefaultTimeSlotForPackage(defaultPackage));
  const [guestCountInput, setGuestCountInput] = useState<string>(() =>
    String(Math.max(20, defaultSpace?.min_guests ?? 12))
  );
  const guestCount = guestCountInput === "" ? 0 : Number(guestCountInput);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
  const [websiteHoneypot, setWebsiteHoneypot] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRefCode, setSubmittedRefCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refPrefix = getRestaurantRefPrefix(restaurantSlug);

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationRow>();
    for (const loc of locations) {
      map.set(loc.id, loc);
    }
    return map;
  }, [locations]);

  const filteredSpaces = useMemo(() => {
    if (spaceLocationFilter === "all") return spaces;
    return spaces.filter(
      (sp) => !sp.location_id || sp.location_id === spaceLocationFilter
    );
  }, [spaces, spaceLocationFilter]);

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);
  const selectedSpaceLocation = selectedSpace?.location_id
    ? locationMap.get(selectedSpace.location_id)
    : null;

  const effectiveEventType =
    celebrationPreset === "Otro / A medida"
      ? customCelebrationText.trim() || "Celebración Especial a Medida"
      : celebrationPreset;

  const availablePackageExtras = useMemo<PackageExtraItem[]>(() => {
    if (!selectedPackage) return [];
    return extractPackageExtras(selectedPackage.optional_extras);
  }, [selectedPackage]);

  const extrasPerPersonDelta = useMemo(() => {
    let delta = 0;
    for (const ext of availablePackageExtras) {
      if (selectedExtras.includes(ext.name)) {
        if (ext.price.toLowerCase().includes("persona")) {
          const digits = ext.price.replace(/[^0-9]/g, "");
          if (digits) delta += Number(digits);
        }
      }
    }
    return delta;
  }, [availablePackageExtras, selectedExtras]);

  const estimatedTotal =
    selectedPackage?.pricing_model === "per_person" &&
    selectedPackage.base_price
      ? (Number(selectedPackage.base_price) + extrasPerPersonDelta) *
        Math.max(1, guestCount)
      : selectedPackage?.pricing_model === "fixed_package" &&
          selectedPackage.base_price
        ? Number(selectedPackage.base_price)
        : null;

  const maxAllowedInSelectedSpace = selectedSpace
    ? Math.max(
        selectedSpace.capacity_seated,
        selectedSpace.capacity_cocktail ?? selectedSpace.capacity_seated
      )
    : null;

  const exceedsSpaceSeated =
    selectedSpace && guestCount > selectedSpace.capacity_seated;

  function applySpaceSelection(space: EventSpaceRow, scrollToForm: boolean) {
    setSelectedSpaceId(space.id);
    if (space.location_id) {
      setSelectedLocationId(space.location_id);
    }
    if (guestCount < space.min_guests) {
      setGuestCountInput(String(space.min_guests));
    }
    if (scrollToForm) {
      const formEl = document.getElementById("solicitud-cotizacion-eventos");
      formEl?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function handleSelectPackage(pkg: EventPackageRow, scrollToForm = true) {
    setSelectedPackageId(pkg.id);
    setSelectedExtras([]);
    if (guestCount < pkg.min_guests) {
      setGuestCountInput(String(pkg.min_guests));
    }
    if (pkg.event_category === "birthday") {
      setCelebrationPreset("Cumpleaños");
    } else if (pkg.event_category === "corporate") {
      setCelebrationPreset("Cena Corporativa / Junta Directiva");
    } else if (pkg.event_category === "private_dining") {
      setCelebrationPreset("Aniversario / Pedida de Mano");
    }
    const suggestedSlot = inferDefaultTimeSlotForPackage(pkg);
    if (suggestedSlot === "breakfast") {
      setPreferredTimeSlot("breakfast");
    }
    if (scrollToForm) {
      const formEl = document.getElementById("solicitud-cotizacion-eventos");
      formEl?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function toggleExtra(extraName: string) {
    setSelectedExtras((prev) =>
      prev.includes(extraName)
        ? prev.filter((item) => item !== extraName)
        : [...prev, extraName]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (guestCount < 6 || guestCount > 500) {
      setFormError(
        "El número de invitados para eventos privados debe estar entre 6 y 500 personas."
      );
      return;
    }

    if (tentativeDate < minTentativeDate) {
      setFormError(
        "La fecha tentativa del evento no puede estar en el pasado."
      );
      return;
    }

    if (!privacyAccepted) {
      setFormError(
        "Por favor acepta la política de tratamiento de datos personales para enviar la solicitud."
      );
      return;
    }

    const enrichedSpecialRequests = [
      specialRequests.trim(),
      selectedExtras.length > 0
        ? `Adicionales de interés: ${selectedExtras.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    startTransition(async () => {
      const result = await submitEventInquiryAction({
        restaurantId,
        restaurantSlug,
        locationId: selectedLocationId || null,
        eventSpaceId: selectedSpaceId || null,
        eventPackageId: selectedPackageId || null,
        eventType: effectiveEventType,
        tentativeDate,
        preferredTimeSlot,
        guestCount,
        customerName,
        customerPhone,
        customerEmail,
        companyName,
        specialRequests: enrichedSpecialRequests,
        privacyAccepted: true,
        websiteHoneypot,
      });

      if (!result.ok) {
        const message =
          result.error ?? "Revisa los datos ingresados e intenta de nuevo.";
        setFormError(message);
        toast.error(message);
        return;
      }

      setSubmittedRefCode(result.referenceCode ?? `${refPrefix}-RECIBIDO`);
      toast.success(
        `Solicitud registrada con código ${result.referenceCode}`
      );
    });
  }

  const whatsappSummaryUrl =
    submittedRefCode && whatsappPhone
      ? buildWhatsAppUrl(
          whatsappPhone,
          `Hola equipo de ${restaurantName}, acabo de registrar la solicitud de evento *${submittedRefCode}*:\n` +
            `• Celebración: ${effectiveEventType}\n` +
            `• Fecha tentativa: ${tentativeDate} (${TIME_SLOT_LABELS[preferredTimeSlot]})\n` +
            `• Invitados estimados: ${guestCount} personas\n` +
            `• Salón: ${selectedSpace?.name ?? "Por definir"}${
              selectedSpaceLocation && locations.length > 1
                ? ` (${selectedSpaceLocation.name})`
                : ""
            }\n` +
            `• Paquete: ${selectedPackage?.name ?? "Cotización a medida"}\n` +
            (selectedExtras.length > 0
              ? `• Extras seleccionados: ${selectedExtras.join(", ")}\n`
              : "") +
            (estimatedTotal !== null
              ? `• Estimado referencial: ${formatCurrency(
                  estimatedTotal,
                  currencyCode
                )}\n`
              : "") +
            `• Contacto: ${customerName} (${customerPhone})`
        )
      : null;

  const isSingleSpaceView = filteredSpaces.length === 1;
  const isSinglePackageView = packages.length === 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Section 1: Private Event Spaces Architectural Dossier with Adaptive Grid */}
      {spaces.length > 0 && (
        <section className="mb-16">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">
                {spaces.length === 1
                  ? "El Espacio para tu Celebración"
                  : "Arquitectura & Hospitalidad Privada"}
              </span>
              <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
                {spaces.length === 1
                  ? "Nuestro Salón Principal para Eventos y Grupos"
                  : "Nuestros Salones & Espacios Exclusivos"}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              {locations.length > 1
                ? "Explora la galería de cada salón, revisa en qué sede se encuentra y compara sus capacidades en montaje sentado o cóctel."
                : "Recorre la galería fotográfica de cada ambiente dentro de nuestra casa y compara sus capacidades en montaje sentado o cóctel."}
            </p>
          </div>

          {/* Multi-Location Filter (Hidden automatically on single-location restaurants) */}
          {locations.length > 1 && spaces.length > 1 && (
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas-elevated px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <MapPin className="size-4 text-ember" />
                <span>Filtrar salones por sede del restaurante:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpaceLocationFilter("all")}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    spaceLocationFilter === "all"
                      ? "bg-ink text-ivory"
                      : "bg-canvas-muted text-ink-muted hover:text-ink"
                  }`}
                >
                  Todas las sedes ({spaces.length} salones)
                </button>
                {locations.map((loc) => {
                  const countInLoc = spaces.filter(
                    (s) => s.location_id === loc.id
                  ).length;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSpaceLocationFilter(loc.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        spaceLocationFilter === loc.id
                          ? "bg-ember text-ivory"
                          : "bg-canvas-muted text-ink-muted hover:text-ink"
                      }`}
                    >
                      {loc.name} ({countInLoc})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={
              isSingleSpaceView
                ? "grid grid-cols-1 gap-6"
                : `grid gap-6 ${getAdaptiveThreeColumnGrid(
                    filteredSpaces.length
                  )}`
            }
          >
            {filteredSpaces.map((space, spaceIdx) => {
              const isSelected = selectedSpaceId === space.id;
              const spaceLoc = space.location_id
                ? locationMap.get(space.location_id)
                : null;
              const gallery = extractGalleryUrls(
                space.gallery_urls,
                space.cover_image_url
              );
              const currentSlideIdx =
                (activeSlideBySpace[space.id] ?? 0) %
                Math.max(1, gallery.length);
              const activeImageSrc =
                gallery[currentSlideIdx] ?? space.cover_image_url;

              return (
                <article
                  key={space.id}
                  onClick={() => applySpaceSelection(space, false)}
                  className={`group overflow-hidden rounded-3xl border bg-canvas-elevated transition cursor-pointer ${
                    isSingleSpaceView
                      ? "grid grid-cols-1 lg:grid-cols-12"
                      : "flex flex-col"
                  } ${
                    isSelected
                      ? "border-ember shadow-md ring-2 ring-ember/25"
                      : "border-hairline hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  {/* Visual Column */}
                  <div
                    className={
                      isSingleSpaceView ? "lg:col-span-7 flex flex-col" : ""
                    }
                  >
                    {activeImageSrc && (
                      <div
                        className={`relative w-full overflow-hidden bg-canvas-muted ${
                          isSingleSpaceView
                            ? "aspect-[16/10] lg:flex-1 lg:min-h-[340px]"
                            : "aspect-[16/10]"
                        }`}
                      >
                        <Image
                          src={activeImageSrc}
                          alt={`${space.name} — Vista ${currentSlideIdx + 1}`}
                          fill
                          priority={spaceIdx < 2}
                          sizes={
                            isSingleSpaceView
                              ? "(max-width: 1024px) 100vw, 60vw"
                              : filteredSpaces.length === 2
                                ? "(max-width: 768px) 100vw, 50vw"
                                : "(max-width: 1024px) 100vw, 33vw"
                          }
                          className="object-cover transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-transparent to-obsidian/30" />

                        <div className="absolute top-3 right-3.5 left-3.5 flex items-center justify-between gap-2">
                          {spaceLoc && locations.length > 1 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 text-xs font-medium text-gold">
                              <MapPin className="size-3.5 text-ember-glow" />
                              <span>{spaceLoc.name}</span>
                            </span>
                          ) : (
                            <span />
                          )}

                          {gallery.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSpace({
                                  space,
                                  images: gallery,
                                  index: currentSlideIdx,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-obsidian-border bg-obsidian/90 px-3 py-1 text-xs font-semibold text-ivory transition hover:bg-ember"
                            >
                              <Images className="size-3.5 text-gold" />
                              <span>
                                Galería ({currentSlideIdx + 1}/{gallery.length})
                              </span>
                            </button>
                          )}
                        </div>

                        {gallery.length > 1 && (
                          <>
                            <button
                              type="button"
                              aria-label="Foto anterior del salón"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlideBySpace((prev) => ({
                                  ...prev,
                                  [space.id]:
                                    (currentSlideIdx - 1 + gallery.length) %
                                    gallery.length,
                                }));
                              }}
                              className="absolute top-1/2 left-3 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-obsidian"
                            >
                              <ChevronLeft className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Siguiente foto del salón"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlideBySpace((prev) => ({
                                  ...prev,
                                  [space.id]:
                                    (currentSlideIdx + 1) % gallery.length,
                                }));
                              }}
                              className="absolute top-1/2 right-3 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-obsidian"
                            >
                              <ChevronRight className="size-4" />
                            </button>
                          </>
                        )}

                        <div className="absolute right-3.5 bottom-3 left-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ivory">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/90 px-3 py-1 font-mono font-semibold">
                            <Users className="size-3.5 text-gold" />
                            <span>
                              {space.min_guests} – {space.capacity_seated} sentados
                            </span>
                          </span>
                          {space.capacity_cocktail && (
                            <span className="tabular-price rounded-full bg-obsidian/80 px-2.5 py-1 font-mono text-xs text-ivory">
                              Hasta {space.capacity_cocktail} cóctel
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {gallery.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 border-t border-b border-hairline bg-canvas px-4 py-2.5 lg:border-b-0">
                        {gallery.slice(0, 4).map((imgUrl, idx) => (
                          <button
                            key={imgUrl + idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSlideBySpace((prev) => ({
                                ...prev,
                                [space.id]: idx,
                              }));
                            }}
                            className={`relative aspect-[16/10] overflow-hidden rounded-lg border bg-canvas-muted transition ${
                              currentSlideIdx === idx
                                ? "border-ember ring-2 ring-ember/40"
                                : "border-hairline opacity-75 hover:opacity-100"
                            }`}
                          >
                            <Image
                              src={imgUrl}
                              alt={`${space.name} vista ${idx + 1}`}
                              fill
                              sizes="120px"
                              className="object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content Column */}
                  <div
                    className={`flex flex-1 flex-col justify-between p-6 sm:p-7 ${
                      isSingleSpaceView
                        ? "lg:col-span-5 lg:border-l lg:border-hairline"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {space.ambiance_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-hairline bg-canvas-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                        {space.name}
                      </h3>
                      {space.subtitle && (
                        <p className="mt-1 text-sm font-medium text-ember">
                          {space.subtitle}
                        </p>
                      )}
                      <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                        {space.description}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-hairline pt-4">
                      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Equipamiento incluido sin costo adicional
                      </p>
                      <ul className="grid grid-cols-1 gap-2 text-sm text-ink sm:grid-cols-2">
                        {space.equipment_features.slice(0, 4).map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applySpaceSelection(space, true);
                        }}
                        className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                          isSelected
                            ? "bg-ember text-ivory shadow-xs hover:bg-ember-hover"
                            : "border border-border-strong bg-canvas text-ink hover:border-ember hover:bg-ember hover:text-ivory"
                        }`}
                      >
                        <span>
                          {isSelected
                            ? "Salón seleccionado · Ir a cotizar"
                            : "Cotizar este salón"}
                        </span>
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Commercial Event Packages (Light-First Editorial Cards + Adaptive Grid) */}
      {packages.length > 0 && (
        <section className="mb-16">
          <div className="mb-8 flex flex-col justify-between gap-3 border-b border-hairline pb-5 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">
                Propuestas Gastronómicas con Referencia Visual
              </span>
              <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
                Paquetes Comerciales & Experiencias
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Menús diseñados para grupos con valores claros por persona. Al
              elegir una experiencia, tu celebración y presupuesto se calculan
              automáticamente abajo.
            </p>
          </div>

          <div
            className={
              isSinglePackageView
                ? "grid grid-cols-1 gap-6"
                : `grid gap-6 ${getAdaptiveThreeColumnGrid(packages.length)}`
            }
          >
            {packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              const includesList = Array.isArray(pkg.includes_items)
                ? pkg.includes_items.filter(
                    (item): item is string => typeof item === "string"
                  )
                : [];
              const extrasList = extractPackageExtras(pkg.optional_extras);

              return (
                <article
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg, false)}
                  className={`group flex flex-col justify-between overflow-hidden rounded-3xl border transition cursor-pointer ${
                    isSinglePackageView
                      ? "lg:grid lg:grid-cols-12"
                      : ""
                  } ${
                    pkg.is_featured
                      ? isSelected
                        ? "border-ember bg-surface-accent text-ink shadow-lg ring-2 ring-ember/30"
                        : "border-ember/40 bg-surface-accent/75 text-ink shadow-sm hover:border-ember"
                      : isSelected
                        ? "border-ember bg-canvas-elevated text-ink shadow-md ring-2 ring-ember/25"
                        : "border-hairline bg-canvas-elevated text-ink hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  <div
                    className={
                      isSinglePackageView ? "lg:col-span-12" : "flex-1"
                    }
                  >
                    {pkg.cover_image_url && (
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-canvas-muted">
                        <Image
                          src={pkg.cover_image_url}
                          alt={pkg.name}
                          fill
                          sizes={
                            packages.length === 2
                              ? "(max-width: 768px) 100vw, 50vw"
                              : "(max-width: 1024px) 100vw, 33vw"
                          }
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-obsidian/20 to-transparent" />
                        <div className="absolute top-3 right-3.5 left-3.5 flex flex-wrap items-center justify-between gap-1.5">
                          {pkg.badge_label && (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold shadow-2xs ${
                                pkg.is_featured
                                  ? "bg-ember text-ivory"
                                  : "bg-canvas-elevated/95 text-ink"
                              }`}
                            >
                              {pkg.badge_label}
                            </span>
                          )}
                          <span className="tabular-price shrink-0 rounded-full bg-obsidian/90 px-3 py-1 font-mono text-xs font-medium text-ivory">
                            {pkg.min_guests}–{pkg.max_guests ?? 95} inv.
                          </span>
                        </div>
                        {pkg.duration_hours && (
                          <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 text-xs font-medium text-ivory">
                            <Clock className="size-3.5 text-gold" />
                            <span>
                              Duración incluida: {Number(pkg.duration_hours)}{" "}
                              horas
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-6 sm:p-7">
                      {!pkg.cover_image_url && pkg.badge_label && (
                        <span className="mb-3 inline-block rounded-full bg-ember px-3 py-1 text-xs font-semibold text-ivory">
                          {pkg.badge_label}
                        </span>
                      )}

                      <h3 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                        {pkg.name}
                      </h3>

                      {pkg.tagline && (
                        <p className="mt-1 text-sm font-medium text-ember">
                          {pkg.tagline}
                        </p>
                      )}

                      <div className="mt-3.5 border-b border-hairline pb-4">
                        {pkg.pricing_model === "per_person" &&
                        pkg.base_price ? (
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="tabular-price font-mono text-2xl font-bold text-ember">
                              {formatCurrency(
                                Number(pkg.base_price),
                                currencyCode
                              )}
                            </span>
                            <span className="text-xs font-medium text-ink-muted">
                              / por invitado (IVA incluido)
                            </span>
                          </div>
                        ) : pkg.pricing_model === "fixed_package" &&
                          pkg.base_price ? (
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="tabular-price font-mono text-2xl font-bold text-ember">
                              {formatCurrency(
                                Number(pkg.base_price),
                                currencyCode
                              )}
                            </span>
                            <span className="text-xs font-medium text-ink-muted">
                              / valor paquete completo
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block rounded-lg bg-canvas px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-accent-ink border border-hairline">
                            Cotización Personalizada a Medida
                          </span>
                        )}
                      </div>

                      {pkg.description && (
                        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                          {pkg.description}
                        </p>
                      )}

                      {includesList.length > 0 && (
                        <div className="mt-5">
                          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink">
                            ¿Qué incluye la experiencia?
                          </p>
                          <ul className="space-y-2 text-sm text-ink">
                            {includesList.map((item) => (
                              <li
                                key={item}
                                className="flex items-start gap-2.5 leading-snug"
                              >
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ember" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {extrasList.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-hairline bg-canvas/80 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-ink">
                            Adicionales opcionales
                          </p>
                          <ul className="space-y-1.5 text-xs text-ink">
                            {extrasList.map((ext) => (
                              <li
                                key={ext.name}
                                className="flex items-baseline justify-between gap-2"
                              >
                                <span className="text-ink-muted">
                                  + {ext.name}
                                </span>
                                <span className="tabular-price shrink-0 font-mono text-xs font-semibold text-ink">
                                  {ext.price}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {pkg.conditions_text && (
                        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
                          {pkg.conditions_text}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-6 pt-0 sm:px-7 sm:pb-7">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPackage(pkg, true);
                      }}
                      className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                        isSelected
                          ? "bg-ember text-ivory shadow-xs hover:bg-ember-hover"
                          : "bg-ink text-ivory hover:bg-ember"
                      }`}
                    >
                      <span>
                        {isSelected
                          ? "Experiencia seleccionada · Cotizar abajo"
                          : "Elegir esta experiencia"}
                      </span>
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 3: Light-First Transactional Inquiry Form + Instant WhatsApp Bridge */}
      <section
        id="solicitud-cotizacion-eventos"
        className="scroll-mt-36 lg:scroll-mt-28 rounded-3xl border border-hairline bg-canvas-elevated p-6 text-ink shadow-xl sm:p-10"
      >
        {submittedRefCode ? (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-sage/30 bg-sage/12 text-sage">
              <CheckCircle2 className="size-7" />
            </div>

            <span className="inline-block rounded-full border border-ember/30 bg-surface-accent px-4 py-1 font-mono text-xs font-semibold text-ember">
              CÓDIGO DE SOLICITUD: {submittedRefCode}
            </span>

            <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
              Hemos registrado tu solicitud de cotización
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Importante:{" "}
              <strong className="font-semibold text-ink">
                Esta solicitud no equivale a una reserva bloqueada
                automáticamente.
              </strong>{" "}
              Nuestro equipo de eventos ya recibió los detalles en el panel de{" "}
              {restaurantName} y verificará la disponibilidad del salón para el{" "}
              <span className="font-mono font-semibold text-ink">
                {tentativeDate}
              </span>{" "}
              ({guestCount} invitados).
            </p>

            <div className="mt-6 rounded-2xl border border-hairline bg-canvas p-5 text-left text-sm text-ink-muted">
              <p className="font-semibold text-ink">
                Resumen registrado en nuestro sistema:
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>
                  • Referencia:{" "}
                  <span className="font-mono font-semibold text-ember">
                    {submittedRefCode}
                  </span>
                </p>
                <p>• Celebración: {effectiveEventType}</p>
                <p>• Fecha tentativa: {tentativeDate}</p>
                <p>• Aforo estimado: {guestCount} invitados</p>
                <p>• Espacio: {selectedSpace?.name ?? "Por definir"}</p>
                <p>• Experiencia: {selectedPackage?.name ?? "A medida"}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {whatsappSummaryUrl && (
                <a
                  href={whatsappSummaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-7 py-3 text-sm font-semibold text-ivory shadow-md transition hover:bg-ember-hover sm:w-auto"
                >
                  <MessageCircle className="size-4" />
                  <span>
                    Agilizar por WhatsApp con mi código {submittedRefCode}
                  </span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setSubmittedRefCode(null)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border-strong bg-canvas px-6 py-3 text-sm font-semibold text-ink transition hover:border-ember hover:text-ember"
              >
                Enviar otra consulta
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/25 bg-surface-accent px-3.5 py-1 text-xs font-semibold text-ember">
                <Sparkles className="size-3.5" />
                <span>Atención Directa de Hospitalidad</span>
              </span>

              <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                Solicita una Propuesta & Disponibilidad de Fecha
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Selecciona tu tipo de celebración, salón y experiencia. Tu
                solicitud queda registrada con un código único (
                <code className="rounded bg-canvas-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
                  {refPrefix}-YYMM-XXXX
                </code>
                ) para seguimiento prioritario con nuestro equipo.
              </p>

              <div className="mt-6 space-y-3.5 rounded-2xl border border-hairline bg-canvas p-5 text-xs leading-relaxed text-ink-muted">
                <div className="flex items-start gap-2.5">
                  <Info className="mt-0.5 size-4 shrink-0 text-ember" />
                  <p>
                    <strong className="font-semibold text-ink">
                      Transparencia en disponibilidad:
                    </strong>{" "}
                    Enviar este formulario registra una solicitud de cotización;
                    la fecha del salón queda reservada una vez confirmada la
                    disponibilidad y abonado el anticipo acordado.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sage" />
                  <p>
                    <strong className="font-semibold text-ink">
                      Privacidad garantizada (Ley 1581 de 2012):
                    </strong>{" "}
                    Tus datos son recibidos únicamente por la coordinación de
                    eventos de {restaurantName}.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 lg:col-span-7"
              noValidate
            >
              {/* Hidden Honeypot */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="websiteHoneypot">No llenar este campo</label>
                <input
                  id="websiteHoneypot"
                  name="websiteHoneypot"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={websiteHoneypot}
                  onChange={(e) => setWebsiteHoneypot(e.target.value)}
                />
              </div>

              {/* Celebration Type Chips */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink">
                  ¿Qué tipo de celebración o evento estás planeando?{" "}
                  <span className="text-ember">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CELEBRATION_PRESETS.map((preset) => {
                    const active = celebrationPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCelebrationPreset(preset)}
                        className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-ember bg-ember text-ivory shadow-2xs"
                            : "border-border-strong bg-canvas text-ink hover:border-ember hover:text-ember"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                <div
                  className={
                    celebrationPreset === "Otro / A medida"
                      ? "mt-2.5"
                      : "sr-only"
                  }
                >
                  <input
                    id="eventType"
                    type="text"
                    value={
                      celebrationPreset === "Otro / A medida"
                        ? customCelebrationText
                        : celebrationPreset
                    }
                    onChange={(e) => {
                      setCelebrationPreset("Otro / A medida");
                      setCustomCelebrationText(e.target.value);
                    }}
                    placeholder="Describe tu celebración (ej. Bautizo, Brunch de cumpleaños, Lanzamiento...)"
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="guestCount"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Invitados estimados <span className="text-ember">*</span>
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-border-strong bg-canvas px-2 focus-within:border-ember">
                    <button
                      type="button"
                      aria-label="Disminuir invitados"
                      onClick={() =>
                        setGuestCountInput(
                          String(Math.max(6, (guestCount || 6) - 1))
                        )
                      }
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold text-ink-muted transition hover:bg-canvas-muted hover:text-ink"
                    >
                      −
                    </button>
                    <input
                      id="guestCount"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      placeholder="20"
                      value={guestCountInput}
                      onChange={(e) =>
                        setGuestCountInput(
                          sanitizeNumericInput(e.target.value, 3)
                        )
                      }
                      onBlur={() => {
                        if (!guestCountInput || Number(guestCountInput) < 6) {
                          setGuestCountInput("6");
                        } else if (Number(guestCountInput) > 500) {
                          setGuestCountInput("500");
                        }
                      }}
                      className="tabular-price h-full w-full bg-transparent px-2 text-center font-mono text-base font-semibold text-ink placeholder:text-ink-subtle focus:outline-none sm:text-sm"
                    />
                    <button
                      type="button"
                      aria-label="Aumentar invitados"
                      onClick={() =>
                        setGuestCountInput(
                          String(Math.min(500, (guestCount || 6) + 1))
                        )
                      }
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold text-ink-muted transition hover:bg-canvas-muted hover:text-ink"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="tentativeDate"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"
                  >
                    <Calendar className="size-4 text-ember" />
                    <span>
                      Fecha tentativa <span className="text-ember">*</span>
                    </span>
                  </label>
                  <input
                    id="tentativeDate"
                    type="date"
                    min={minTentativeDate}
                    required
                    value={tentativeDate}
                    onChange={(e) => setTentativeDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 font-mono text-base text-ink focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="preferredTimeSlot"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"
                  >
                    <Clock className="size-4 text-ember" />
                    <span>
                      Franja horaria <span className="text-ember">*</span>
                    </span>
                  </label>
                  <select
                    id="preferredTimeSlot"
                    value={preferredTimeSlot}
                    onChange={(e) =>
                      setPreferredTimeSlot(
                        e.target.value as (typeof TIME_SLOT_VALUES)[number]
                      )
                    }
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-sm"
                  >
                    {TIME_SLOT_VALUES.map((slot) => (
                      <option key={slot} value={slot}>
                        {TIME_SLOT_LABELS[slot]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  locations.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`}
              >
                {locations.length > 1 && (
                  <div>
                    <label
                      htmlFor="locationSelect"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Sede preferida
                    </label>
                    <select
                      id="locationSelect"
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-sm"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="spaceSelect"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Salón de interés
                  </label>
                  <select
                    id="spaceSelect"
                    value={selectedSpaceId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedSpaceId(nextId);
                      const found = spaces.find((s) => s.id === nextId);
                      if (found?.location_id) {
                        setSelectedLocationId(found.location_id);
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-sm"
                  >
                    {spaces.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="packageSelect"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Experiencia gastronómica
                  </label>
                  <select
                    id="packageSelect"
                    value={selectedPackageId}
                    onChange={(e) => {
                      const nextPkg = packages.find(
                        (p) => p.id === e.target.value
                      );
                      setSelectedPackageId(e.target.value);
                      setSelectedExtras([]);
                      if (nextPkg) {
                        const suggested =
                          inferDefaultTimeSlotForPackage(nextPkg);
                        if (suggested === "breakfast") {
                          setPreferredTimeSlot("breakfast");
                        }
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3 text-base text-ink focus:border-ember focus:outline-none sm:text-sm"
                  >
                    {packages.map((pk) => (
                      <option key={pk.id} value={pk.id}>
                        {pk.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customerName"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Tu nombre completo <span className="text-ember">*</span>
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre y apellido"
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customerPhone"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    WhatsApp / Teléfono móvil{" "}
                    <span className="text-ember">*</span>
                  </label>
                  <input
                    id="customerPhone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+57 310 000 0000"
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 font-mono text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customerEmail"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Correo electrónico{" "}
                    <span className="font-normal text-ink-muted">
                      (opcional)
                    </span>
                  </label>
                  <input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nombre@correo.com"
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="companyName"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"
                  >
                    <Building2 className="size-4 text-ember" />
                    <span>
                      Empresa{" "}
                      <span className="font-normal text-ink-muted">
                        (si es corporativo)
                      </span>
                    </span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nombre de la organización"
                    className="h-11 w-full rounded-xl border border-border-strong bg-canvas px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="specialRequests"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Requerimientos especiales{" "}
                  <span className="font-normal text-ink-muted">
                    (alergias, montaje, audio/video)
                  </span>
                </label>
                <textarea
                  id="specialRequests"
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Cuéntanos si requieres pantalla, menú vegetariano, torta de celebración o facturación electrónica empresarial..."
                  className="w-full rounded-xl border border-border-strong bg-canvas p-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none sm:text-sm"
                />
              </div>

              {/* Live Referential Budget & Optional Extras Estimator */}
              <div className="rounded-2xl border border-ember/30 bg-surface-accent/65 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-ember">
                      Estimado referencial en vivo ({guestCount} invitados)
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {effectiveEventType} ·{" "}
                      {selectedPackage?.name ?? "Cotización personalizada"}
                    </span>
                  </div>
                  <div className="text-right">
                    {estimatedTotal !== null ? (
                      <span className="tabular-price font-mono text-2xl font-bold text-ink">
                        {formatCurrency(estimatedTotal, currencyCode)}
                      </span>
                    ) : (
                      <span className="inline-block rounded-full border border-hairline bg-canvas px-3 py-1 font-mono text-xs font-semibold text-accent-ink">
                        Propuesta a medida del Chef
                      </span>
                    )}
                    {selectedPackage?.pricing_model === "per_person" &&
                      selectedPackage.base_price && (
                        <span className="tabular-price block font-mono text-xs text-ink-muted">
                          {formatCurrency(
                            Number(selectedPackage.base_price) +
                              extrasPerPersonDelta,
                            currencyCode
                          )}{" "}
                          / invitado
                        </span>
                      )}
                  </div>
                </div>

                {availablePackageExtras.length > 0 && (
                  <div className="mt-3.5 border-t border-hairline pt-3.5">
                    <span className="mb-2 block text-xs font-semibold text-ink">
                      Personaliza tu estimado agregando experiencias opcionales:
                    </span>
                    <div className="flex flex-col gap-2">
                      {availablePackageExtras.map((ext) => {
                        const checked = selectedExtras.includes(ext.name);
                        return (
                          <button
                            key={ext.name}
                            type="button"
                            onClick={() => toggleExtra(ext.name)}
                            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                              checked
                                ? "border-ember bg-canvas text-ink font-semibold shadow-2xs"
                                : "border-hairline bg-canvas/80 text-ink-muted hover:border-border-strong hover:text-ink"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                className="size-4 accent-ember pointer-events-none"
                              />
                              <span>{ext.name}</span>
                            </span>
                            <span className="tabular-price font-mono font-semibold text-ember">
                              {ext.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exceedsSpaceSeated && selectedSpace && (
                  <p className="mt-3 border-t border-hairline pt-2.5 text-xs font-medium text-amber-warn">
                    Nota de aforo: <strong>{selectedSpace.name}</strong> cuenta
                    con capacidad para{" "}
                    <strong>
                      {selectedSpace.capacity_seated} personas sentadas
                    </strong>
                    {maxAllowedInSelectedSpace &&
                    maxAllowedInSelectedSpace > selectedSpace.capacity_seated
                      ? ` (hasta ${maxAllowedInSelectedSpace} en formato cóctel)`
                      : ""}
                    . Nuestro equipo te sugerirá el montaje o combinación ideal.
                  </p>
                )}
              </div>

              {/* Mandatory Habeas Data Checkbox */}
              <label
                htmlFor="privacyAccepted"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline bg-canvas p-3.5 text-xs leading-relaxed text-ink-muted"
              >
                <input
                  id="privacyAccepted"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-ember"
                />
                <span>{privacyPolicyText}</span>
              </label>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-xs font-semibold text-crimson"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-semibold text-ivory shadow-md transition hover:bg-ember-hover disabled:opacity-60"
              >
                {isPending
                  ? "Registrando solicitud de forma segura..."
                  : "Registrar Solicitud de Cotización"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Light-First Lightbox Modal for Multi-Image Salon Gallery */}
      {lightboxSpace && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${lightboxSpace.space.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4 backdrop-blur-xs"
          onClick={() => setLightboxSpace(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-hairline bg-canvas-elevated text-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink">
                  {lightboxSpace.space.name}
                </h3>
                <p className="text-xs text-ink-muted">
                  Fotografía {lightboxSpace.index + 1} de{" "}
                  {lightboxSpace.images.length} · Capacidad{" "}
                  {lightboxSpace.space.min_guests} a{" "}
                  {lightboxSpace.space.capacity_seated} sentados
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar galería"
                onClick={() => setLightboxSpace(null)}
                className="flex size-10 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition hover:bg-ember hover:text-ivory"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative aspect-[16/10] w-full bg-canvas-muted">
              {Boolean(
                lightboxSpace.images[lightboxSpace.index] ??
                  lightboxSpace.images[0]
              ) && (
                <Image
                  src={
                    lightboxSpace.images[lightboxSpace.index] ??
                    lightboxSpace.images[0] ??
                    ""
                  }
                  alt={lightboxSpace.space.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                />
              )}
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={() =>
                  setLightboxSpace((prev) =>
                    prev
                      ? {
                          ...prev,
                          index:
                            (prev.index - 1 + prev.images.length) %
                            prev.images.length,
                        }
                      : null
                  )
                }
                className="absolute top-1/2 left-4 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-ember"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Siguiente foto"
                onClick={() =>
                  setLightboxSpace((prev) =>
                    prev
                      ? {
                          ...prev,
                          index: (prev.index + 1) % prev.images.length,
                        }
                      : null
                  )
                }
                className="absolute top-1/2 right-4 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-obsidian/80 text-ivory transition hover:bg-ember"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div className="flex gap-2 overflow-x-auto">
                {lightboxSpace.images.map((imgUrl, idx) => (
                  <button
                    key={imgUrl + idx}
                    type="button"
                    onClick={() =>
                      setLightboxSpace((prev) =>
                        prev ? { ...prev, index: idx } : null
                      )
                    }
                    className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border bg-canvas-muted ${
                      lightboxSpace.index === idx
                        ? "border-ember ring-2 ring-ember/40"
                        : "border-hairline opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={imgUrl}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const sp = lightboxSpace.space;
                  setLightboxSpace(null);
                  applySpaceSelection(sp, true);
                }}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-ivory shadow-xs hover:bg-ember-hover"
              >
                <span>Cotizar este salón</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
