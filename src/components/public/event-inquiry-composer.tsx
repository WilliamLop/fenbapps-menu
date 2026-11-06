"use client";

import { useState, useTransition } from "react";
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
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    spaces[0]?.id ?? ""
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    packages[0]?.id ?? ""
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations[0]?.id ?? ""
  );

  const [eventType, setEventType] = useState<string>(
    "Cena Corporativa / Cierre de Año"
  );
  const [tentativeDate, setTentativeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0] ?? "";
  });
  const [preferredTimeSlot, setPreferredTimeSlot] =
    useState<(typeof TIME_SLOT_VALUES)[number]>("dinner");
  const [guestCount, setGuestCount] = useState<number>(20);
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

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);

  const estimatedTotal =
    selectedPackage?.pricing_model === "per_person" &&
    selectedPackage.base_price
      ? Number(selectedPackage.base_price) * Math.max(1, guestCount)
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
    if (guestCount < pkg.min_guests) {
      setGuestCount(pkg.min_guests);
    }
    const formEl = document.getElementById("solicitud-cotizacion-eventos");
    formEl?.scrollIntoView({ behavior: "smooth" });
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

    startTransition(async () => {
      const result = await submitEventInquiryAction({
        restaurantId,
        restaurantSlug,
        locationId: selectedLocationId || null,
        eventSpaceId: selectedSpaceId || null,
        eventPackageId: selectedPackageId || null,
        eventType,
        tentativeDate,
        preferredTimeSlot,
        guestCount,
        customerName,
        customerPhone,
        customerEmail,
        companyName,
        specialRequests,
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
          `• Evento: ${eventType}\n` +
          `• Fecha tentativa: ${tentativeDate} (${TIME_SLOT_LABELS[preferredTimeSlot]})\n` +
          `• Invitados estimados: ${guestCount} personas\n` +
          `• Salón de interés: ${selectedSpace?.name ?? "Por definir"}\n` +
          `• Paquete: ${selectedPackage?.name ?? "Cotización a medida"}\n` +
          `• Contacto: ${customerName} (${customerPhone})`
      )
    : "#";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Section 1: Private Event Spaces Architectural Dossier */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col justify-between gap-3 border-b border-hairline pb-5 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
              Arquitectura & Hospitalidad Privada
            </span>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
              Nuestros Salones & Espacios Exclusivos
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            Cada espacio cuenta con equipamiento audiovisual, climatización e iluminación cálida pensada para eventos empresariales y celebraciones familiares.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {spaces.map((space) => {
            const isSelected = selectedSpaceId === space.id;
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
                {space.cover_image_url && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian">
                    <Image
                      src={space.cover_image_url}
                      alt={space.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-transparent to-transparent" />
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

      {/* Section 2: Commercial Event Packages */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col justify-between gap-3 border-b border-hairline pb-5 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">
              Propuestas Gastronómicas Claras
            </span>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">
              Paquetes Comerciales & Experiencias
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            Precios transparentes con menús diseñados para grupos. Selecciona el paquete que mejor se adapte a tu celebración para pre-cargar tu solicitud.
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
            const extrasList = Array.isArray(pkg.optional_extras)
              ? (pkg.optional_extras as unknown as PackageExtraItem[])
              : [];

            return (
              <article
                key={pkg.id}
                className={`flex flex-col justify-between rounded-3xl border p-6 sm:p-7 transition ${
                  isSelected
                    ? "border-ember bg-obsidian text-ivory shadow-xl"
                    : "border-hairline bg-canvas-elevated text-ink hover:border-ember/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    {pkg.badge_label && (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isSelected
                            ? "bg-ember text-ivory"
                            : "bg-canvas-muted text-ember"
                        }`}
                      >
                        {pkg.badge_label}
                      </span>
                    )}
                    <span
                      className={`tabular-price font-mono text-xs ${
                        isSelected ? "text-ivory-muted" : "text-ink-muted"
                      }`}
                    >
                      {pkg.min_guests} a {pkg.max_guests ?? 95} invitados
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-3xl font-semibold">
                    {pkg.name}
                  </h3>

                  <div className="mt-3 flex items-baseline gap-2 border-b border-current/15 pb-4">
                    {pkg.pricing_model === "per_person" && pkg.base_price ? (
                      <>
                        <span className="tabular-price font-mono text-2xl font-bold text-ember-glow">
                          {formatCurrency(Number(pkg.base_price), currencyCode)}
                        </span>
                        <span
                          className={`text-xs ${
                            isSelected ? "text-ivory-muted" : "text-ink-muted"
                          }`}
                        >
                          / por invitado (IVA incluido)
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-lg font-semibold text-gold">
                        Cotización Personalizada a Medida
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-4 text-sm leading-relaxed ${
                      isSelected ? "text-ivory-muted" : "text-ink-muted"
                    }`}
                  >
                    {pkg.description}
                  </p>

                  <div className="mt-5">
                    <p
                      className={`mb-2.5 text-xs font-semibold uppercase tracking-wider ${
                        isSelected ? "text-gold" : "text-ink"
                      }`}
                    >
                      ¿Qué incluye la experiencia?
                    </p>
                    <ul className="flex flex-col gap-2 text-xs leading-relaxed">
                      {includesList.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ember-glow" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {extrasList.length > 0 && (
                    <div className="mt-5 rounded-2xl bg-current/5 p-3.5 text-xs">
                      <p className="font-semibold mb-1.5">
                        Adicionales opcionales:
                      </p>
                      {extrasList.map((ext, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 py-0.5"
                        >
                          <span className="opacity-85">{ext.name}</span>
                          <span className="tabular-price font-mono font-semibold">
                            {ext.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4">
                  <button
                    type="button"
                    onClick={() => handleSelectPackage(pkg)}
                    className={`w-full min-h-11 rounded-full px-5 py-3 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-ember text-ivory hover:bg-ember-hover"
                        : "bg-obsidian text-ivory hover:bg-ember"
                    }`}
                  >
                    {isSelected
                      ? "Paquete Seleccionado · Cotizar abajo"
                      : "Elegir este paquete para cotizar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 3: Hardened Inquiry Form (Persists in PostgreSQL + WhatsApp Bridge) */}
      <section
        id="solicitud-cotizacion-eventos"
        className="scroll-mt-24 rounded-3xl border border-obsidian-border bg-obsidian p-6 text-ivory shadow-2xl sm:p-10"
      >
        {submittedRefCode ? (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-sage/20 text-sage border border-sage/40">
              <CheckCircle2 className="size-8" />
            </div>
            <span className="inline-block rounded-full bg-obsidian-card px-4 py-1 font-mono text-xs font-semibold text-gold border border-obsidian-border">
              CÓDIGO DE SOLICITUD: {submittedRefCode}
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ivory sm:text-4xl">
              Hemos registrado tu solicitud de cotización
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
              Importante: <strong>Esta solicitud no equivale a una reserva bloqueada automáticamente.</strong> Nuestro equipo de eventos ya recibió los detalles en el panel de {restaurantName} y verificará la disponibilidad del salón para el <strong>{tentativeDate}</strong> ({guestCount} invitados).
            </p>

            <div className="mt-6 rounded-2xl border border-obsidian-border bg-obsidian-card p-5 text-left text-xs text-ivory-muted">
              <p className="font-semibold text-ivory mb-2">
                Resumen registrado en el sistema:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>• Referencia: <span className="font-mono text-gold">{submittedRefCode}</span></p>
                <p>• Evento: {eventType}</p>
                <p>• Fecha tentativa: {tentativeDate}</p>
                <p>• Aforo estimado: {guestCount} invitados</p>
                <p>• Espacio: {selectedSpace?.name ?? "Por definir"}</p>
                <p>• Paquete: {selectedPackage?.name ?? "Personalizado"}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={whatsappSummaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ember px-7 py-3 text-sm font-semibold text-ivory transition hover:bg-ember-hover sm:w-auto"
              >
                <MessageCircle className="size-4" />
                <span>Agilizar por WhatsApp con mi código {submittedRefCode}</span>
              </a>
              <button
                type="button"
                onClick={() => setSubmittedRefCode(null)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-obsidian-border px-6 py-3 text-sm font-medium text-ivory-muted hover:text-ivory sm:w-auto"
              >
                Enviar otra consulta
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/20 px-3 py-1 text-xs font-semibold text-ember-glow border border-ember/30">
                <Sparkles className="size-3.5" />
                Atención Directa de Hospitalidad
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold text-ivory sm:text-4xl">
                Solicita una Propuesta & Disponibilidad de Fecha
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
                Completa los datos básicos de tu evento. Tu solicitud queda registrada con un código único en nuestro sistema para seguimiento prioritario y, al finalizar, podrás abrir conversación directa por WhatsApp con nuestra coordinadora de eventos.
              </p>

              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-obsidian-border bg-obsidian-card p-5 text-xs text-ivory-muted">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div>
                    <p className="font-semibold text-ivory">
                      Transparencia en disponibilidad
                    </p>
                    <p className="mt-0.5">
                      Enviar este formulario registra una solicitud de cotización; la reserva del salón se confirma una vez validada la disponibilidad de la fecha y abonado el anticipo acordado.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sage" />
                  <div>
                    <p className="font-semibold text-ivory">
                      Datos protegidos (Ley 1581 de 2012)
                    </p>
                    <p className="mt-0.5">
                      Tus datos se almacenan con aislamiento cifrado y solo son visibles para el equipo autorizado de {restaurantName}.
                    </p>
                  </div>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="eventType"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Tipo de celebración o evento *
                  </label>
                  <input
                    id="eventType"
                    type="text"
                    required
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    placeholder="Ej. Cumpleaños 40, Junta Directiva..."
                    className="h-11 w-full rounded-xl border border-obsidian-border bg-obsidian-card px-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="guestCount"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ivory-muted"
                  >
                    Número estimado de invitados *
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
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
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
                    onChange={(e) => setSelectedPackageId(e.target.value)}
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
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Cuéntanos si requieres proyector, opciones vegetarianas, decoración de cumpleaños o factura corporativa..."
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-card p-3.5 text-sm text-ivory placeholder:text-ivory-muted/50 focus:border-ember focus:outline-none"
                />
              </div>

              {/* Live Referential Budget & Capacity Estimator */}
              <div className="rounded-2xl border border-gold/30 bg-obsidian-card/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold">
                      Estimado referencial en vivo ({guestCount} invitados)
                    </span>
                    <span className="mt-0.5 block text-xs text-ivory-muted">
                      {selectedPackage?.name ?? "Cotización personalizada"} ·{" "}
                      {selectedSpace?.name ?? "Salón por definir"}
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
                            Number(selectedPackage.base_price),
                            currencyCode
                          )}{" "}
                          / invitado
                        </span>
                      )}
                  </div>
                </div>

                {exceedsSpaceSeated && selectedSpace && (
                  <p className="mt-2.5 border-t border-obsidian-border pt-2 text-xs text-amber-warn">
                    Nota de aforo: <strong>{selectedSpace.name}</strong> tiene capacidad máxima de{" "}
                    <strong>{selectedSpace.capacity_seated} personas sentadas</strong>
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
    </div>
  );
}
