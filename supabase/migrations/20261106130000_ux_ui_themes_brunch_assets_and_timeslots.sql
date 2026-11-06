-- ============================================================================
-- Migration: 20261106130000_ux_ui_themes_brunch_assets_and_timeslots.sql
-- Purpose:
--   1. Support morning/brunch events ('breakfast') in public.event_inquiries.
--   2. Enrich multi-tenant theme_config (palette, brandIcon, heroStyle, badges).
--   3. Replace cross-brand dark bar/steakhouse photos on botanica-brunch with
--      bespoke sunlit botanical photography and clean single-location naming.
--   4. Calibrate is_featured hierarchy on event_packages (1 flagship per brand)
--      and add authentic Brunch & Specialty Coffee category/items to Botánica.
-- ============================================================================

-- 1. Expand preferred_time_slot constraint to include 'breakfast' (Mañana / Brunch)
ALTER TABLE public.event_inquiries
  DROP CONSTRAINT IF EXISTS event_inquiries_preferred_time_slot_check;

ALTER TABLE public.event_inquiries
  ADD CONSTRAINT event_inquiries_preferred_time_slot_check
  CHECK (preferred_time_slot IN ('breakfast', 'lunch', 'afternoon', 'dinner', 'full_evening'));

-- Update Botánica's demo brunch inquiry to showcase the morning/brunch slot
-- (Customer test inquiries such as CB-2611-6622 remain 100% untouched)
UPDATE public.event_inquiries
SET preferred_time_slot = 'breakfast'
WHERE reference_code = 'BH-2611-3092';

-- 2. Enrich Multi-Tenant Theme Configurations
UPDATE public.restaurants
SET theme_config = COALESCE(theme_config, '{}'::jsonb) || jsonb_build_object(
  'palette', 'brasa-roble',
  'brandIcon', 'flame',
  'heroStyle', 'immersive-dark',
  'heroImage', '/demo/casa-brasa/hero-steak.jpg',
  'signatureBadgeLabel', 'Corte Insignia',
  'searchPlaceholder', 'Buscar corte, entrada, cóctel o ingrediente...',
  'authenticityBadge', 'Fotografía real de nuestra cocina · Dirección visual certificada'
)
WHERE slug = 'casa-brasa';

UPDATE public.restaurants
SET theme_config = COALESCE(theme_config, '{}'::jsonb) || jsonb_build_object(
  'palette', 'botanica-huerta',
  'brandIcon', 'leaf',
  'heroStyle', 'sunlit-editorial',
  'heroImage', '/demo/botanica-brunch/hero-greenhouse-brunch.jpg',
  'signatureBadgeLabel', 'Insignia de la Huerta',
  'searchPlaceholder', 'Buscar brunch, plato de huerta, café o vino natural...',
  'authenticityBadge', 'Cocina orgánica de estación · Invernadero en Usaquén'
)
WHERE slug = 'botanica-brunch';

-- 3. Deduplicate & Assign Authentic Location Photography + Clean Single-Location Title
UPDATE public.locations l
SET
  name = 'Casa Botánica · Usaquén',
  cover_image_url = '/demo/botanica-brunch/sede-casona-usaquen.jpg',
  gallery_urls = '["/demo/botanica-brunch/sede-casona-usaquen.jpg", "/demo/botanica-brunch/salon-invernadero-cristal.jpg", "/demo/botanica-brunch/hero-greenhouse-brunch.jpg", "/demo/botanica-brunch/salon-biblioteca-chimenea.jpg"]'::jsonb
FROM public.restaurants r
WHERE l.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND l.slug = 'casa-botanica-usaquen';

UPDATE public.locations l
SET
  cover_image_url = '/demo/casa-brasa/salon-gallery-3.jpg',
  gallery_urls = '["/demo/casa-brasa/salon-gallery-3.jpg", "/demo/casa-brasa/salon-cava-cristal.jpg", "/demo/casa-brasa/salon-terraza-fuego.jpg", "/demo/casa-brasa/salon-gallery-2.jpg"]'::jsonb
