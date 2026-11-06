# ESTADO DEL PROYECTO Y PROTOCOLO DE HANDOFF (`fenbapps-restaurants-menu`)

> **Propósito de este documento:** Fuente de verdad arquitectónica y operativa para evitar cualquier pérdida de contexto o alucinación entre sesiones. Si inicias un chat nuevo o ejecutas `/compact`, indica al agente:  
> *"Lee `ESTADO_PROYECTO_Y_HANDOFF.md` antes de analizar o tocar código."*

---

## 1. Infraestructura Activa
- **Repositorio GitHub:** `https://github.com/WilliamLop/fenbapps-menu.git` (rama `main`)
- **Stack:** Next.js 15 App Router · React 19 · TypeScript estricto · Tailwind CSS v4 · Zod · Supabase PostgreSQL (`@supabase/ssr`) · `qrcode` (ISO/IEC 18004) · Vitest + Playwright.
- **Proyecto Supabase:** `gssikxqasqjbyvcdccgl` (`https://gssikxqasqjbyvcdccgl.supabase.co`)
- **Seguridad Base de Datos:** `0` alertas en Supabase Security Advisors (`FORCE ROW LEVEL SECURITY` en todas las tablas públicas; funciones `SECURITY DEFINER` aisladas en el esquema `private` con wrappers `SECURITY INVOKER` en `public`).

---

## 2. Escenarios Demo Multi-Tenant Sembrados & Sistema de Temas Adaptativos (`data-theme`)
1. **`/casa-brasa` (*Casa Brasa · Fuego, Cava & Autor*):**
   - **Arquitectura:** Escenario **Multi-Sede (2 sedes en Bogotá: Parque de la 93 y Zona G)** con diferenciales por sede, platos exclusivos, 3 salones con galerías múltiples, 3 paquetes comerciales y domicilios directos.
   - **Tema Editorial:** `data-theme="brasa-roble"` · `brand_icon="flame"` · `hero_style="immersive-dark"`.
2. **`/botanica-brunch` (*Botánica · Cocina de Huerta & Invernadero*):**
   - **Arquitectura:** Escenario **Sede Única (1 establecimiento en Usaquén, 2 salones internos, 2 paquetes comerciales)** con grilla adaptativa 50%/50% (`getAdaptiveThreeColumnGrid`) y **Split Editorial Horizontal** (`60%` galería interactiva + `40%` ficha compacta de sede/horarios) sin espacios vacíos ni selectores innecesarios de sede.
   - **Tema Editorial:** `data-theme="botanica-huerta"` · `brand_icon="leaf"` · `hero_style="sunlit-editorial"` con 8 fotografías editoriales propias en `public/demo/botanica-brunch/`.
3. **Arquetipos adicionales listos en `globals.css`:** `data-theme="mar-pacifico"` (`waves`) y `data-theme="cava-borgona"` (`wine`).
4. **`bistro-rival-test`:** Tenant oculto exclusivo para pruebas automatizadas de aislamiento RLS.

---

## 3. Mapa de Rutas y Módulos Completados (Iteraciones 1 a 6)

