# ESTADO DEL PROYECTO Y PROTOCOLO DE HANDOFF (`fenbapps-restaurants-menu`)

> **Propósito de este documento:** Fuente única de verdad técnica, arquitectónica y comercial para evitar cualquier pérdida de contexto, regresión o alucinación entre sesiones. Si inicias un chat nuevo o ejecutas `/compact`, indica al agente:  
> *"Lee `ESTADO_PROYECTO_Y_HANDOFF.md` antes de analizar o tocar código."*

---

## 1. Infraestructura Activa
- **Repositorio GitHub:** `https://github.com/WilliamLop/fenbapps-menu.git` (rama `main`)
- **Stack:** Next.js 15 App Router (Turbopack/Webpack) · React 19 · TypeScript estricto (`noUncheckedIndexedAccess`) · Tailwind CSS v4 · Zod · Supabase PostgreSQL (`@supabase/ssr` / `@supabase/supabase-js`) · `qrcode` (ISO/IEC 18004) · Vitest + Playwright.
- **Proyecto Supabase:** `gssikxqasqjbyvcdccgl` (`https://gssikxqasqjbyvcdccgl.supabase.co`)
- **Auditoría de Seguridad Supabase:** `0` lints en Supabase Security Advisors (`{"result":{"lints":[]}}`).
- **Seguridad en Capa de Datos:** `FORCE ROW LEVEL SECURITY` en todas las tablas públicas. Separación estricta de políticas `SELECT` para rol `anon` y rol `authenticated`. Funciones transaccionales y de validación aisladas en el esquema `private` con invocación segura vía wrappers `SECURITY INVOKER` en `public`.

---

## 2. Modelo Comercial de 2 Ejes (Fenbapps Hospitality SaaS)

Implementado y validado en PostgreSQL (`public.restaurant_entitlements`), con control administrativo en `/super-admin`, cálculo dinámico de MRR y simulador efímero en vivo (`LivePlanSimulator` / `Shift+P`):

### Eje 1: Diseño Web a Medida (Pago Único de Implementación)
1. **`basic` (Diseño Basic - \$1.200.000 COP ref.):** Adaptación cromática a la marca, tipografía editorial curada, estructura limpia y carga inicial de carta.
2. **`standard` (Diseño Standard - \$1.950.000 COP ref.):** Dirección de arte personalizada, hero a medida (`immersive-dark` o `sunlit-editorial`), curaduría visual de salones y optimización fotográfica.
3. **`premium` (Diseño Premium Bespoke - \$3.200.000 COP ref.):** Arquitectura visual de autor para grupos gastronómicos multi-ciudad/sede, storytelling exclusivo y curaduría integral.

### Eje 2: Motor SaaS y Funcionalidades Operativas (Membresía Mensual Recurrente por Sede Activa)
Fórmula de cobro mensual recurrente por tenant:
$$\text{MRR} = \text{monthly\_base\_fee} + \max(0, \text{active\_locations} - 1) \times \text{extra\_location\_fee}$$

| Nivel de Plan | Tarifa Base Mensual | Tarifa Sede Extra | Módulos & Capacidades Incluidas |
| :--- | :--- | :--- | :--- |
| **`basic` (Plan Basic)** | \$149.000 COP/mes | +\$89.000 COP/mes | Carta digital pública con buscador y filtros dietarios, Modo Mesa QR (pre-selección, división de cuenta `1–30` pax y propina sugerida), Consola Operativa con agotados en 1 clic y cambio de precios, generador de códigos QR ISO/IEC 18004. |
| **`standard` (Plan Standard)** | \$249.000 COP/mes | +\$129.000 COP/mes | Todo lo de Basic + Checkout Directo a Domicilio y Para Recoger (0% comisión), calculadora de vueltas en efectivo, datáfono, Bre-B/Nequi por sede, bandeja de pedidos en tiempo real y motor de promociones. |
| **`full` (Plan Full)** | \$389.000 COP/mes | +\$169.000 COP/mes | Todo lo de Standard + Dossier de Salones Privados, Paquetes de Experiencias y Cotizador Interactivo, Mini-CRM de Eventos con estados comerciales y notas, Operación Multi-Ciudad/Multi-Sede aislada sin mezcla en CRM y bitácora forense `audit_logs` con `location_id`. |

### Estados de Suscripción & Modo Vitrina Estática (`vitrine_only`)
1. **`active`:** Membresía al día. Todos los módulos contratados operan al 100%.
2. **`past_due_grace`:** Periodo de gracia por mora reciente. Mantiene la operación activa mientras notifica al operador en el CRM.
3. **`vitrine_only` (Modo Vitrina Estática Congelada):**
   - Se activa si el cliente no cancela la mensualidad recurrente.
   - **Garantía comercial:** Su página web de marca (pago único) y la lectura de su carta digital permanecen 100% en línea para que **ningún código QR impreso en mesas, empaques o redes arroje error 404**.
   - **Bloqueo quirúrgico:** Se congela el carrito en mesa, los pedidos a domicilio, el cotizador de eventos y las mutaciones de precios/agotados en la Consola Operativa, tanto en interfaz como respaldado por PostgreSQL RLS y RPC. El cobro facturable pasa a \$0 COP.
