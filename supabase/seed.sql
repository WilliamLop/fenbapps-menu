-- ============================================================================
-- SEED DATA: "Casa Brasa" (Demo Principal) + "Bistró Rival" (Tenant B para QA RLS)
-- ============================================================================

DO $$
DECLARE
  -- Tenant 1: Casa Brasa
  v_cb_id uuid := '11111111-1111-4111-8111-111111111111';
  v_loc_93_id uuid := '11111111-1111-4111-8111-111111111101';
  v_loc_zg_id uuid := '11111111-1111-4111-8111-111111111102';
  v_menu_main_id uuid := '11111111-1111-4111-8111-111111111201';

  -- Categories Casa Brasa
  v_cat_starters_id uuid := '11111111-1111-4111-8111-111111111301';
  v_cat_cuts_id uuid := '11111111-1111-4111-8111-111111111302';
  v_cat_cocktails_id uuid := '11111111-1111-4111-8111-111111111303';
  v_cat_cellar_id uuid := '11111111-1111-4111-8111-111111111304';

  -- Products with Options
  v_prod_ribeye_id uuid := '11111111-1111-4111-8111-111111111401';
  v_prod_tomahawk_id uuid := '11111111-1111-4111-8111-111111111402';
  v_opt_grp_doneness_id uuid := '11111111-1111-4111-8111-111111111501';
  v_opt_grp_sides_id uuid := '11111111-1111-4111-8111-111111111502';

  -- Event Spaces & Packages
  v_space_cava_id uuid := '11111111-1111-4111-8111-111111111601';
  v_space_terrace_id uuid := '11111111-1111-4111-8111-111111111602';
  v_space_roble_id uuid := '11111111-1111-4111-8111-111111111603';
  v_pkg_corp_id uuid := '11111111-1111-4111-8111-111111111701';
  v_pkg_bday_id uuid := '11111111-1111-4111-8111-111111111702';
  v_pkg_bespoke_id uuid := '11111111-1111-4111-8111-111111111703';

  -- Tenant 2: Bistró Rival (Isolation Test Tenant)
  v_rival_id uuid := '22222222-2222-4222-8222-222222222222';
  v_rival_menu_id uuid := '22222222-2222-4222-8222-222222222201';
  v_rival_cat_id uuid := '22222222-2222-4222-8222-222222222301';