| Ruta | Módulo / Capacidades Activas |
| :--- | :--- |
| `/` | **Showcase Ejecutivo B2B & Conmutador Multi-Tenant:** Comparativa interactiva entre **Multi-Sede** (`/casa-brasa`) y **Sede Única** (`/botanica-brunch`) con accesos directos a Carta, Eventos y Consola Operativa. |
| `/[restaurantSlug]` | **Brand Hub Editorial Adaptable (`1` sede vs `N` sedes):** `generateMetadata` dinámico por tenant, hero adaptable (`immersive-dark` o `sunlit-editorial`), grilla elástica `1/2/3+` para platos insignia y salones, y vitrina fotográfica de sedes (`LocationsShowcase` con Split Horizontal 12 columnas para Sede Única). |
| `/[restaurantSlug]/menu` | **Carta Digital Inteligente & Motor de Pedidos 0% Comisión (Light-First):**<br>• Barra de categorías sticky calibrada al pixel (`top-[104px] lg:top-[69px]`, `0px` de solapamiento con el navbar en móvil, tablet `820px` y desktop).<br>• Grilla adaptable para categorías de 1 solo plato (tarjeta horizontal destacada) o múltiples platos.<br>• **Drawer Light-First (`bg-canvas-elevated`)** para lectura óptima a plena luz del día.<br>• **3 Modalidades:** `🍽️ En el Restaurante` (modo mostrar al mesero + divisor flexible `1–30` personas + propina 10%), `🛵 Pedir a Domicilio` (tarifa de envío, umbral de envío gratis, pedido mínimo, validación de platos exclusivos por sede) y `🛍️ Pasar a Recoger`.<br>• **3 Medios de Pago desde casa:** Efectivo (con calculadora de vueltas sin ceros a la izquierda), Tarjeta/Datáfono y Transferencia. |
| `/[restaurantSlug]/eventos` | **Dossier de Salones & Cotizador de Eventos (Light-First & Grilla Elástica 1/2/3):**<br>• Grillas adaptativas sin columnas vacías cuando el restaurante tiene 1 o 2 salones/paquetes.<br>• Tarjetas de paquetes y formulario `#solicitud-cotizacion-eventos` en estética **Light-First** (`bg-canvas-elevated` / `bg-surface-accent` con contraste WCAG AA/AAA).<br>• Soporte completo para franja **`breakfast` ("Mañana / Brunch 8:30 a. m. – 12:30 p. m.")** con auto-selección inteligente al elegir un paquete de Brunch.<br>• Prefijo dinámico de radicado por tenant (`CB-YYMM-XXXX` vs `BB-YYMM-XXXX`). |
| `/dashboard/[restaurantSlug]` | **Consola Operativa en Tiempo Real ("Mise en Place"):**<br>1. Control 1-clic de disponibilidad (`available`, `sold_out`, `hidden`) y edición de precios en vivo.<br>2. Bandeja de **Pedidos & Domicilios Directos** con indicador de ahorro en comisiones (~28%).<br>3. **Mini-CRM de Eventos** sincronizado con PostgreSQL.<br>4. **Generador de Códigos QR Reales (ISO/IEC 18004)** escaneables con cualquier cámara iOS/Android (`qrcode` con nivel `M`) en SVG descargable.<br>5. KPIs con `lining-nums` (`font-sans font-bold tabular-price`) y bitácora forense `public.audit_logs`. |

---

## 4. Contratos Críticos de PostgreSQL (Constraints Exactos — NO Desalinear)
- **`public.restaurant_members.role`:** `'owner' | 'admin' | 'editor'`
- **`public.products.availability_status`:** `'available' | 'sold_out' | 'hidden'`
- **`public.event_inquiries.preferred_time_slot` (`event_inquiries_time_slot_check`):** `'breakfast' | 'lunch' | 'afternoon' | 'dinner' | 'full_day'`
- **`public.event_inquiries.status` (`event_inquiries_status_check`):** `'received' | 'contacted' | 'quoted' | 'confirmed' | 'rejected' | 'archived'`
- **`public.direct_orders.fulfillment_type`:** `'dine_in' | 'delivery' | 'pickup'`
- **`public.direct_orders.payment_method`:** `'cash' | 'card_dataphone' | 'transfer'`
- **`public.direct_orders.status`:** `'received' | 'preparing' | 'dispatched' | 'completed' | 'cancelled'`
- **`public.audit_logs.entity_id`:** Tipo **`uuid` nativo** (nunca enviar `::text`).

---

## 5. Reglas de Higiene UX & Flujo de Trabajo
1. **Inputs Numéricos y Mobile Zoom:** Usar siempre `sanitizeNumericInput` de `src/lib/utils.ts` con `type="text" inputMode="numeric"` y `text-base sm:text-sm` (`16px` en móvil) para impedir ceros a la izquierda (`015`, `04`) y evitar el auto-zoom forzado de iOS Safari.
2. **Grillas Elásticas Multi-Tenant:** Usar siempre `getAdaptiveThreeColumnGrid(count)` de `src/lib/utils.ts` en secciones de 3 columnas para que tenants con 1 o 2 ítems nunca dejen un `33%` de pantalla vacío a la derecha.
3. **Verificación antes de cerrar cualquier iteración:**
   - `npm run typecheck` (`0` errores)
   - `npm run test` (Vitest + pruebas reales de bloqueo RLS anónimo sobre `event_inquiries` y `direct_orders`)
   - `node scripts/playwright-audit.mjs` (auditoría E2E móvil `390px` + tablet `820px` + desktop `1440px`)
4. **Próximos Hitos Sugeridos (Backlog Evolutivo):**
   - **Iteración 7:** Autenticación real Supabase Auth (Magic Link / Email + Password) para dueños/administradores + onboarding guiado para crear un restaurante nuevo desde la interfaz + subida de fotos a Supabase Storage (`restaurant-media`).
   - **Iteración 8:** Horarios automáticos de apertura/cierre para domicilios (bloquear checkout fuera de horario o permitir programar pedido) + impresión de comanda térmica 80mm desde la Consola Operativa.
