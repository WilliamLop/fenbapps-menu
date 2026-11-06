# ESTADO DEL PROYECTO Y PROTOCOLO DE HANDOFF (`fenbapps-restaurants-menu`)

> **Propósito de este documento:** Fuente de verdad arquitectónica y operativa para evitar cualquier pérdida de contexto o alucinación entre sesiones. Si inicias un chat nuevo o ejecutas `/compact`, indica al agente:  
> *"Lee `ESTADO_PROYECTO_Y_HANDOFF.md` antes de analizar o tocar código."*

---

## 1. Infraestructura Activa
- **Repositorio GitHub:** `https://github.com/WilliamLop/fenbapps-menu.git` (rama `main`)
- **Stack:** Next.js 15 App Router · React 19 · TypeScript estricto · Tailwind CSS v4 · Zod · Supabase PostgreSQL (`@supabase/ssr`) · Vitest + Playwright.
- **Proyecto Supabase:** `gssikxqasqjbyvcdccgl` (`https://gssikxqasqjbyvcdccgl.supabase.co`)
- **Seguridad Base de Datos:** `0` alertas en Supabase Security Advisors (`FORCE ROW LEVEL SECURITY` en todas las tablas públicas; funciones `SECURITY DEFINER` aisladas en el esquema `private` con wrappers `SECURITY INVOKER` en `public`).

---

## 2. Escenarios Demo Multi-Tenant Sembrados
1. **`/casa-brasa` (*Casa Brasa · Fuego, Cava & Autor*):** Escenario **Multi-Sede (2 sedes en Bogotá: Parque de la 93 y Zona G)** con diferenciales por sede, platos exclusivos, salones con galerías múltiples y domicilios directos.
2. **`/botanica-brunch` (*Botánica · Cocina de Huerta & Invernadero*):** Escenario **Sede Única (1 establecimiento en Usaquén, 2 salones internos)** que oculta selectores innecesarios de sede automáticamente.
3. **`bistro-rival-test`:** Tenant oculto exclusivo para pruebas automatizadas de aislamiento RLS.

---

## 3. Mapa de Rutas y Módulos Completados (Iteraciones 1 a 5)

| Ruta | Módulo / Capacidades Activas |
| :--- | :--- |
| `/` | Landing comercial B2B de la plataforma + acceso a demos. |
| `/[restaurantSlug]` | Brand Hub editorial adaptable (1 sede vs N sedes), historia, plato insignia dinámico y vitrina fotográfica de sedes (`LocationsShowcase`). |
| `/[restaurantSlug]/menu` | **Carta Digital Inteligente & Motor de Pedidos 0% Comisión:**<br>• Detección inteligente de QR (`?sede=...&mesa=X` abre limpio en **Modo Mesa**; `?modo=domicilio` abre en **Domicilio**).<br>• **3 Modalidades:** `🍽️ En el Restaurante` (modo mostrar al mesero + divisor flexible `1–30` personas + propina 10%), `🛵 Pedir a Domicilio` (tarifa de envío, umbral de envío gratis, pedido mínimo, validación de platos exclusivos por sede) y `🛍️ Pasar a Recoger`.<br>• **3 Medios de Pago desde casa:** Efectivo (con calculadora de vueltas sin ceros a la izquierda), Tarjeta/Datáfono (Débito/Crédito) y Transferencia (copiar llave/cuenta en 1 clic + envío de comprobante por WhatsApp).<br>• Persistencia local en `localStorage` (`fenbapps:cart:v1:${slug}`) + respaldo transaccional en PostgreSQL (`public.direct_orders`). |
| `/[restaurantSlug]/eventos` | **Dossier de Salones & Cotizador de Eventos:** Galerías por salón, paquetes con extras interactivos, bloqueo de fechas pasadas, input numérico sanitizado (cero `015`) y registro en `public.event_inquiries` (`CB-YYMM-XXXX`). |
| `/dashboard/[restaurantSlug]` | **Consola Operativa en Tiempo Real ("Mise en Place"):**<br>1. Control 1-clic de disponibilidad (`available`, `sold_out`, `hidden`) y edición de precios en vivo.<br>2. Bandeja de **Pedidos & Domicilios Directos** con indicador de ahorro en comisiones (~28%) y estados en cocina.<br>3. **Mini-CRM de Eventos** sincronizado con PostgreSQL.<br>4. **Generador de Códigos QR** contextuales en SVG descargable (`?mesa=` y `?modo=domicilio`).<br>5. Bitácora forense `public.audit_logs`. |

---

## 4. Contratos Críticos de PostgreSQL (Constraints Exactos — NO Desalinear)
- **`public.restaurant_members.role`:** `'owner' | 'admin' | 'editor'`
- **`public.products.availability_status`:** `'available' | 'sold_out' | 'hidden'`
- **`public.event_inquiries.status` (`event_inquiries_status_check`):** `'received' | 'contacted' | 'quoted' | 'confirmed' | 'rejected' | 'archived'`
- **`public.direct_orders.fulfillment_type`:** `'dine_in' | 'delivery' | 'pickup'`
- **`public.direct_orders.payment_method`:** `'cash' | 'card_dataphone' | 'transfer'`
- **`public.direct_orders.status`:** `'received' | 'preparing' | 'dispatched' | 'completed' | 'cancelled'`
- **`public.audit_logs.entity_id`:** Tipo **`uuid` nativo** (nunca enviar `::text`).

---

## 5. Reglas de Higiene UX & Flujo de Trabajo
1. **Inputs Numéricos:** Usar siempre `sanitizeNumericInput` de `src/lib/utils.ts` con `type="text" inputMode="numeric"` para impedir ceros a la izquierda (`015`, `04`).
2. **Verificación antes de cerrar cualquier iteración:**
   - `npm run typecheck` (`0` errores)
   - `npm run test` (Vitest + pruebas reales de bloqueo RLS anónimo sobre `event_inquiries` y `direct_orders`)
   - `node scripts/playwright-audit.mjs` (auditoría E2E móvil + desktop)
3. **Próximos Hitos Sugeridos (Backlog Evolutivo):**
   - **Iteración 6:** Autenticación real Supabase Auth (Magic Link / Email + Password) para dueños/administradores + onboarding guiado para crear un restaurante nuevo desde la interfaz + subida de fotos a Supabase Storage (`restaurant-media`).
   - **Iteración 7:** Horarios automáticos de apertura/cierre para domicilios (bloquear checkout fuera de horario o permitir programar pedido) + impresión de comanda térmica 80mm desde la Consola Operativa.
