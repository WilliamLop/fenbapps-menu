-- ============================================================================
-- Migration: 20261106010000_interactive_console_rpcs_and_single_location_demo.sql
-- Purpose:
--   1. Create secure operational console RPCs for live catalog & event CRM
--      management (supporting authenticated members + interactive demo tenants,
--      while preserving strict RLS isolation and audit_logs traceability).
--   2. Seed a complete Single-Location Demo Tenant ('botanica-brunch') to
--      demonstrate adaptive single-location vs. multi-location UX in 1 click.
-- ============================================================================

-- 1. Operational Snapshot RPC for Dashboard (Products + Event Inquiries + Audit Logs)
CREATE OR REPLACE FUNCTION public.get_operational_console_snapshot(
  p_restaurant_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_has_access boolean := false;
  v_products jsonb;
  v_inquiries jsonb;
  v_audit_logs jsonb;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants r
  WHERE r.slug = lower(trim(p_restaurant_slug))
    AND r.is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Allow access if authenticated member OR if it is an interactive commercial demo
  -- (explicitly excluding 'bistro-rival-test' which is reserved for strict QA isolation tests)
  IF (v_restaurant.is_demo = true AND v_restaurant.slug <> 'bistro-rival-test') THEN
    v_has_access := true;
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = v_restaurant.id
      AND rm.user_id = auth.uid()
      AND rm.is_active = true
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acceso denegado a la consola operativa de este tenant' USING ERRCODE = '42501';
  END IF;

  -- Fetch all operational products (including 'hidden', excluding internal RLS test fixture)
  SELECT COALESCE(jsonb_agg(row_to_json(p_row)), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      p.id,
      p.slug,
      p.name,
      p.short_description,
      p.base_price,
      p.availability_status,
      p.is_featured,
      p.is_chef_choice,
      p.portion_label,
      p.image_url,
      p.category_id,
      c.name AS category_name,
      l.name AS exclusive_location_name,
      p.updated_at
    FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.locations l ON l.id = p.exclusive_location_id
    WHERE p.restaurant_id = v_restaurant.id
      AND p.slug <> 'corte-secreto-pruebas-internas'
    ORDER BY c.sort_order ASC, p.sort_order ASC
  ) p_row;

  -- Fetch latest 25 event inquiries for this restaurant
  SELECT COALESCE(jsonb_agg(row_to_json(i_row)), '[]'::jsonb)
  INTO v_inquiries
  FROM (
    SELECT
      ei.id,
      ei.reference_code,
      ei.event_type,
      ei.tentative_date,
      ei.preferred_time_slot,
      ei.guest_count,
      ei.customer_name,
      ei.customer_phone,
      ei.customer_email,
      ei.company_name,
      ei.special_requests,
      ei.status,
      ei.internal_admin_notes,
      ei.created_at,
      ei.updated_at,
      l.name AS location_name,
      es.name AS event_space_name,
      ep.name AS event_package_name,
      ep.base_price AS package_base_price
    FROM public.event_inquiries ei
    LEFT JOIN public.locations l ON l.id = ei.location_id
    LEFT JOIN public.event_spaces es ON es.id = ei.event_space_id
    LEFT JOIN public.event_packages ep ON ep.id = ei.event_package_id
    WHERE ei.restaurant_id = v_restaurant.id
    ORDER BY ei.created_at DESC
    LIMIT 25
  ) i_row;

  -- Fetch latest 12 forensic audit logs for this restaurant
  SELECT COALESCE(jsonb_agg(row_to_json(a_row)), '[]'::jsonb)
  INTO v_audit_logs
  FROM (
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.previous_state,
      al.new_state,
      al.created_at
    FROM public.audit_logs al
    WHERE al.restaurant_id = v_restaurant.id
    ORDER BY al.created_at DESC
    LIMIT 12
  ) a_row;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'restaurant_slug', v_restaurant.slug,
    'products', v_products,
    'inquiries', v_inquiries,
    'audit_logs', v_audit_logs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operational_console_snapshot(text) TO anon, authenticated;

-- 2. Operational Product Update RPC (1-Click Availability & Price Update + Audit Log)
CREATE OR REPLACE FUNCTION public.update_product_operational_state(
  p_restaurant_slug text,
  p_product_id uuid,
  p_availability_status text,
  p_base_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_has_access boolean := false;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants r
  WHERE r.slug = lower(trim(p_restaurant_slug))
    AND r.is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF (v_restaurant.is_demo = true AND v_restaurant.slug <> 'bistro-rival-test') THEN
    v_has_access := true;
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = v_restaurant.id
      AND rm.user_id = auth.uid()
      AND rm.is_active = true
      AND rm.role IN ('owner', 'admin', 'manager', 'editor')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el catálogo de este restaurante' USING ERRCODE = '42501';
  END IF;

  IF p_availability_status NOT IN ('available', 'sold_out', 'hidden') THEN
    RAISE EXCEPTION 'Estado de disponibilidad inválido' USING ERRCODE = '22023';
  END IF;

  IF p_base_price IS NULL OR p_base_price < 1000 OR p_base_price > 50000000 THEN
    RAISE EXCEPTION 'El precio debe estar entre $1.000 y $50.000.000' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en este restaurante' USING ERRCODE = 'P0002';
  END IF;

  IF v_product.slug = 'corte-secreto-pruebas-internas' THEN
    RAISE EXCEPTION 'Este producto de prueba de seguridad RLS no puede modificarse' USING ERRCODE = '42501';
  END IF;

  UPDATE public.products
  SET
    availability_status = p_availability_status,
    base_price = p_base_price,
    updated_at = now()
  WHERE id = v_product.id
    AND restaurant_id = v_restaurant.id;

  INSERT INTO public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    auth.uid(),
    'product.operational_update',
    'product',
    v_product.id::text,
    jsonb_build_object(
      'name', v_product.name,
      'availability_status', v_product.availability_status,
      'base_price', v_product.base_price
    ),
    jsonb_build_object(
      'name', v_product.name,
      'availability_status', p_availability_status,
      'base_price', p_base_price
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', v_product.id,
    'availability_status', p_availability_status,
    'base_price', p_base_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_product_operational_state(text, uuid, text, numeric) TO anon, authenticated;

-- 3. Operational Event Inquiry CRM Update RPC (Status + Internal Notes + Audit Log)
CREATE OR REPLACE FUNCTION public.update_event_inquiry_operational_state(
  p_restaurant_slug text,
  p_inquiry_id uuid,
  p_status text,
  p_internal_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_inquiry public.event_inquiries%ROWTYPE;
  v_has_access boolean := false;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants r
  WHERE r.slug = lower(trim(p_restaurant_slug))
    AND r.is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF (v_restaurant.is_demo = true AND v_restaurant.slug <> 'bistro-rival-test') THEN
    v_has_access := true;
  ELSIF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = v_restaurant.id
      AND rm.user_id = auth.uid()
      AND rm.is_active = true
      AND rm.role IN ('owner', 'admin', 'manager')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar solicitudes de eventos de este restaurante' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('received', 'reviewing', 'quoted', 'confirmed_deposit', 'declined', 'completed') THEN
    RAISE EXCEPTION 'Estado de solicitud inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inquiry
  FROM public.event_inquiries ei
  WHERE ei.id = p_inquiry_id
    AND ei.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de evento no encontrada en este restaurante' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.event_inquiries
  SET
    status = p_status,
    internal_admin_notes = left(trim(COALESCE(p_internal_notes, '')), 1000),
    updated_at = now()
  WHERE id = v_inquiry.id
    AND restaurant_id = v_restaurant.id;

  INSERT INTO public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    auth.uid(),
    'event_inquiry.status_update',
    'event_inquiry',
    v_inquiry.id::text,
    jsonb_build_object(
      'reference_code', v_inquiry.reference_code,
      'status', v_inquiry.status,
      'internal_admin_notes', v_inquiry.internal_admin_notes
    ),
    jsonb_build_object(
      'reference_code', v_inquiry.reference_code,
      'status', p_status,
      'internal_admin_notes', left(trim(COALESCE(p_internal_notes, '')), 1000)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'inquiry_id', v_inquiry.id,
    'reference_code', v_inquiry.reference_code,
    'status', p_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_inquiry_operational_state(text, uuid, text, text) TO anon, authenticated;

-- 4. Seed Complete Single-Location Demo Tenant: "Botánica · Cocina de Huerta & Invernadero"
-- Demonstrates how the platform adapts automatically when a restaurant has ONLY 1 LOCATION.
DO $seed$
DECLARE
  v_bot_id uuid := '33333333-3333-4333-8333-333333333333';
  v_bot_loc_id uuid := '33333333-3333-4333-8333-333333333101';
  v_bot_menu_id uuid := '33333333-3333-4333-8333-333333333201';
  v_bot_cat_plates_id uuid := '33333333-3333-4333-8333-333333333301';
  v_bot_cat_wines_id uuid := '33333333-3333-4333-8333-333333333302';
  v_bot_space_glass_id uuid := '33333333-3333-4333-8333-333333333501';
  v_bot_space_garden_id uuid := '33333333-3333-4333-8333-333333333502';
  v_bot_pkg_brunch_id uuid := '33333333-3333-4333-8333-333333333601';
  v_bot_pkg_dinner_id uuid := '33333333-3333-4333-8333-333333333602';
BEGIN
  INSERT INTO public.restaurants (
    id, slug, name, tagline, story_excerpt,
    cuisine_type, currency_code, is_demo, is_published,
    theme_config, contact_config, enabled_modules
  ) VALUES (
    v_bot_id,
    'botanica-brunch',
    'Botánica · Huerta & Invernadero',
    'Cocina de huerta orgánica, horno de barro y celebraciones en nuestro invernadero de Usaquén',
    'Botánica demuestra el escenario de un restaurante de sede única: una casona republicana en Usaquén donde conviven el comedor principal, la terraza jardín y nuestro Invernadero de Cristal para celebraciones íntimas y eventos empresariales.',
    'Cocina de Huerta, Brunch & Vino Natural',
    'COP',
    true,
    true,
    '{
      "archetype": "Cocina de Huerta · Sede Única",
      "heroImage": "/demo/casa-brasa/side-asparagus.jpg",
      "authenticityBadge": "Escenario Demo · Restaurante de 1 Sola Sede",
      "serviceChargeNote": "Precios en pesos colombianos (COP) con IVA incluido. Servicio voluntario sugerido del 10%."
    }'::jsonb,
    '{
      "whatsappPrimary": "+573105550199",
      "instagramHandle": "@botanica.demo",
      "eventsEmail": "eventos@botanica.demo",
      "privacyPolicyText": "Autorizo a Botánica (Marca Demo) a contactarme vía WhatsApp o correo electrónico para gestionar esta solicitud de evento conforme a la Ley 1581 de 2012."
    }'::jsonb,
    '{"menu": true, "events": true, "site": true}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    story_excerpt = EXCLUDED.story_excerpt,
    theme_config = EXCLUDED.theme_config,
    is_published = true;

  -- Single Location for Botánica
  INSERT INTO public.locations (
    id, restaurant_id, slug, name, neighborhood, address_line, city,
    contact_phone, whatsapp_phone, description, cover_image_url, gallery_urls,
    exclusive_features, opening_hours, highlights, is_primary, is_active, sort_order
  ) VALUES (
    v_bot_loc_id,
    v_bot_id,
    'casa-botanica-usaquen',
    'Casa Botánica · Usaquén (Única Sede)',
    'Usaquén · Plaza Fundacional',
    'Calle 119B # 6–28',
    'Bogotá',
    '(601) 742 0199',
    '+573105550199',
    'Casona patrimonial de 1935 con patio central arbolado, horno de leña para pan de masa madre e invernadero acristalado.',
    '/demo/casa-brasa/salon-terraza-fuego.jpg',
    '["/demo/casa-brasa/salon-terraza-fuego.jpg", "/demo/casa-brasa/salon-gallery-1.jpg", "/demo/casa-brasa/pkg-birthday.jpg", "/demo/casa-brasa/side-asparagus.jpg"]'::jsonb,
    ARRAY[
      'Invernadero de Cristal Climatizado (hasta 40 pax)',
      'Huerta Orgánica Propia en el Patio Interior',
      'Horno de Barro y Panadería de Masa Madre en Vivo',
      'Bodega de Vinos Naturales & Biodinámicos'
    ],
    '[
      {"days": "Martes a Viernes", "hours": "8:30 a. m. – 10:00 p. m."},
      {"days": "Sábados, Domingos y Festivos", "hours": "8:00 a. m. – 9:00 p. m."}
    ]'::jsonb,
    ARRAY['Invernadero Acristalado', 'Pet-Friendly en Jardín', 'Valet Parking'],
    true, true, 1
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- Menu for Botánica
  INSERT INTO public.menus (
    id, restaurant_id, slug, name, description, schedule_label, service_notes, is_active, sort_order
  ) VALUES (
    v_bot_menu_id,
    v_bot_id,
    'carta-huerta-y-horno',
    'Carta de Huerta, Horno & Cava Natural',
    'Ingredientes orgánicos de nuestra huerta en Guasca, masa madre de 48h y vinos biodinámicos.',
    'Servida en nuestra única sede de Usaquén desde las 8:30 a. m.',
    'Todos nuestros vegetales provienen de nuestra sabana orgánica en Guasca y nuestra masa madre fermenta durante 48 horas.',
    true, 1
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- Categories for Botánica
  INSERT INTO public.categories (
    id, restaurant_id, menu_id, slug, name, subtitle, description, display_mode, is_active, sort_order
  ) VALUES
  (
    v_bot_cat_plates_id, v_bot_id, v_bot_menu_id, 'platos-de-la-huerta',
    'Cocina de Huerta & Horno de Barro',
    'Platos principales y para compartir al centro',
    'Ingredientes de estación asados lentamente en horno de barro y leña de eucalipto.',
    'editorial_grid', true, 1
  ),
  (
    v_bot_cat_wines_id, v_bot_id, v_bot_menu_id, 'vinos-naturales-y-acompanamientos',
    'Vinos de Baja Intervención & Panadería',
    'Selección de cava natural y guarniciones de la huerta',
    'Presentación con miniatura visual de referencia rápida.',
    'compact_list', true, 2
  )
  ON CONFLICT (menu_id, slug) DO NOTHING;

  -- Products for Botánica
  INSERT INTO public.products (
    id, restaurant_id, category_id, slug, name, short_description, long_description,
    base_price, image_url, image_alt, availability_status, is_featured, is_new, is_chef_choice,
    badges, portion_label, pairing_note, sort_order
  ) VALUES
  (
    '33333333-3333-4333-8333-333333333401', v_bot_id, v_bot_cat_plates_id,
    'esparragos-y-portobellos-huerta',
    'Cazuela de Espárragos Verdes, Portobellos & Stracciatella',
    'Asados al horno de barro con reducción balsámica de higos, stracciatella fresca de búfala y masa madre.',
    'Recolectados cada mañana y horneados a alta temperatura sobre cerámica de Ráquira, coronados con stracciatella cremosa y aceite de hierbas del huerto.',
    48000, '/demo/casa-brasa/side-asparagus.jpg',
    'Espárragos verdes y portobellos orgánicos al horno de barro',
    'available', true, false, true,
    ARRAY['Insignia de la Huerta', 'Vegetariano', 'Sin Gluten'],
    '260g · Ideal para compartir',
    'Marida con una copa fría de Albariño Atlántico o nuestro Spritz de Sauco y Pepino.',
    1
  ),
  (
    '33333333-3333-4333-8333-333333333402', v_bot_id, v_bot_cat_plates_id,
    'pulpo-rostizado-mantequilla-hierbas',
    'Pulpo Rostizado al Horno de Barro & Papa Nativa',
    'Tentáculos dorados con mantequilla de salvia, papas nativas rotas y emulsión de limón mandarino.',
    'Cocción lenta con hierbas aromáticas de nuestro patio y terminado a fuego alto en sartén de hierro.',
    68000, '/demo/casa-brasa/octopus-starter.jpg',
    'Pulpo rostizado sobre papa nativa orgánica',
    'available', true, true, false,
    ARRAY['Favorito de Casa', 'Sin Gluten'],
    '210g · Plato Fuerte',
    'Acompáñalo con nuestro Pinot Noir biodinámico servido a 14°C.',
    2
  ),
  (
    '33333333-3333-4333-8333-333333333403', v_bot_id, v_bot_cat_plates_id,
    'gratinado-quesos-artesanales-y-trufa',
    'Rigatoni al Horno con Quesos de Cabra & Trufa Negra',
    'Pasta fresca gratinada en hierro fundido con queso madurado de Ubaté, gruyère y trufa negra.',
    'Nuestra receta reconfortante por excelencia para almuerzos de fin de semana en el invernadero.',
    52000, '/demo/casa-brasa/side-truffle-gratin.jpg',
    'Gratinado de pasta artesanal con trufa negra',
    'available', true, false, false,
    ARRAY['Hecho en Casa', 'Vegetariano'],
    '310g · Individual',
    'Armoniza con Marqués de Murrieta Reserva por su acidez equilibrada.',
    3
  ),
  (
    '33333333-3333-4333-8333-333333333404', v_bot_id, v_bot_cat_wines_id,
    'vino-tinto-biodinamico-mendoza',
    'Catena Zapata Malbec Orgánico · Parcela Alta',
    'Fruta roja fresca, violetas silvestres y crianza sutil en fudres de roble.',
    NULL,
    235000, '/demo/casa-brasa/wine-malbec.jpg',
    'Copa de vino tinto orgánico en el invernadero',
    'available', false, false, true,
    ARRAY['Cava Natural', 'Botella 750ml'],
    'Botella 750 ml',
    NULL,
    1
  ),
  (
    '33333333-3333-4333-8333-333333333405', v_bot_id, v_bot_cat_wines_id,
    'rioja-reserva-botanica',
    'Marqués de Murrieta Reserva · Selección Sommelier',
    'Notas de cereza madura, monte bajo mediterráneo y final sedoso.',
    NULL,
    275000, '/demo/casa-brasa/wine-rioja.jpg',
    'Copa de Rioja Reserva en mesa de jardín',
    'available', false, false, false,
    ARRAY['D.O.Ca. Rioja', 'Botella 750ml'],
    'Botella 750 ml',
    NULL,
    2
  )
  ON CONFLICT (category_id, slug) DO NOTHING;

  -- Event Spaces inside Botánica's single location
  INSERT INTO public.event_spaces (
    id, restaurant_id, location_id, slug, name, subtitle, description,
    capacity_seated, capacity_cocktail, min_guests, ambiance_tags, equipment_features,
    cover_image_url, gallery_urls, is_active, sort_order
  ) VALUES
  (
    v_bot_space_glass_id, v_bot_id, v_bot_loc_id, 'invernadero-de-cristal',
    'El Invernadero de Cristal · Patio Central',
    'Luz natural cenital, helechos colgantes y climatización acústica privada',
    'Nuestro espacio insignia dentro de Casa Botánica para celebrar brunch de cumpleaños, bautizos, pedidas de mano y desayunos corporativos rodeados de vegetación.',
    36, 50, 12,
    ARRAY['Luz Natural', '100% Privado', 'Jardín Interior'],
    ARRAY['Sonido Bose ambiental', 'Pantalla móvil de 65"', 'Mesa imperial de cedro', 'Calefacción radiante nocturna'],
    '/demo/casa-brasa/salon-terraza-fuego.jpg',
    '["/demo/casa-brasa/salon-terraza-fuego.jpg", "/demo/casa-brasa/pkg-birthday.jpg", "/demo/casa-brasa/salon-gallery-1.jpg", "/demo/casa-brasa/side-asparagus.jpg"]'::jsonb,
    true, 1
  ),
  (
    v_bot_space_garden_id, v_bot_id, v_bot_loc_id, 'salon-de-la-chimenea',
    'Salón de la Chimenea · Biblioteca Botánica',
    'Intimidad absoluta en el segundo piso de nuestra casona de Usaquén',
    'Un salón cálido en madera y ladrillo original para juntas directivas, cenas privadas con maridaje y celebraciones familiares de hasta 22 personas.',
    22, 28, 8,
    ARRAY['Casona Patrimonial', 'Chimenea a Leña', 'Insonorizado'],
    ARRAY['Proyector HD oculto', 'Wi-Fi dedicado de alta velocidad', 'Servicio de sommelier exclusivo'],
    '/demo/casa-brasa/salon-gran-roble.jpg',
    '["/demo/casa-brasa/salon-gran-roble.jpg", "/demo/casa-brasa/salon-gallery-2.jpg", "/demo/casa-brasa/pkg-bespoke.jpg", "/demo/casa-brasa/wine-rioja.jpg"]'::jsonb,
    true, 2
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- Event Packages for Botánica
  INSERT INTO public.event_packages (
    id, restaurant_id, slug, name, event_category, badge_label, tagline, description,
    pricing_model, base_price, min_guests, max_guests, duration_hours,
    includes_items, optional_extras, conditions_text, cover_image_url, is_featured, is_active, sort_order
  ) VALUES
  (
    v_bot_pkg_brunch_id, v_bot_id, 'celebracion-brunch-en-el-invernadero',
    'Brunch de Celebración en el Invernadero',
    'birthday',
    'Favorito Cumpleaños & Brunch',
    'Mesa festiva de 4 tiempos de la huerta, mimosas botánicas y pastelería artesanal.',
    'Ideal para cumpleaños de día, aniversarios, grados y celebraciones familiares con luz natural en nuestro Invernadero de Cristal.',
    'per_person', 118000, 12, 45, 4.0,
    '[
      "Mimosa de mandarina orgánica o Spritz de sauco de bienvenida",
      "Centro de mesa con panes de masa madre, stracciatella, dips del huerto y fruta de estación",
      "Plato fuerte individual a elección de nuestra carta de huerta y horno de barro",
      "Torta artesanal de celebración con flores comestibles y estación ilimitada de café de origen"
    ]'::jsonb,
    '[
      {"name": "Barra libre de Mimosas & Sangría Blanca (3 horas)", "price": "$ 68.000 / persona"},
      {"name": "Decoración floral botánica personalizada en mesa", "price": "$ 18.000 / persona"}
    ]'::jsonb,
    'Reserva confirmada con el 30% de anticipo una vez validada la disponibilidad del Invernadero.',
    '/demo/casa-brasa/pkg-birthday.jpg', true, true, 1
  ),
  (
    v_bot_pkg_dinner_id, v_bot_id, 'cena-ejecutiva-o-maridaje-privado',
    'Cena Privada de Huerta & Cava Natural',
    'corporate',
    'Ideal Empresas & Cenas Íntimas',
    'Menú de 3 tiempos al horno de barro con uso privado del Salón de la Chimenea.',
    'Diseñado para cierres de año, juntas directivas y cenas privadas donde la tranquilidad y la gastronomía orgánica son protagonistas.',
    'per_person', 142000, 8, 36, 4.0,
    '[
      "Cóctel botánico de autor al llegar los invitados",
      "Tres entradas de la huerta al centro para compartir",
      "Fuerte principal al horno de barro y postre tibio de estación",
      "Uso de pantalla, audio independiente y papelería personalizada"
    ]'::jsonb,
    '[
      {"name": "Maridaje de 2 copas de vino natural por invitado", "price": "$ 62.000 / persona"}
    ]'::jsonb,
    'Confirmación de fecha sujeta a disponibilidad de nuestro equipo de hospitalidad.',
    '/demo/casa-brasa/pkg-bespoke.jpg', true, true, 2
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- Sample Event Inquiry for Botánica
  INSERT INTO public.event_inquiries (
    reference_code, restaurant_id, location_id, event_space_id, event_package_id,
    event_type, tentative_date, preferred_time_slot, guest_count,
    customer_name, customer_phone, customer_email, company_name,
    special_requests, status, internal_admin_notes, privacy_accepted
  ) VALUES (
    'BH-2611-3092', v_bot_id, v_bot_loc_id, v_bot_space_glass_id, v_bot_pkg_brunch_id,
    'Cumpleaños Brunch en el Invernadero',
    CURRENT_DATE + interval '10 days',
    'lunch', 24,
    'Mariana Gómez (Demo Sede Única)',
    '+573140008899',
    'mariana.demo@correo.co',
    NULL,
    'Queremos montaje en mesa imperial con flores silvestres y 3 platos veganos.',
    'received',
    'Validar disponibilidad del Invernadero de Cristal para el domingo a las 11:30 a. m.',
    true
  )
  ON CONFLICT (reference_code) DO NOTHING;
END;
$seed$;
