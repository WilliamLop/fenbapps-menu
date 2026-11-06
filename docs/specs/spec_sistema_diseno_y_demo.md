# Especificación del Sistema de Diseño y Marca Demo: *"Casa Brasa — Fuego, Corte & Salón"*

> **Dirección Estética:** Hospitalidad Editorial Nocturna & Cálida (Arquetipo 1: *Fuego, Brasa & Autor*)  
> **Prioridad Visual:** Lucimiento de fotografía gastronómica real de alta gama (iPhone 17 Pro Max + Dirección Visual IA fiel al plato) + Tipografía de carta de autor.

---

## 1. Identidad de la Demostración Comercial: *"Casa Brasa"*

Para que nuestra demostración convenza al dueño de un restaurante real en los primeros 15 segundos desde su teléfono o portátil, la marca ficticia tendrá una identidad gastronómica completa, verosímil y claramente identificada como demostración interactiva de la plataforma:

- **Nombre Comercial Demo:** **Casa Brasa** — *Cocina de Leña, Maduración & Salones Privados*
- **Propuesta Gastronómica:** Cortes seleccionados madurados en casa, pesca del día al horno de leña, vegetales al rescoldo, cava de vinos y coctelería de autor ahumada.
- **Sedes en la Demo (Para demostrar capacidad Multi-Sede):**
  1. **Sede Parque de la 93 (Principal):** Salón Principal, Cava Privada de Cristal (hasta 18 personas) y Terraza de Fuego (hasta 45 personas).
  2. **Sede Zona G (Quinta Camacho):** Casona patrimonial con Salón de Eventos Corporativos y Celebraciones (hasta 70 personas).
- **Por qué este concepto maximiza tus habilidades visuales:**
  - Las texturas de brasa, el marmoleo de los cortes, los glaseados brillantes y la cristalería de coctelería lucen espectaculares con fotografía de **iPhone 17 Pro Max + dirección de iluminación/fondo IA respetando el producto real**.
  - Al mismo tiempo, incluye una sección de *Cava de Vinos, Destilados y Adiciones* que demostraremos en formato **Carta Tipográfica Impresa (sin foto)**, probando que el sistema luce de lujo en ambos mundos.

---

## 2. Sistema de Tokens de Color en `OKLCH` (Tailwind CSS v4)

Separaremos los tokens en dos atmósferas para que el visitante público sienta calidez gastronómica y el administrador en el dashboard sienta claridad operativa:

### 2.1 Atmósfera Pública: *Carbón Cálido, Piedra & Cobre Brasa*
Diseñada en un modo dual editorial: secciones de bienvenida y eventos en **Carbón Obsidiana Cálido** (que hace que las fotos de comida brillen como en una mesa iluminada con luz cálida puntual) y cuerpo de lectura de carta en **Papel Algodón Cálido** para máxima legibilidad bajo cualquier luz (incluso en terrazas al mediodía):

| Token Semántico | Valor `OKLCH` (Superficie Clara de Carta) | Valor `OKLCH` (Superficie Nocturna / Hero & Eventos) | Uso |
|---|---|---|---|
| `--surface-canvas` | `oklch(97.5% 0.008 75)` (*Papel Hueso Cálido*) | `oklch(16% 0.012 45)` (*Carbón Leña*) | Fondo principal de página |
| `--surface-card` | `oklch(99.2% 0.004 75)` (*Crema Puro*) | `oklch(20% 0.014 45)` (*Piedra Volcánica*) | Tarjetas de plato y fichas de salón |
| `--text-primary` | `oklch(18% 0.015 45)` (*Tinta Espresso*) | `oklch(96% 0.008 75)` (*Marfil*) | Nombres de platos, titulares y precios |
| `--text-secondary` | `oklch(42% 0.015 50)` (*Piedra Tostada*) | `oklch(74% 0.012 65)` (*Ceniza Cálida*) | Descripciones de ingredientes y notas |
| `--accent-ember` | `oklch(55% 0.165 38)` (*Terracota Brasa*) | `oklch(64% 0.175 42)` (*Ámbar Brasa*) | CTAs principales, categoría activa, destacados |
| `--accent-gold` | `oklch(72% 0.11 78)` (*Bronce / Cobre*) | `oklch(78% 0.12 80)` (*Oro Viejo*) | Badges de "Recomendado del Chef", bordes sutiles |
| `--border-hairline` | `oklch(89% 0.012 70)` | `oklch(28% 0.015 45)` | Líneas divisorias editoriales de `1px` |