FROM public.restaurants r
WHERE l.restaurant_id = r.id
  AND r.slug = 'casa-brasa'
  AND l.slug = 'parque-93';

-- 4. Assign Sunlit Botanical Salon Photography to Botánica Event Spaces
UPDATE public.event_spaces es
SET
  cover_image_url = '/demo/botanica-brunch/salon-invernadero-cristal.jpg',
  gallery_urls = '["/demo/botanica-brunch/salon-invernadero-cristal.jpg", "/demo/botanica-brunch/hero-greenhouse-brunch.jpg", "/demo/botanica-brunch/dish-sourdough-poche.jpg", "/demo/botanica-brunch/sede-casona-usaquen.jpg"]'::jsonb
FROM public.restaurants r
WHERE es.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND es.slug = 'invernadero-de-cristal';

UPDATE public.event_spaces es
SET
  cover_image_url = '/demo/botanica-brunch/salon-biblioteca-chimenea.jpg',
  gallery_urls = '["/demo/botanica-brunch/salon-biblioteca-chimenea.jpg", "/demo/botanica-brunch/dish-rigatoni-truffle.jpg", "/demo/botanica-brunch/dish-asparagus-stracciatella.jpg", "/demo/botanica-brunch/sede-casona-usaquen.jpg"]'::jsonb
FROM public.restaurants r
WHERE es.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND es.slug = 'salon-de-la-chimenea';

-- 5. Calibrate Event Package Visual Hierarchy (1 Flagship Highlight per Tenant) & Cover Photos
UPDATE public.event_packages ep
SET is_featured = (ep.slug = 'experiencia-corporativa-mesa-de-fuego')
FROM public.restaurants r
WHERE ep.restaurant_id = r.id
  AND r.slug = 'casa-brasa';

UPDATE public.event_packages ep
SET
  is_featured = true,
  cover_image_url = '/demo/botanica-brunch/hero-greenhouse-brunch.jpg'
FROM public.restaurants r
WHERE ep.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND ep.slug = 'celebracion-brunch-en-el-invernadero';

UPDATE public.event_packages ep
SET
  is_featured = false,
  cover_image_url = '/demo/botanica-brunch/salon-biblioteca-chimenea.jpg'
FROM public.restaurants r
WHERE ep.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND ep.slug = 'cena-ejecutiva-o-maridaje-privado';

-- 6. Fix Dish Photography & Add Authentic Morning Brunch Category + Products for Botánica
UPDATE public.products p
SET image_url = '/demo/botanica-brunch/dish-rigatoni-truffle.jpg'
FROM public.restaurants r
WHERE p.restaurant_id = r.id
  AND r.slug = 'casa-brasa'
  AND p.slug = 'mac-and-cheese-trufado-al-horno-de-lena';

UPDATE public.products p
SET
  image_url = '/demo/botanica-brunch/dish-asparagus-stracciatella.jpg',
  is_featured = true
FROM public.restaurants r
WHERE p.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND p.slug = 'esparragos-y-portobellos-huerta';

UPDATE public.products p
SET
  image_url = '/demo/botanica-brunch/dish-rigatoni-truffle.jpg',
  is_featured = false
FROM public.restaurants r
WHERE p.restaurant_id = r.id
  AND r.slug = 'botanica-brunch'
  AND p.slug = 'gratinado-quesos-artesanales-y-trufa';

DO $brunch$
DECLARE
  v_bot_id uuid;
  v_menu_id uuid;
  v_cat_brunch_id uuid;