BEGIN
  -- 1. Insert Restaurant 1: Casa Brasa
  INSERT INTO public.restaurants (
    id, slug, name, tagline, story_excerpt, cuisine_type, currency_code,
    is_demo, is_published, enabled_modules, theme_config, contact_config
  ) VALUES (
    v_cb_id,
    'casa-brasa',
    'Casa Brasa',
    'Cocina de Leña, Maduración en Seco & Salones Privados',
    'Nacimos alrededor del fuego lento de roble y encino. Seleccionamos cortes de ganado criado en pastura libre, los maduramos en nuestra cámara de sal del Himalaya entre 28 y 45 días, y los servimos en una atmósfera cálida pensada para grandes conversaciones, celebraciones familiares y encuentros corporativos memorables.',
    'Fuego, Brasa & Autor',
    'COP',
    true,
    true,
    '{"menu": true, "events": true, "site": true}'::jsonb,
    '{
      "archetype": "fuego-brasa",
      "heroImage": "/demo/casa-brasa/hero-steak.jpg",
      "authenticityBadge": "Fotografía real de nuestra cocina · Dirección visual certificada",
      "serviceChargeNote": "Todos nuestros precios incluyen IVA (Impoconsumo 8%). Propina voluntaria sugerida del 10%."
    }'::jsonb,
    '{
      "whatsappPrimary": "+573105550193",
      "instagramHandle": "@casabrasa.demo",
      "eventsEmail": "eventos@casabrasa.demo",
      "privacyPolicyText": "Autorizo a Casa Brasa (Demostración) el tratamiento de mis datos de contacto únicamente para gestionar esta solicitud de cotización conforme a la Ley 1581 de 2012."
    }'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    story_excerpt = EXCLUDED.story_excerpt,
    theme_config = EXCLUDED.theme_config,
    contact_config = EXCLUDED.contact_config;

  -- 2. Locations for Casa Brasa
  INSERT INTO public.locations (
    id, restaurant_id, slug, name, address_line, neighborhood, city,
    google_maps_url, whatsapp_phone, contact_phone, opening_hours, highlights,
    is_primary, is_active, sort_order
  ) VALUES
  (
    v_loc_93_id, v_cb_id, 'parque-93',
    'Sede Parque de la 93',
    'Calle 93A # 12-45',
    'Chicó · Parque de la 93',
    'Bogotá',
    'https://maps.google.com',
    '+573105550193',
    '(601) 742 0193',
    '[
      {"days": "Lunes a Miércoles", "hours": "12:00 m. – 10:30 p. m."},
      {"days": "Jueves a Sábado", "hours": "12:00 m. – 11:45 p. m."},
      {"days": "Domingos y Festivos", "hours": "12:00 m. – 6:00 p. m."}
    ]'::jsonb,
    ARRAY['Cava Privada de Cristal (22 pax)', 'Terraza del Fuego Climatizada', 'Valet Parking'],
    true, true, 1
  ),
  (
    v_loc_zg_id, v_cb_id, 'zona-g',
    'Sede Zona G · Quinta Camacho',
    'Carrera 5 # 69A-24',
    'Zona G · Chapinero Alto',
    'Bogotá',
    'https://maps.google.com',
    '+573105550170',
    '(601) 742 0170',
    '[
      {"days": "Martes a Sábado", "hours": "12:00 m. – 11:30 p. m."},
      {"days": "Domingos", "hours": "12:00 m. – 5:30 p. m."}
    ]'::jsonb,
    ARRAY['Casona Patrimonial Restaurada', 'Gran Salón de Roble (75 pax)', 'Bar de Coctelería de Autor'],
    false, true, 2
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- 3. Main Menu for Casa Brasa
  INSERT INTO public.menus (
    id, restaurant_id, location_id, slug, name, description, schedule_label, service_notes, is_active, sort_order
  ) VALUES (
    v_menu_main_id, v_cb_id, NULL, 'carta-principal',
    'Carta de Fuego, Cortes & Coctelería',
    'Nuestra selección principal de entradas al rescoldo, cortes madurados en casa, cava y coctelería ahumada.',
    'Servida todos los días desde las 12:00 m.',
    'Si tienes alguna alergia o restricción alimentaria, infórmalo a tu mesero antes de ordenar.',
    true, 1
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- 4. Categories for Casa Brasa
  INSERT INTO public.categories (
    id, restaurant_id, menu_id, slug, name, subtitle, description, display_mode, is_active, sort_order
  ) VALUES
  (
    v_cat_starters_id, v_cb_id, v_menu_main_id, 'entradas-al-rescoldo',
    'Entradas al Rescoldo',
    'Para abrir conversación al centro de la mesa',
    'Vegetales orgánicos, mariscos y cortes pequeños pasados por brasa viva de encino.',
    'editorial_grid', true, 1
  ),
  (
    v_cat_cuts_id, v_cb_id, v_menu_main_id, 'cortes-madurados',
    'Cortes Madurados a la Leña',
    'Dry-Aged 28 a 45 días en cámara de sal',
    'Todos nuestros cortes incluyen una guarnición artesanal a elección y mantequilla de tuétano a las hierbas.',
    'editorial_grid', true, 2
  ),
  (
    v_cat_cocktails_id, v_cb_id, v_menu_main_id, 'cocteleria-de-autor',
    'Coctelería Ahumada & Destilados',
    'Alquimia líquida con humo de maderas nobles',
    'Cócteles diseñados en nuestra barra con infusiones botánicas, cítricos asados y hielo cristalino tallado a mano.',
    'editorial_grid', true, 3
  ),
  (
    v_cat_cellar_id, v_cb_id, v_menu_main_id, 'cava-y-guarniciones',
    'Cava de Vinos & Guarniciones de la Casa',
    'Selección de sommelier y acompañamientos al horno de leña',
    'Presentación en formato de carta clásica para consulta rápida.',
    'compact_list', true, 4
  )
  ON CONFLICT (menu_id, slug) DO NOTHING;

  -- 5. Products for Casa Brasa
  INSERT INTO public.products (
    id, restaurant_id, category_id, slug, name, short_description, long_description,
    base_price, compare_at_price, image_url, image_alt, availability_status,
    is_featured, is_new, is_chef_choice, badges, portion_label, sort_order
  ) VALUES
  -- Starters
  (
    '11111111-1111-4111-8111-111111111410', v_cb_id, v_cat_starters_id,
    'pulpo-al-rescoldo',
    'Pulpo a la Brasa sobre Cremoso Criollo',
    'Tentáculos de pulpo dorados al carbón de encino, puré rústico de papa criolla ahumada y aceite de pimentón de la Vera.',
    'Cocinado lentamente durante 4 horas y terminado a fuego vivo sobre parrilla de hierro para lograr un exterior crujiente y un interior tierno. Servido sobre emulsión tibia de papa criolla orgánica, alcaparras fritas y aceite de pimentón ahumado.',
    64000, NULL, '/demo/casa-brasa/octopus-starter.jpg',
    'Pulpo a la brasa sobre puré de papa criolla en plato de cerámica artesanal',
    'available', true, false, true,
    ARRAY['Recomendado del Chef', 'Sin Gluten', 'Brasa Viva'],
    '190g · Ideal para compartir', 1
  ),
  (
    '11111111-1111-4111-8111-111111111411', v_cb_id, v_cat_starters_id,
    'tuetano-asado-y-steak-tartare',
    'Canoa de Tuétano Asado & Tartar de Lomo',
    'Hueso de caña asado a la leña coronado con steak tartare cortado a cuchillo, yema curada y tostadas de masa madre.',
    'Una combinación intensa de texturas: la untuosidad del tuétano fundido al horno de leña se mezcla en la mesa con nuestro tartar de lomo fino aliñado con mostaza antigua, chalotas y alcaparras.',
    58000, NULL, '/demo/casa-brasa/marrow-tartare.jpg',
    'Tuétano asado a la leña con tartar de lomo y masa madre',
    'available', false, true, false,
    ARRAY['Nuevo en Carta', 'Para Compartir'],
    '240g · 2 a 3 personas', 2
  ),
  -- Main Cuts
  (
    v_prod_ribeye_id, v_cb_id, v_cat_cuts_id,
    'ribeye-dry-aged-35-dias',
    'Ribeye Ojo de Bife · Maduración 35 Días',
    'Corte insignia con marmoleo superior, sellado a 450°C con leña de roble, mantequilla de tuétano, ajo rostizado y sal en escamas.',
    'Nuestro corte más emblemático. La maduración en seco durante 35 días concentra las notas a nuez y mantequilla avellanada, logrando una terneza excepcional. Se sirve trinchado sobre piedra volcánica templada con flor de sal y romero tatemado.',
    128000, NULL, '/demo/casa-brasa/hero-steak.jpg',
    'Ribeye madurado 35 días trinchado en término medio sobre piedra volcánica',
    'available', true, false, true,
    ARRAY['Corte Insignia', 'Maduración 35 Días', 'Sin Gluten'],
    '420g en crudo · Incluye 1 guarnición', 1
  ),
  (
    v_prod_tomahawk_id, v_cb_id, v_cat_cuts_id,
    'tomahawk-imperial-para-dos',
    'Tomahawk Imperial en Mesa · 45 Días Dry-Aged',
    'Espectacular corte con hueso largo de costilla (950g), flameado con mantequilla de hierbas y brandy frente al comensal.',
    'Seleccionado del centro del ribeye conservando el hueso intacto para proteger la jugosidad durante el asado lento. Incluye dos guarniciones artesanales a elección y trilogía de salsas de la casa.',
    265000, NULL, '/demo/casa-brasa/tomahawk-steak.jpg',
    'Tomahawk imperial de 950 gramos servido para compartir',
    'available', true, false, false,
    ARRAY['Ideal 2–3 Personas', 'Experiencia en Mesa'],
    '950g con hueso · Incluye 2 guarniciones', 2
  ),
  (
    '11111111-1111-4111-8111-111111111403', v_cb_id, v_cat_cuts_id,
    'chuleton-wagyu-cross-edicion-limitada',
    'Chuletón Wagyu Cross · Lote Reserva',
    'Marmoleo grado BMS 7, infiltración sedosa y costra caramelizada al carbón de quebracho blanco.',
    'Producción limitada de solo 6 porciones diarias según disponibilidad de nuestra cámara de maduración.',
    195000, NULL, '/demo/casa-brasa/wagyu-chuleton.jpg',
    'Chuletón Wagyu Cross a la brasa',
    'sold_out', false, false, false,
    ARRAY['Cupo Diario Limitado'],
    '450g · Cupo agotado por hoy', 3
  ),
  (
    '11111111-1111-4111-8111-111111111499', v_cb_id, v_cat_cuts_id,
    'corte-secreto-pruebas-internas',
    'Corte Interno No Publicado (Test RLS Hidden)',
    'Este producto tiene estado hidden y no debe aparecer en la consulta pública anónima.',
    'Uso exclusivo de verificación de seguridad.',
    99000, NULL, NULL, NULL,
    'hidden', false, false, false,
    ARRAY[]::text[],
    '300g', 99
  ),
  -- Cocktails
  (
    '11111111-1111-4111-8111-111111111420', v_cb_id, v_cat_cocktails_id,
    'old-fashioned-humo-de-roble',
    'Old Fashioned de Roble & Naranja Tatemada',
    'Bourbon reposado en barrica, reducción de panela orgánica especiada, bitters de cacao y humo real de astillas de roble.',
    'Ahumado al momento en campana de cristal con viruta de barrica de roble tostado y servido sobre esfera de hielo puro tallada a mano.',
    46000, NULL, '/demo/casa-brasa/smoked-cocktail.jpg',
    'Cóctel Old Fashioned ahumado con esfera de hielo cristalino y piel de naranja',
    'available', true, false, true,
    ARRAY['Autor', 'Ahumado en Mesa'],
    'Esfera de hielo · Bourbon 2 oz', 1
  ),
  -- Compact List Category (Editorial Wine & Sides List with Reference Thumbnails)
  (
    '11111111-1111-4111-8111-111111111430', v_cb_id, v_cat_cellar_id,
    'catena-zapata-malbec-argentino',
    'Catena Zapata Malbec · Mendoza, Argentina',
    'Notas de ciruela negra, violetas, cuero sutil y crianza de 14 meses en roble francés.',
    NULL,
    245000, NULL, '/demo/casa-brasa/wine-malbec.jpg', 'Copa Riedel de vino tinto Malbec en cava',
    'available', false, false, true,
    ARRAY['Cava Sommelier', 'Botella 750ml'],
    'Botella 750 ml', 1
  ),
  (
    '11111111-1111-4111-8111-111111111431', v_cb_id, v_cat_cellar_id,
    'marques-de-murrieta-reserva-rioja',
    'Marqués de Murrieta Reserva · D.O.Ca. Rioja, España',
    'Tempranillo equilibrado con fruta roja madura, especias dulces y final mineral.',
    NULL,
    285000, NULL, '/demo/casa-brasa/wine-rioja.jpg', 'Botella y copa de Marqués de Murrieta Reserva Rioja',
    'available', false, false, false,
    ARRAY['D.O.Ca. Rioja', 'Botella 750ml'],
    'Botella 750 ml', 2
  ),
  (
    '11111111-1111-4111-8111-111111111432', v_cb_id, v_cat_cellar_id,
    'esparragos-y-portobellos-a-la-parrilla',
    'Espárragos Verdes & Portobellos al Rescoldo',
    'Terminados con reducción balsámica añeja, lascas de Parmigiano Reggiano y aceite de trufa blanca.',
    NULL,
    26000, NULL, '/demo/casa-brasa/side-asparagus.jpg', 'Espárragos verdes y portobellos asados al rescoldo',
    'available', false, false, false,
    ARRAY['Vegetariano', 'Sin Gluten'],
    'Guarnición al centro', 3
  ),
  (
    '11111111-1111-4111-8111-111111111433', v_cb_id, v_cat_cellar_id,
    'mac-and-cheese-trufado-al-horno-de-lena',
    'Gratinado de Quesos Madurados & Trufa Negra',
    'Pasta artesanal gratinada en sartén de hierro fundido con gruyère, provolone ahumado y miga panko crujiente.',
    NULL,
    29000, NULL, '/demo/casa-brasa/side-truffle-gratin.jpg', 'Gratinado de quesos madurados y trufa negra en sartén de hierro',
    'available', false, false, false,
    ARRAY['Vegetariano', 'Hierro Fundido'],
    'Guarnición al centro', 4
  )
  ON CONFLICT (category_id, slug) DO NOTHING;

  -- 6. Product Option Groups & Options for Ribeye
  INSERT INTO public.product_option_groups (
    id, restaurant_id, product_id, name, helper_text, is_required, min_selections, max_selections, sort_order
  ) VALUES
  (
    v_opt_grp_doneness_id, v_cb_id, v_prod_ribeye_id,
    'Punto de cocción sugerido',
    'Nuestro chef recomienda Término Medio para apreciar la infiltración del corte.',
    true, 1, 1, 1
  ),
  (
    v_opt_grp_sides_id, v_cb_id, v_prod_ribeye_id,
    'Guarnición artesanal incluida',
    'Elige tu acompañamiento sin costo o mejora a una guarnición especial.',
    true, 1, 1, 2
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.product_options (
    restaurant_id, option_group_id, name, price_delta, is_available, sort_order
  ) VALUES
  (v_cb_id, v_opt_grp_doneness_id, 'Azul (Sellado exterior, centro frío 48°C)', 0, true, 1),
  (v_cb_id, v_opt_grp_doneness_id, 'Término Medio — Recomendado del Chef (56°C)', 0, true, 2),
  (v_cb_id, v_opt_grp_doneness_id, 'Tres Cuartos (Centro jugoso rosado 63°C)', 0, true, 3),
  (v_cb_id, v_opt_grp_doneness_id, 'Bien Asado (Cocción completa 70°C)', 0, true, 4),
  (v_cb_id, v_opt_grp_sides_id, 'Puré rústico de papa criolla ahumada', 0, true, 1),
  (v_cb_id, v_opt_grp_sides_id, 'Vegetales orgánicos al rescoldo', 0, true, 2),
  (v_cb_id, v_opt_grp_sides_id, 'Papas rústicas con aceite de trufa y parmesano', 12000, true, 3);

  -- 7. Event Spaces for Casa Brasa
  INSERT INTO public.event_spaces (
    id, restaurant_id, location_id, slug, name, subtitle, description,
    capacity_seated, capacity_cocktail, min_guests, ambiance_tags, equipment_features,
    cover_image_url, is_active, sort_order
  ) VALUES
  (
    v_space_cava_id, v_cb_id, v_loc_93_id, 'cava-de-cristal',
    'La Cava de Cristal · Salón Privado',
    'Privacidad absoluta rodeada de más de 800 etiquetas de nuestra cava',
    'Un salón insonorizado con mesa imperial de roble macizo para juntas directivas, cenas de negocios confidenciales, pedidas de mano y aniversarios familiares íntimos.',
    22, 28, 10,
    ARRAY['100% Privado', 'Insonorizado', 'Mesa Imperial'],
    ARRAY['Pantalla 75" 4K oculta', 'Audio Bose independiente', 'Sommelier dedicado', 'Climatización propia', 'Wi-Fi empresarial dedicado'],
    '/demo/casa-brasa/salon-cava-cristal.jpg', true, 1
  ),
  (
    v_space_terrace_id, v_cb_id, v_loc_93_id, 'terraza-del-fuego',
    'Terraza del Fuego · Jardín Cubierto',
    'Chimenea central a leña, techo retráctil y vegetación natural',
    'El espacio predilecto para celebrar cumpleaños de adultos, aniversarios, lanzamientos de marca y tardes de coctelería ahumada sin preocuparse por el clima.',
    45, 65, 18,
    ARRAY['Semi-Privado o Exclusivo', 'Chimenea Viva', 'Iluminación Cálida'],
    ARRAY['Barra de coctelería móvil', 'Calefactores radiantes', 'Sonido ambiental', 'Valet Parking en puerta'],
    '/demo/casa-brasa/salon-terraza-fuego.jpg', true, 2
  ),
  (
    v_space_roble_id, v_cb_id, v_loc_zg_id, 'gran-salon-de-roble',
    'Gran Salón de Roble · Casona Zona G',
    'Arquitectura patrimonial de ladrillo a la vista para grandes celebraciones',
    'Toda la segunda planta de nuestra casona en Quinta Camacho dedicada en exclusiva a tu evento: cenas de fin de año empresariales, bodas civiles íntimas y celebraciones familiares de hasta 75 invitados.',
    75, 95, 25,
    ARRAY['Planta Exclusiva', 'Parrilla a la Vista', 'Casona Patrimonial'],
    ARRAY['Sistema de micrófonos inalámbricos', 'Proyector láser HD', 'Estación de fuegos exclusiva', 'Guardarropa privado'],
    '/demo/casa-brasa/salon-gran-roble.jpg', true, 3
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- 8. Event Packages for Casa Brasa
  INSERT INTO public.event_packages (
    id, restaurant_id, slug, name, event_category, badge_label, tagline, description,
    pricing_model, base_price, min_guests, max_guests, duration_hours,
    includes_items, optional_extras, conditions_text, cover_image_url, is_featured, is_active, sort_order
  ) VALUES
  (
    v_pkg_corp_id, v_cb_id, 'experiencia-corporativa-mesa-de-fuego',
    'Experiencia Corporativa · Mesa de Fuego',
    'corporate',
    'Más solicitado por empresas',
    'Menú de 3 tiempos a la brasa con servicio ejecutivo sincronizado y salón privado incluido.',
    'Diseñado para cierres de negocios, juntas directivas y celebraciones de equipo donde la puntualidad, la privacidad y la excelencia gastronómica están garantizadas.',
    'per_person', 165000, 10, 75, 4.0,
    '[
      "Cóctel de bienvenida con o sin licor al llegar los invitados",
      "Entradas al centro de la mesa (Pulpo al rescoldo, Burrata ahumada y Empanadas de picaña)",
      "Fuerte individual a elección entre 3 cortes madurados o pesca blanca a la leña",
      "Postre de autor al rescoldo y estación permanente de café de origen",
      "Uso de pantalla, audio privado y minutas impresas personalizadas con el logo de tu empresa"
    ]'::jsonb,
    '[
      {"name": "Maridaje de 2 copas por persona (Sommelier)", "price": "$ 65.000 / persona"},
      {"name": "Barra libre de coctelería ahumada (3 horas)", "price": "$ 95.000 / persona"}
    ]'::jsonb,
    'La solicitud no bloquea fecha automáticamente. Una vez confirmada la disponibilidad por nuestra coordinadora de eventos, se reserva con el 30% de anticipo.',
    '/demo/casa-brasa/hero-steak.jpg', true, true, 1
  ),
  (
    v_pkg_bday_id, v_cb_id, 'celebracion-cumpleanos-brasa-social',
    'Celebración & Cumpleaños · Brasa Social',
    'birthday',
    'Ideal Cumpleaños & Aniversarios',
    'Formato festivo para compartir cortes, entradas al centro y brindis con coctelería de autor.',
    'Perfecto para cumpleaños memorables, aniversarios y reencuentros familiares en nuestra Terraza del Fuego o Cava Privada.',
    'per_person', 138000, 15, 60, 4.5,
    '[
      "Brindis de bienvenida con Old Fashioned Ahumado o Spritz Botánico",
      "Festival de 4 entradas al centro para compartir sin prisa",
      "Trilogía de cortes madurados trinchados al centro en piedra volcánica con guarniciones",
      "Postre de celebración para el homenajeado con velas de chispa fría",
      "Decoración floral sobria en mesa y coordinación de tiempos"
    ]'::jsonb,
    '[
      {"name": "Descorche libre por botella de vino o destilado", "price": "$ 55.000 / botella"},
      {"name": "Hora adicional de salón o terraza", "price": "Sujeto a horario de sede"}
    ]'::jsonb,
    'Sujeto a disponibilidad de fecha y sede. Confirmación mediante cotización formal enviada por nuestro equipo.',
    '/demo/casa-brasa/smoked-cocktail.jpg', true, true, 2
  ),
  (
    v_pkg_bespoke_id, v_cb_id, 'reserva-exclusiva-a-medida',
    'Cierre Exclusivo de Salón o Menú de Degustación',
    'private_dining',
    '100% Personalizado',
    'Diseñamos junto a nuestro chef ejecutivo un menú y montaje único para tu ocasión.',
    'Para bodas civiles íntimas, lanzamientos de producto, catas privadas con sommelier o eventos de más de 50 invitados.',
    'custom_quote', NULL, 20, 95, 5.0,
    '[
      "Reunión previa o degustación con nuestro Chef Ejecutivo",
      "Diseño personalizado de carta de comida y coctelería",
      "Exclusividad total del salón o terraza seleccionada",
      "Coordinador de hospitalidad dedicado durante todo el evento"
    ]'::jsonb,
    '[]'::jsonb,
    'Cotización personalizada entregada en menos de 24 horas hábiles tras recibir tu solicitud.',
    '/demo/casa-brasa/octopus-starter.jpg', false, true, 3
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- 9. Sample Event Inquiries for Casa Brasa (Visible ONLY to authenticated members in Dashboard)
  INSERT INTO public.event_inquiries (
    reference_code, restaurant_id, location_id, event_space_id, event_package_id,
    event_type, tentative_date, preferred_time_slot, guest_count,
    customer_name, customer_phone, customer_email, company_name,
    special_requests, status, internal_admin_notes, privacy_accepted
  ) VALUES
  (
    'CB-2611-4821', v_cb_id, v_loc_93_id, v_space_cava_id, v_pkg_corp_id,
    'Cena Junta Directiva Fin de Año',
    CURRENT_DATE + interval '14 days',
    'dinner', 18,
    'Alejandro Mendoza (Datos Ficticios Demo)',
    '+573150001122',
    'amendoza@empresa-demo.co',
    'Grupo Inversiones Andinas (Demo)',
    'Necesitamos usar la pantalla de 75 pulgadas durante los primeros 30 minutos antes de servir las entradas. Dos invitados son vegetarianos.',
    'quoted',
    'Se envió propuesta PDF por WhatsApp con opción vegetariana de Portobellos al rescoldo.',
    true
  ),
  (
    'CB-2611-7104', v_cb_id, v_loc_93_id, v_space_terrace_id, v_pkg_bday_id,
    'Cumpleaños 40 Años',
    CURRENT_DATE + interval '21 days',
    'afternoon', 32,
    'Valeria Restrepo (Datos Ficticios Demo)',
    '+573100003344',
    'valeria.demo@correo-ejemplo.co',
    NULL,
    'Queremos mesas integradas en la Terraza del Fuego cerca a la chimenea y opción de llevar torta propia.',
    'received',
    'Pendiente de confirmar disponibilidad de terraza para el sábado a las 4:00 p. m.',
    true
  )
  ON CONFLICT (reference_code) DO NOTHING;

  -- 10. Insert Tenant 2: Bistró Rival (For Multi-Tenant Security Isolation Tests)
  INSERT INTO public.restaurants (
    id, slug, name, tagline, cuisine_type, currency_code, is_demo, is_published
  ) VALUES (
    v_rival_id,
    'bistro-rival-test',
    'Bistró Rival (Tenant Aislado QA)',
    'Restaurante de prueba para verificar aislamiento multi-tenant RLS',
    'Bistró Francés',
    'COP',
    true,
    true
  )
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.menus (id, restaurant_id, slug, name, is_active, sort_order)
  VALUES (v_rival_menu_id, v_rival_id, 'carta-rival', 'Carta Rival', true, 1)
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  INSERT INTO public.categories (id, restaurant_id, menu_id, slug, name, is_active, sort_order)
  VALUES (v_rival_cat_id, v_rival_id, v_rival_menu_id, 'platos-rival', 'Platos Rival', true, 1)
  ON CONFLICT (menu_id, slug) DO NOTHING;

  INSERT INTO public.products (
    restaurant_id, category_id, slug, name, short_description, base_price, availability_status
  ) VALUES (
    v_rival_id, v_rival_cat_id, 'confite-de-pato-rival',
    'Confit de Pato Exclusivo Bistró Rival',
    'Plato perteneciente al Tenant B para pruebas de aislamiento.',
    92000, 'available'
  )
  ON CONFLICT (category_id, slug) DO NOTHING;

  INSERT INTO public.event_inquiries (
    reference_code, restaurant_id, event_type, tentative_date, preferred_time_slot,
    guest_count, customer_name, customer_phone, status, privacy_accepted
  ) VALUES (
    'BR-2611-9999', v_rival_id, 'Evento Privado Confidencial Tenant B',
    CURRENT_DATE + interval '30 days', 'dinner', 25,
    'Cliente Confidencial Rival (Demo)', '+573009998877', 'received', true
  )
  ON CONFLICT (reference_code) DO NOTHING;
END;
$$;