### 2.2 Atmósfera del Dashboard Administrativo: *"Mise en Place" (Precisión Funcional)*
- Fondo neutro de fatiga visual cero (`oklch(98.5% 0.003 260)`), tarjetas blancas con borde `1px` (`oklch(91% 0.006 260)`), indicadores semánticos de alta legibilidad:
  - **Disponible / Confirmado:** Verde Salvia Profundo (`oklch(52% 0.14 155)`) + icono explícito.
  - **Agotado hoy / Pendiente de cotizar:** Ámbar Tostado (`oklch(62% 0.16 65)`) + badge claro.
  - **Archivado / Rechazado:** Rojo Ladrillo Sobrio (`oklch(54% 0.19 28)`).

---

## 3. Sistema Tipográfico y Reglas Numéricas

| Rol Tipográfico | Familia Recomendada (`next/font/google`) | Reglas de Composición |
|---|---|---|
| **Display / Editorial (`--font-display`)** | **Cormorant Garamond** (o **Instrument Serif** / **Playfair Display**) | Títulos de sección, nombres de salones de eventos y encabezados de carta. `tracking-tight`, `leading-[1.08]`. |
| **UI & Lectura de Ingredientes (`--font-sans`)** | **Plus Jakarta Sans** (o **DM Sans**) | Nombres de platos, descripciones, botones, filtros y todo el Dashboard administrativo. |
| **Precios, Aforos y Códigos (`--font-mono` / Tabular)** | **JetBrains Mono** o `tabular-nums` en Sans | **Regla obligatoria:** Todo precio (`$ 68.000`), capacidad (`15 – 45 inv.`) y código de solicitud (`CB-2026-8492`) usa `font-variant-numeric: tabular-nums` para alineación vertical perfecta. |

---

## 4. Tratamiento Especializado para Fotografía de Producto Real + IA

Dado que tu diferencial comercial incluye tomar la foto real del plato con **iPhone 17 Pro Max** y aplicar dirección visual asistida por IA manteniendo fidelidad absoluta al plato:

1. **Proporciones Estandarizadas sin Recortes Destructivos:**
   - **Platos Principales y Destacados:** Relación `4:3` horizontal o `1:1` cuadrada consistente por categoría, con `object-cover` y punto focal centrado.
   - **Detalle de Plato (Drawer / Modal):** Imagen expandible a ancho completo con alta densidad de píxeles (`srcset` optimizado en Next.js `<Image />` hasta `1200px` en WebP/AVIF) para que el comensal aprecie el término de la carne, el brillo de la salsa y el emplatado real.
   - **Salones de Eventos:** Relación panorámica `16:10` para mostrar amplitud arquitectónica y montaje de mesas.
2. **Firma de Transparencia Gastronómica (Micro-detalle de confianza):**
   - Opcionalmente configurable por restaurante: un sello discreto en la carta o detalle (*"Fotografía real de nuestra cocina"*), reforzando ante el comensal que lo que ve en pantalla es exactamente lo que llega a su mesa.
3. **Convivencia Armónica con Ítems sin Foto (`display_mode: 'compact_list'`):**
   - En categorías como *Cava de Vinos*, *Cervezas Artesanales* o *Guarniciones Adicionales*, la interfaz cambia automáticamente al formato **Carta Impresa a Dos Columnas**:
     ```
     Ribeye Angus Certificado (400g) ............................ $ 118.000
     Maduración de 28 días, mantequilla de tuétano y sal marina.
     ```
     Nunca aparecerá un recuadro gris con un ícono de cámara tachada.

---

## 5. Criterios de Calidad UX y Microinteracciones (`Framer Motion` con moderación)

- **Regla de Oro de QR ("Zero-Splash"):** Escanear el QR abre `/[restaurantSlug]/menu` directamente con las categorías y platos listos para tocar en `< 1.0s`.
- **Áreas Táctiles:** Mínimo `44×44px` en cada píldora de categoría, botón de filtro y tarjeta de plato.
- **Sincronización de Categorías (`ScrollSpy`):** Al hacer scroll vertical por la carta, la barra horizontal superior resalta suavemente la categoría actual; al tocar una categoría, hace scroll suave con compensación exacta de cabecera (`scroll-margin-top`).
- **Estados Vacíos y Agotados:** Un plato con `availability_status = 'sold_out'` permanece visible (para que el cliente habitual sepa que existe en la carta), pero muestra el badge **"Agotado por hoy"**, atenúa su fotografía sutilmente y deshabilita confusiones.
- **Accesibilidad:** Soporte completo de `prefers-reduced-motion` (desactivando animaciones de desplazamiento si el sistema operativo del usuario lo solicita), contraste mínimo `4.5:1` y navegación completa por teclado (`Escape` cierra cualquier Drawer o Modal).
