# Plataforma de Soluciones Comerciales para Restaurantes (`fenbapps-menu`)

Plataforma tecnológica multi-tenant construida con **Next.js App Router, TypeScript estricto, Tailwind CSS v4 (`OKLCH`) y Supabase PostgreSQL con RLS blindado**.

Diseñada para presentar y comercializar tres módulos integrados por restaurante:
1. **Menú Digital Inteligente (`/[restaurantSlug]/menu`):** Experiencia mobile-first ("Zero-Splash QR"), fotografía gastronómica real de alta fidelidad combinada con modo de carta tipográfica clásica (`compact_list`), variantes simples e informativas y buscador instantáneo.
2. **Sistema Comercial de Eventos y Celebraciones (`/[restaurantSlug]/eventos`):** Dossier arquitectónico de salones privados, paquetes comparables y captura blindada de solicitudes de cotización (`event_inquiries`) con código de referencia único y puente directo a WhatsApp.
3. **Página Comercial del Restaurante (`/[restaurantSlug]`):** Hub editorial de marca, historia culinaria, sedes con horarios y enrutamiento de conversión.

---

## Arquitectura de Seguridad ("Hardened Multi-Tenant")

- **Row-Level Security (`FORCE ROW LEVEL SECURITY`):** Activo en todas las tablas (`public` y `private`).
- **Funciones `SECURITY DEFINER` aisladas en esquema `private`:** `private.has_restaurant_role()` y `private.insert_validated_event_inquiry()` operan con `SET search_path = ''` fuera del esquema público expuesto.
- **Protección Anti-Spam y Habeas Data (Ley 1581 de 2012):** Honeypot anti-bots, rate limiting por hash SHA-256 de IP en ventanas de 15 minutos (`private.rate_limit_buckets`) y registro obligatorio de consentimiento (`privacy_accepted_at`).
- **Auditoría verificada con Supabase Security Advisor (`get_advisors`):** `0` advertencias de seguridad.

---

## Comandos de Desarrollo y Verificación

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# Verificar tipos TypeScript
npm run typecheck

# Ejecutar suite de pruebas (Unitarias + Integración RLS en vivo contra Supabase)
npm run test
```