4. **`suspended`:** Suspensión total mostrando pantalla informativa neutra de mantenimiento.

---

## 3. Aislamiento Operativo Multi-Ciudad & Multi-Sede (Zero Mixing)

Para grupos gastronómicos con sedes en una o varias ciudades (ej. **Casa Brasa con 2 sedes en Bogotá + 1 sede en Medellín**):

1. **Selector Jerárquico Ciudad → Sede en la Web Pública:**
   - La carta digital y el cotizador de eventos permiten filtrar por ciudad (`Todas las ciudades` \| `Bogotá (2)` \| `Medellín (1)`) y seleccionar la sede de atención.
2. **Catálogo & Precios Regionales Independientes (`public.product_locations`):**
   - Cada producto tiene su precio base global (`public.products.base_price`), pero puede tener un `price_override` regional (ej. Pulpo a \$64.000 en Bogotá y \$62.000 en Medellín) o estar marcado como `sold_out` exclusivamente en una sede sin afectar la disponibilidad en las demás.
3. **Logística y Cuentas Bancarias por Sede (`locations.delivery_config`):**
   - Costo de domicilio, umbral de envío gratis, pedido mínimo, teléfono de WhatsApp y datos de transferencia bancaria / llave Bre-B se configuran y aplican por sede (ej. `@casabrasamed` en Medellín vs cuenta Bancolombia Bogotá).
4. **Consola Operativa Aislada (`/dashboard/[slug]?sede=[sede-slug]`):**
   - El dueño o director general visualiza el **Consolidado Global** (`/dashboard/casa-brasa`).
   - Cada administrador de punto de venta opera su **Sede Específica** (`/dashboard/casa-brasa?sede=medellin-provenza`):
     - **Pestaña 1 (Platos & Precios):** Agota platos o cambia precios exclusivamente en su sede (`product.location_operational_update`).
     - **Pestaña 2 (Pedidos Directos):** Recibe y despacha únicamente los pedidos asignados a su cocina (`CB-DOM-MDE1`).
     - **Pestaña 3 (Mini-CRM Eventos):** Gestiona únicamente las solicitudes para sus salones (`CB-2611-MDE9`).
     - **Pestaña 4 (Generador QR):** Emite códigos QR ISO/IEC 18004 pre-filtrados en su sede.
   - Las pestañas no contratadas según el plan muestran un **Badge de Bloqueo (`🔒 Plan Standard+` / `🔒 Plan Full`)** con una tarjeta ejecutiva de previsualización de upgrade y enlace a `/super-admin`.

---

## 4. Escenarios Demo Sembrados en Base de Datos

