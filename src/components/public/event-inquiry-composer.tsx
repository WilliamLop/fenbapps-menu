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
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
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
  const urls: string[] = [];
  if (Array.isArray(rawGallery)) {
    for (const item of rawGallery) {
      if (typeof item === "string" && item.trim().length > 0) {
        urls.push(item);
      }
    }
  }
  if (urls.length === 0 && fallbackCover) {
    urls.push(fallbackCover);
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
}: EventInquiryComposerProps) {
  const [spaceLocationFilter, setSpaceLocationFilter] = useState<string>("all");
  const [activeSlideBySpace, setActiveSlideBySpace] = useState<
    Record<string, number>
  >({});
  const [lightboxSpace, setLightboxSpace] = useState<{
    space: EventSpaceRow;
    images: string[];
    index: number;
  } | null>(null);

  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations[0]?.id ?? ""
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    spaces[0]?.id ?? ""
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    packages[0]?.id ?? ""
  );

  // Pillar 1: Quick-select celebration preset + custom text when "Otro / A medida" is chosen
  const [celebrationPreset, setCelebrationPreset] = useState<string>(
    "Cumpleaños"
  );
  const [customCelebrationText, setCustomCelebrationText] =
    useState<string>("");

  const [tentativeDate, setTentativeDate] = useState<string>(
    getDefaultFutureDateString()
  );
  const [preferredTimeSlot, setPreferredTimeSlot] =
    useState<(typeof TIME_SLOT_VALUES)[number]>("dinner");
  const [guestCount, setGuestCount] = useState<number>(20);
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

  // Parse package optional extras and numeric value if per_person
  const availablePackageExtras = useMemo<PackageExtraItem[]>(() => {
    if (!selectedPackage) return [];
    return extractPackageExtras(selectedPackage.optional_extras);
  }, [selectedPackage]);

  const extrasPerPersonDelta = useMemo(() => {
    let delta = 0;
    for (const ext of availablePackageExtras) {
      if (selectedExtras.includes(ext.name)) {
        // Extract numeric digits if string contains "/ persona"
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

  function handleSelectSpace(space: EventSpaceRow) {
    setSelectedSpaceId(space.id);
    if (space.location_id) {
      setSelectedLocationId(space.location_id);
    }
    if (guestCount < space.min_guests) {
      setGuestCount(space.min_guests);
    }
    const formEl = document.getElementById("solicitud-cotizacion-eventos");
    formEl?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSelectPackage(pkg: EventPackageRow) {
    setSelectedPackageId(pkg.id);
    setSelectedExtras([]);
    if (guestCount < pkg.min_guests) {
      setGuestCount(pkg.min_guests);
    }
    // Pillar 1: Auto-sync celebration type preset with chosen package!
    if (pkg.event_category === "birthday") {
      setCelebrationPreset("Cumpleaños");
    } else if (pkg.event_category === "corporate") {
      setCelebrationPreset("Cena Corporativa / Junta Directiva");
    } else if (pkg.event_category === "private_dining") {
      setCelebrationPreset("Aniversario / Pedida de Mano");
    }
    const formEl = document.getElementById("solicitud-cotizacion-eventos");
    formEl?.scrollIntoView({ behavior: "smooth" });
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

      setSubmittedRefCode(result.referenceCode ?? "CB-RECIBIDO");
      toast.success(
        `Solicitud registrada con código ${result.referenceCode}`
      );
    });
  }

  const whatsappSummaryUrl = submittedRefCode
    ? buildWhatsAppUrl(
        whatsappPhone,
        `Hola equipo de ${restaurantName}, acabo de registrar la solicitud de evento *${submittedRefCode}*:\n` +
          `• Celebración: ${effectiveEventType}\n` +
          `• Fecha tentativa: ${tentativeDate} (${TIME_SLOT_LABELS[preferredTimeSlot]})\n` +
          `• Invitados estimados: ${guestCount} personas\n` +
          `• Sede y Salón: ${selectedSpace?.name ?? "Por definir"}${
            selectedSpaceLocation ? ` (${selectedSpaceLocation.name})` : ""
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
    : "#";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Section 1: Private Event Spaces Architectural Dossier with Multi-Image Galleries */}
      <section className="mb-16">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
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
          <p className="max-w-md text-sm text-ink-muted">
            Explora la galería fotográfica de cada espacio, verifica en qué sede se encuentra y compara sus capacidades en montaje sentado o cóctel.
          </p>
        </div>

        {/* Location Filter for Multi-Location Restaurants (Hidden automatically if restaurant has 1 location) */}
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
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  spaceLocationFilter === "all"
                    ? "bg-obsidian text-ivory"
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
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {filteredSpaces.map((space) => {
            const isSelected = selectedSpaceId === space.id;
            const spaceLoc = space.location_id
              ? locationMap.get(space.location_id)
              : null;
            const gallery = extractGalleryUrls(
              space.gallery_urls,
              space.cover_image_url
            );
            const currentSlideIdx =
              (activeSlideBySpace[space.id] ?? 0) % Math.max(1, gallery.length);
            const activeImageSrc =
              gallery[currentSlideIdx] ?? space.cover_image_url;

            return (
              <article
                key={space.id}
                onClick={() => setSelectedSpaceId(space.id)}
                className={`group flex flex-col overflow-hidden rounded-3xl border transition cursor-pointer ${
                  isSelected
                    ? "border-ember bg-canvas-elevated shadow-md ring-1 ring-ember"
                    : "border-hairline bg-canvas-elevated hover:border-ink/30"
                }`}
              >
                {activeImageSrc && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian">
                    <Image
                      src={activeImageSrc}
                      alt={`${space.name} — Vista ${currentSlideIdx + 1}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-transparent to-obsidian/35" />

                    {/* Top Bar: Location Differential Badge + Open Lightbox Gallery Button */}
                    <div className="absolute left-3.5 right-3.5 top-3 flex items-center justify-between gap-2">
                      {spaceLoc && locations.length > 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-obsidian/90 px-2.5 py-1 text-[11px] font-medium text-gold border border-obsidian-border">
                          <MapPin className="size-3 text-ember-glow" />
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
                          className="inline-flex items-center gap-1 rounded-full bg-obsidian/90 px-2.5 py-1 text-[11px] font-medium text-ivory border border-obsidian-border transition hover:bg-ember"
                        >
                          <Images className="size-3 text-ember-glow" />
                          <span>
                            Galería ({currentSlideIdx + 1}/{gallery.length})
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Interactive Prev/Next Carousel Controls on Card */}
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
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-obsidian/75 text-ivory transition hover:bg-obsidian"
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
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-obsidian/75 text-ivory transition hover:bg-obsidian"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </>
                    )}

                    {/* Bottom Capacity Bar */}
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-ivory">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/90 px-3 py-1 font-mono font-medium">
                        <Users className="size-3.5 text-ember-glow" />
                        {space.min_guests} – {space.capacity_seated} sentados
                      </span>
                      {space.capacity_cocktail && (
                        <span className="tabular-price font-mono text-[11px] text-ivory-muted">
                          Hasta {space.capacity_cocktail} cóctel
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Thumbnail Strip for Quick Multi-Angle Preview */}
                {gallery.length > 1 && (
                  <div className="grid grid-cols-4 gap-1.5 border-b border-hairline bg-canvas px-4 py-2">
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
                        className={`relative aspect-[16/10] overflow-hidden rounded-lg border transition ${
                          currentSlideIdx === idx
                            ? "border-ember ring-1 ring-ember"
                            : "border-hairline opacity-65 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={imgUrl}
                          alt={`${space.name} miniatura ${idx + 1}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {space.ambiance_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-canvas-muted px-2.5 py-0.5 text-[11px] font-medium text-ink-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-ink">
                      {space.name}
                    </h3>
                    {space.subtitle && (
                      <p className="mt-1 text-xs font-medium text-ember">
                        {space.subtitle}
                      </p>
                    )}
                    <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                      {space.description}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-hairline pt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      Equipamiento incluido
                    </p>
                    <ul className="grid grid-cols-1 gap-1.5 text-xs text-ink">
                      {space.equipment_features.slice(0, 4).map((feat) => (
                        <li key={feat} className="flex items-center gap-2">
                          <CheckCircle2 className="size-3.5 shrink-0 text-ember" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSpace(space);
                      }}
                      className={`mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? "bg-ember text-ivory shadow-sm"
                          : "bg-canvas-muted text-ink hover:bg-obsidian hover:text-ivory"
                      }`}
                    >
                      <span>
                        {isSelected
                          ? "Salón seleccionado · Ir a cotizar"
                          : "Cotizar este salón"}
                      </span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 2: Commercial Event Packages & Visual Experiences */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col justify-between gap-3 border-b border-hairline pb-5 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
              Propuestas Gastronómicas con Referencia Visual
            </span>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
              Paquetes Comerciales & Experiencias
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            Precios transparentes con menús diseñados para grupos. Al elegir una experiencia, tu tipo de celebración y presupuesto se pre-cargan automáticamente abajo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                className={`group flex flex-col justify-between overflow-hidden rounded-3xl border transition ${
                  pkg.is_featured && isSelected
                    ? "border-ember bg-obsidian text-ivory shadow-xl ring-2 ring-ember"
                    : pkg.is_featured
                      ? "border-obsidian-border bg-obsidian text-ivory shadow-lg"
                      : isSelected
                        ? "border-ember bg-canvas-elevated text-ink ring-2 ring-ember"
                        : "border-hairline bg-canvas-elevated text-ink"
                }`}
              >
                <div>
                  {/* Pillar 3B: Visual Experience Cover Image on Package Card */}
                  {pkg.cover_image_url && (
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-obsidian">
                      <Image
                        src={pkg.cover_image_url}
                        alt={pkg.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/20 to-transparent" />
                      <div className="absolute left-4 right-4 top-3.5 flex items-center justify-between gap-2">
                        {pkg.badge_label && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              pkg.is_featured
                                ? "bg-ember text-ivory"
                                : "bg-obsidian/90 text-gold border border-gold/30"
                            }`}
                          >
                            {pkg.badge_label}
                          </span>
                        )}
                        <span className="tabular-price rounded-full bg-obsidian/90 px-2.5 py-1 font-mono text-xs text-ivory">
                          {pkg.min_guests} a {pkg.max_guests ?? 95} inv.
                        </span>
                      </div>
                      {pkg.duration_hours && (
                        <span className="absolute bottom-3 left-4 inline-flex items-center gap-1 text-xs font-medium text-ivory/90">
                          <Clock className="size-3.5 text-ember-glow" />
                          Duración incluida: {Number(pkg.duration_hours)} horas
                        </span>
                      )}
                    </div>
                  )}

                  <div className="p-6 sm:p-7">
                    <h3 className="font-display text-2xl font-semibold leading-tight">
                      {pkg.name}
                    </h3>

                    <div className="mt-3 border-b border-current/10 pb-4">
                      {pkg.pricing_model === "per_person" && pkg.base_price ? (
                        <div>
                          <span className="tabular-price font-mono text-2xl font-bold text-ember-glow">
                            {formatCurrency(
                              Number(pkg.base_price),
                              currencyCode
                            )}
                          </span>
                          <span
                            className={`ml-1.5 text-xs ${
                              pkg.is_featured
                                ? "text-ivory-muted"
                                : "text-ink-muted"
                            }`}
                          >
                            / por invitado (IVA incluido)
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm font-semibold uppercase tracking-wider text-gold">
                          Cotización Personalizada a Medida
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-4 text-sm leading-relaxed ${
                        pkg.is_featured ? "text-ivory-muted" : "text-ink-muted"
                      }`}
                    >
                      {pkg.description}
                    </p>

                    <div className="mt-5">
                      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider">
                        ¿Qué incluye la experiencia?
                      </p>
                      <ul className="space-y-2 text-xs">
                        {includesList.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ember-glow" />
                            <span
                              className={
                                pkg.is_featured
                                  ? "text-ivory/90"
                                  : "text-ink/90"
                              }
                            >
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {extrasList.length > 0 && (
                      <div className="mt-5 border-t border-current/10 pt-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gold">
                          Adicionales opcionales
                        </p>
                        <ul className="space-y-1.5 text-xs">
                          {extrasList.map((ext) => (
                            <li
                              key={ext.name}
                              className="flex items-baseline justify-between gap-2"
                            >
                              <span
                                className={
                                  pkg.is_featured
                                    ? "text-ivory-muted"
                                    : "text-ink-muted"
                                }
                              >
                                + {ext.name}
                              </span>
                              <span className="tabular-price shrink-0 font-mono text-[11px] font-semibold">
                                {ext.price}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 pt-0 sm:px-7 sm:pb-7">
                  <button
                    type="button"
                    onClick={() => handleSelectPackage(pkg)}
                    className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      isSelected
                        ? "bg-ember text-ivory shadow-md"
                        : pkg.is_featured
                          ? "bg-ivory text-obsidian hover:bg-ember hover:text-ivory"
                          : "bg-obsidian text-ivory hover:bg-ember"
                    }`}
                  >
                    <span>
                      {isSelected
                        ? "Paquete Seleccionado · Cotizar abajo"
                        : "Elegir este paquete para cotizar"}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 3: Transactional Inquiry Form + Instant WhatsApp Bridge */}
      <section
        id="solicitud-cotizacion-eventos"
        className="scroll-mt-28 rounded-3xl border border-obsidian-border bg-obsidian p-6 text-ivory shadow-2xl sm:p-10"
      >
        {submittedRefCode ? (
          /* Post-Submission Confirmation State (D3 Decision) */
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-sage/20 text-sage border border-sage/40">
              <CheckCircle2 className="size-7" />
            </div>

            <span className="inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 font-mono text-xs font-semibold text-gold">
              CÓDIGO DE SOLICITUD: {submittedRefCode}
            </span>

            <h2 className="mt-4 font-display text-3xl font-semibold text-ivory sm:text-4xl">
              Hemos registrado tu solicitud de cotización
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
              Importante:{" "}
              <strong className="text-ivory">
                Esta solicitud no equivale a una reserva bloqueada automáticamente.
              </strong>{" "}
              Nuestro equipo de eventos ya recibió los detalles en el panel de{" "}
              {restaurantName} y verificará la disponibilidad del salón para el{" "}
              <span className="font-mono text-ivory">{tentativeDate}</span> (
              {guestCount} invitados).
            </p>

            <div className="mt-6 rounded-2xl border border-obsidian-border bg-obsidian-card p-5 text-left text-xs text-ivory-muted">
              <p className="font-semibold text-ivory">
                Resumen registrado en el sistema:
              </p>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <p>
                  • Referencia:{" "}
                  <span className="font-mono text-gold">
                    {submittedRefCode}
                  </span>
                </p>
                <p>• Celebración: {effectiveEventType}</p>
                <p>• Fecha tentativa: {tentativeDate}</p>
                <p>• Aforo estimado: {guestCount} invitados</p>
                <p>• Espacio: {selectedSpace?.name ?? "Por definir"}</p>
                <p>• Paquete: {selectedPackage?.name ?? "A medida"}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={whatsappSummaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-7 py-3 text-sm font-semibold text-ivory shadow-lg transition hover:bg-ember-hover sm:w-auto"
              >
                <MessageCircle className="size-4" />
                <span>
                  Agilizar por WhatsApp con mi código {submittedRefCode}
                </span>
              </a>

              <button
                type="button"
                onClick={() => setSubmittedRefCode(null)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-obsidian-border px-6 py-3 text-xs font-medium text-ivory-muted hover:text-ivory"
              >
                Enviar otra consulta
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/20 px-3 py-1 text-xs font-medium text-ember-glow border border-ember/30">
                <Sparkles className="size-3.5" />
                Atención Directa de Hospitalidad
              </span>

              <h2 className="mt-3 font-display text-3xl font-semibold text-ivory sm:text-4xl">
                Solicita una Propuesta & Disponibilidad de Fecha
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
                Selecciona tu tipo de celebración, salón y paquete. Tu solicitud queda registrada con un código único (`CB-YYMM-XXXX`) para seguimiento prioritario y podrás abrir conversación directa por WhatsApp con nuestra coordinadora.
              </p>

              <div className="mt-6 space-y-3 rounded-2xl border border-obsidian-border bg-obsidian-card p-5 text-xs text-ivory-muted">
                <div className="flex items-start gap-2.5">
                  <Info className="mt-0.5 size-4 shrink-0 text-gold" />
                  <p>
                    <strong className="text-ivory">
                      Transparencia en disponibilidad:
                    </strong>{" "}
                    Enviar este formulario registra una solicitud de cotización;
                    la reserva del salón se confirma una vez validada la
                    disponibilidad de la fecha y abonado el anticipo acordado.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sage" />
                  <p>
                    <strong className="text-ivory">
                      Datos protegidos (Ley 1581 de 2012):
                    </strong>{" "}
                    Tus datos se almacenan con aislamiento cifrado Multi-Tenant y solo son
                    visibles para el equipo autorizado de {restaurantName}.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 lg:col-span-7"
              noValidate
            >
              {/* Hidden Honeypot against automated spam bots */}
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

              {/* Pillar 1: Quick-Select Celebration Type Chips */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ivory-muted">
                  ¿Qué tipo de celebración o evento estás planeando? *
                </label>
                <div className="flex flex-wrap gap-2">
                  {CELEBRATION_PRESETS.map((preset) => {
                    const active = celebrationPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCelebrationPreset(preset)}
                        className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${
                          active
                            ? "border-ember bg-ember text-ivory shadow-sm"
                            : "border-obsidian-border bg-obsidian-card text-ivory-muted hover:border-ivory/40 hover:text-ivory"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                {/* Keep #eventType input for accessibility, E2E compatibility & custom input */}
                <div
                  className={
                    celebrationPreset === "Otro / A medida" ? "mt-2.5" : "sr-only"
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
                    placeholder="Describe tu celebración (ej. Bautizo, Lanzamiento de marca, Cena de grado...)"
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="guestCount"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Invitados estimados *
                  </label>
                  <input
                    id="guestCount"
                    type="number"
                    min={6}
                    max={500}
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="tabular-price h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 font-mono text-sm text-ivory focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tentativeDate"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    <Calendar className="size-3.5 text-ember-glow" />
                    <span>Fecha tentativa *</span>
                  </label>
                  <input
                    id="tentativeDate"
                    type="date"
                    required
                    value={tentativeDate}
                    onChange={(e) => setTentativeDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 font-mono text-sm text-ivory focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="preferredTimeSlot"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    <Clock className="size-3.5 text-ember-glow" />
                    <span>Franja horaria *</span>
                  </label>
                  <select
                    id="preferredTimeSlot"
                    value={preferredTimeSlot}
                    onChange={(e) =>
                      setPreferredTimeSlot(
                        e.target.value as (typeof TIME_SLOT_VALUES)[number]
                      )
                    }
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory focus:border-ember focus:outline-none"
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
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                    >
                      Sede preferida
                    </label>
                    <select
                      id="locationSelect"
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-sm text-ivory focus:border-ember focus:outline-none"
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
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
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
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-sm text-ivory focus:border-ember focus:outline-none"
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
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Paquete comercial
                  </label>
                  <select
                    id="packageSelect"
                    value={selectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value);
                      setSelectedExtras([]);
                    }}
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3 text-sm text-ivory focus:border-ember focus:outline-none"
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
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Tu nombre completo *
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre y apellido"
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customerPhone"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    WhatsApp / Teléfono móvil *
                  </label>
                  <input
                    id="customerPhone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+57 310 000 0000"
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 font-mono text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customerEmail"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Correo electrónico (Opcional)
                  </label>
                  <input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="companyName"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    <Building2 className="size-3.5 text-gold" />
                    <span>Empresa (Si es corporativo)</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nombre de la organización"
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="specialRequests"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                >
                  Requerimientos especiales (Restricciones dietarias, montaje, audio/video)
                </label>
                <textarea
                  id="specialRequests"
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Cuéntanos si requieres proyector, opciones vegetarianas, decoración de cumpleaños o factura corporativa..."
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-card p-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                />
              </div>

              {/* Live Referential Budget & Interactive Optional Extras Estimator */}
              <div className="rounded-2xl border border-gold/30 bg-obsidian-card/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold">
                      Estimado referencial en vivo ({guestCount} invitados)
                    </span>
                    <span className="mt-0.5 block text-xs text-ivory-muted">
                      {effectiveEventType} ·{" "}
                      {selectedPackage?.name ?? "Cotización personalizada"}
                    </span>
                  </div>
                  <div className="text-right">
                    {estimatedTotal !== null ? (
                      <span className="tabular-price font-mono text-xl font-semibold text-ivory">
                        {formatCurrency(estimatedTotal, currencyCode)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-xs font-semibold text-gold">
                        Propuesta a medida del Chef
                      </span>
                    )}
                    {selectedPackage?.pricing_model === "per_person" &&
                      selectedPackage.base_price && (
                        <span className="tabular-price block font-mono text-[11px] text-ivory-muted">
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

                {/* Plus #3: Interactive Optional Extras Toggles */}
                {availablePackageExtras.length > 0 && (
                  <div className="mt-3 border-t border-obsidian-border pt-3">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-ivory-muted">
                      Personaliza tu estimado agregando experiencias opcionales:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {availablePackageExtras.map((ext) => {
                        const checked = selectedExtras.includes(ext.name);
                        return (
                          <button
                            key={ext.name}
                            type="button"
                            onClick={() => toggleExtra(ext.name)}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                              checked
                                ? "border-gold bg-gold/15 text-ivory"
                                : "border-obsidian-border bg-obsidian text-ivory-muted hover:text-ivory"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                className="size-3.5 accent-ember pointer-events-none"
                              />
                              <span>{ext.name}</span>
                            </span>
                            <span className="tabular-price font-mono font-semibold text-gold">
                              {ext.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exceedsSpaceSeated && selectedSpace && (
                  <p className="mt-2.5 border-t border-obsidian-border pt-2 text-xs text-amber-warn">
                    Nota de aforo: <strong>{selectedSpace.name}</strong> tiene
                    capacidad máxima de{" "}
                    <strong>
                      {selectedSpace.capacity_seated} personas sentadas
                    </strong>
                    {maxAllowedInSelectedSpace &&
                    maxAllowedInSelectedSpace > selectedSpace.capacity_seated
                      ? ` (hasta ${maxAllowedInSelectedSpace} en formato cóctel)`
                      : ""}
                    . Nuestro equipo te sugerirá el montaje o salón ideal.
                  </p>
                )}
              </div>

              {/* Mandatory Habeas Data Checkbox (Colombia Ley 1581) */}
              <label
                htmlFor="privacyAccepted"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-obsidian-border bg-obsidian-card/70 p-3.5 text-xs text-ivory-muted"
              >
                <input
                  id="privacyAccepted"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-obsidian-border accent-ember"
                />
                <span>{privacyPolicyText}</span>
              </label>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-crimson/50 bg-crimson/15 px-4 py-3 text-xs font-medium text-ivory"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-semibold text-ivory shadow-lg transition hover:bg-ember-hover disabled:opacity-60"
              >
                {isPending
                  ? "Registrando solicitud de forma segura..."
                  : "Registrar Solicitud de Cotización"}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* Lightbox Modal for Inspecting Multi-Image Salon Gallery */}
      {lightboxSpace && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${lightboxSpace.space.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxSpace(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-obsidian-border bg-obsidian-card text-ivory shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-obsidian-border px-6 py-4">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ivory">
                  {lightboxSpace.space.name}
                </h3>
                <p className="text-xs text-ivory-muted">
                  Fotografía {lightboxSpace.index + 1} de{" "}
                  {lightboxSpace.images.length} · Capacidad{" "}
                  {lightboxSpace.space.min_guests} a{" "}
                  {lightboxSpace.space.capacity_seated} sentados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxSpace(null)}
                className="flex size-10 items-center justify-center rounded-full bg-obsidian text-ivory hover:bg-ember"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative aspect-[16/10] w-full bg-obsidian">
              <Image
                src={
                  lightboxSpace.images[lightboxSpace.index] ??
                  lightboxSpace.images[0] ??
                  "/demo/casa-brasa/salon-cava-cristal.jpg"
                }
                alt={lightboxSpace.space.name}
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-cover"
              />
              <button
                type="button"
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
                className="absolute left-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-obsidian/80 text-ivory hover:bg-ember"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-obsidian/80 text-ivory hover:bg-ember"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 px-6 py-4">
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
                    className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border ${
                      lightboxSpace.index === idx
                        ? "border-ember ring-2 ring-ember"
                        : "border-obsidian-border opacity-60"
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
                  handleSelectSpace(sp);
                }}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-ember px-6 py-2.5 text-xs font-semibold text-ivory hover:bg-ember-hover"
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