BEGIN
  SELECT id INTO v_bot_id FROM public.restaurants WHERE slug = 'botanica-brunch';
  SELECT id INTO v_menu_id FROM public.menus WHERE restaurant_id = v_bot_id AND slug = 'carta-huerta-y-horno';

  IF v_bot_id IS NOT NULL AND v_menu_id IS NOT NULL THEN
    INSERT INTO public.categories (
      restaurant_id, menu_id, slug, name, subtitle, description, display_mode, is_active, sort_order
    ) VALUES (
      v_bot_id,
      v_menu_id,
      'brunch-y-cafe-especialidad',
      'Brunch de Huerta & Café de Especialidad',
      'Servido todos los días de 8:30 a. m. a 1:00 p. m. en el invernadero y terraza',
      'Huevos de pastoreo libre, hogazas de masa madre fermentadas 48 horas, bollería tibia de cardamomo y café de origen.',
      'editorial_grid',
      true,
      0
    )
    ON CONFLICT (menu_id, slug) DO UPDATE SET
      name = EXCLUDED.name,
      subtitle = EXCLUDED.subtitle,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      is_active = true
    RETURNING id INTO v_cat_brunch_id;

    INSERT INTO public.products (
      restaurant_id, category_id, slug, name, short_description, long_description,
      base_price, image_url, image_alt, availability_status, is_featured, is_new, is_chef_choice,
      badges, portion_label, pairing_note, sort_order
    ) VALUES
    (
      v_bot_id,
      v_cat_brunch_id,
      'tostada-masa-madre-aguacate-poche',
      'Tostada de Masa Madre, Aguacate Hass & Poché',
      'Hogaza rústica de 48h con aguacate Hass machacado, huevos poché de pastoreo, rábanos encurtidos y brotes del huerto.',
      'Horneamos nuestra hogaza de trigo orgánico cada madrugada en horno de barro; la coronamos con aguacate cremoso del Tolima, dos huevos poché a punto líquido, semillas tostadas y aceite extravirgen infusionado en hierbas.',
      38000,
      '/demo/botanica-brunch/dish-sourdough-poche.jpg',
      'Tostada artesanal de masa madre con aguacate Hass y huevos poché en invernadero',
      'available',
      true,
      false,
      true,
      ARRAY['Insignia de la Huerta', 'Masa Madre 48h', 'Vegetariano'],
      '240g · Brunch Matutino',
      'Acompáñala con nuestro Matcha Ceremonial Helado o una Mimosa de Mandarina Orgánica.',
      1
    ),
    (
      v_bot_id,
      v_cat_brunch_id,
      'matcha-ceremonial-helado-cardamomo',
      'Matcha Ceremonial Helado & Nudo de Cardamomo',
      'Matcha japonés grado ceremonial batido al momento sobre leche de avena artesanal, acompañado de nuestro rollo tibio de cardamomo.',
      'Importamos nuestro té verde de primera cosecha en Uji (Kioto), batido con chasen de bambú sin azúcar añadida y servido junto a un nudo sueco hojaldrado con mantequilla avellanada y cardamomo recién molido.',
      26000,
      '/demo/botanica-brunch/dish-iced-matcha-coffee.jpg',
      'Matcha latte ceremonial helado en capas junto a rollo artesanal de cardamomo',
      'available',
      false,
      true,
      false,
      ARRAY['Uji Ceremonial', 'Leche Vegetal', 'Horneado Hoy'],
      '12 oz + Bollería tibia',
      'Ideal para abrir la mañana en la luz natural de nuestro patio central.',
      2
    )
    ON CONFLICT (category_id, slug) DO UPDATE SET
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      long_description = EXCLUDED.long_description,
      base_price = EXCLUDED.base_price,
      image_url = EXCLUDED.image_url,
      image_alt = EXCLUDED.image_alt,
      is_featured = EXCLUDED.is_featured,
      is_new = EXCLUDED.is_new,
      is_chef_choice = EXCLUDED.is_chef_choice,
      badges = EXCLUDED.badges,
      portion_label = EXCLUDED.portion_label,
      pairing_note = EXCLUDED.pairing_note,
      sort_order = EXCLUDED.sort_order;
  END IF;
END;
$brunch$;