1. **`/casa-brasa` (*Casa Brasa · Fuego, Brasa & Autor*):**
   - **Escenario Multi-Ciudad (2 Ciudades · 3 Sedes Activas):**
     - Sede 1: *Sede Parque de la 93* (Bogotá · Calle 93A # 12-24).
     - Sede 2: *Sede Zona G · Quinta Camacho* (Bogotá · Calle 69A # 5-48).
     - Sede 3: *Sede Provenza · El Poblado* (Medellín · Carrera 35 # 8A-42).
   - **Salones Privados:** 4 salones (*Cava Subterránea*, *Gran Salón de Roble*, *Terraza & Asador al Aire Libre*, *Rooftop del Bosque · Provenza*).
   - **Paquetes:** 3 experiencias corporativas y de celebración.
   - **Entitlements:** Plan `full`, Diseño `premium`, Estado `active`.
2. **`/botanica-brunch` (*Botánica · Cocina de Huerta & Invernadero*):**
   - **Escenario Sede Única (1 Establecimiento):**
     - Sede: *Casa Botánica · Usaquén* (Bogotá · Calle 119B # 6-28).
   - **Salones Internos:** 2 salones (*El Invernadero de Cristal*, *Salón de la Chimenea*).
   - **Paquetes:** 2 experiencias de brunch y cena de huerta.
   - **Entitlements:** Plan `full`, Diseño `standard`, Estado `active`.
3. **`bistro-rival-test`:** Tenant oculto para pruebas automatizadas de aislamiento RLS.

---

## 5. Mapa de Rutas de la Plataforma

| Ruta | Propósito & Capacidades |
| :--- | :--- |
| `/` | **Showcase Plataforma SaaS & Conmutador B2B:** Demostración comercial del modelo de 2 ejes, enlace al panel `/super-admin` y conmutador entre Casa Brasa (Multi-Ciudad) y Botánica (Sede Única). |
| `/super-admin` | **Centro de Control Super-Admin (Fenbapps Hospitality):** Métricas consolidadas de MRR y Setup cobrado, conmutadores en vivo de plan (`basic`, `standard`, `full`), diseño (`basic`, `standard`, `premium`), estado de suscripción (`active`, `past_due_grace`, `vitrine_only`, `suspended`), límites de sedes y feature flags granulares con persistencia directa en PostgreSQL. |
| `/[restaurantSlug]` | **Brand Hub Editorial:** Identidad visual adaptativa (`data-theme`), vitrina de sedes con filtrado Multi-Ciudad y Split Horizontal para sede única. Admite `?plan=` para simulación efímera. |
| `/[restaurantSlug]/menu` | **Carta Digital Inteligente & Domicilios 0%:** Navegación por categorías sticky sin solapamiento, selector Ciudad → Sede, precios regionales, validación de platos agotados por sede, y Drawer de Pedidos / Modo Mesa adaptado al plan activo. Admite `?plan=` y `?sede=`. |
| `/[restaurantSlug]/eventos` | **Dossier de Salones & Cotizador Interactivo:** Filtro Multi-Ciudad de salones, calculadora presupuestal y formulario de radicación con validación Zero-Trust de fecha futura y Habeas Data. Bloqueado limpiamente si el plan no incluye eventos (sin error 404). Admite `?plan=` y `?sede=`. |
| `/dashboard/[restaurantSlug]` | **Consola Operativa Aislada ("Mise en Place"):** Barra de contexto Multi-Ciudad/Sede, edición de precios globales o regionales, 1-clic para agotar platos por sede, bandejas aisladas de pedidos y eventos, generador QR ISO/IEC 18004 contextual y banner ejecutivo en Modo Vitrina. Admite `?sede=` y `?plan=`. |

---

## 6. Contratos de Base de Datos & RPCs Clave (PostgreSQL)

- **`private.has_active_feature(p_restaurant_id uuid, p_feature_key text)`:** Resuelve disponibilidad de features combinando plan, suscripción y overrides.
- **`private.insert_validated_direct_order(...)`:** Valida y recalcula en servidor precios reales según sede seleccionada (`product_locations`), costo de envío, pedido mínimo y feature flag `direct_orders`. Genera radicado `CB-DOM-XXXX`.
- **`private.insert_validated_event_inquiry(...)`:** Valida tenencia de salón/paquete por sede, fecha futura y feature flag `events_crm`. Genera radicado `CB-YYMM-XXXX`.
- **`public.get_operational_console_snapshot(p_restaurant_slug text, p_location_id uuid DEFAULT NULL)`:** Entrega el snapshot operativo aislado para la sede indicada (o global de marca si es `NULL`).
- **`public.update_product_operational_state(p_restaurant_slug, p_product_id, p_availability_status, p_base_price, p_location_id DEFAULT NULL)`:** Actualiza precio o disponibilidad a nivel de sede (`product_locations`) o maestro global con registro en `audit_logs`.
- **`public.super_admin_list_tenants()`:** Lista métricas, sedes y configuración de entitlements de todos los restaurantes para el panel `/super-admin`.
- **`public.super_admin_update_entitlements(...)`:** Persiste cambios comerciales en `restaurant_entitlements`.

---

## 7. Próximas Fases Planificadas (Backlog Quirúrgico)

### Fase 2: Filtros Avanzados en Catálogo CRM & CRUD Completo de Carta (Próxima Sesión)
- **Filtros Avanzados en Pestaña 1:** Barra de filtrado facetado para restaurantes con 100+ platos (por categoría, rango de precio, estado `available`/`sold_out`/`hidden`, platos con precio regional modificado y buscador semántico).
- **CRUD Completo de Categorías & Platos:**
  - Crear, editar y reordenar categorías (`public.categories`).
  - Modal de creación/edición de plato: nombre, descripción, porción, categoría, precio base, insignias (`is_featured`, `is_chef_choice`), imagen y grupos de opciones/modificadores (`product_option_groups` / `product_options`).
  - Eliminación segura con verificación de integridad referencial.

### Fase 3: Promociones, Combos & Happy Hour por Sede (Futura Sesión)
- **Promociones Dinámicas:** Precios tachados ("Antes \$X / Ahora \$Y") programables con fecha de inicio y fin.
- **Combos Personalizables:** Plato fuerte + acompañamiento + bebida con descuento consolidado y control de stock enlazado (`linked_product_id`).
- **Horarios Promocionales (Happy Hour):** Activación automática según hora de Colombia (`America/Bogota`).
