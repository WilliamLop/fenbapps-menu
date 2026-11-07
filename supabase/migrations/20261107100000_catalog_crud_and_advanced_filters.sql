-- ============================================================================
-- Migration: 20261107100000_catalog_crud_and_advanced_filters.sql
-- Description: Full CRUD for categories & products in the Operational Console,
--              atomic option groups synchronization, advanced 100+ dishes query
--              snapshot, and rich 104-dish gourmet menu seed for Casa Brasa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Category CRUD RPCs
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_upsert_category_impl(
  p_restaurant_slug text,
  p_category_id uuid DEFAULT NULL,
  p_menu_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_slug text DEFAULT '',
  p_subtitle text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_display_mode text DEFAULT 'editorial_grid',
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_menu_id uuid := p_menu_id;
  v_category public.categories%ROWTYPE;
  v_old_category public.categories%ROWTYPE;
  v_action text;
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
  ELSIF auth.uid() IS NOT NULL AND private.has_restaurant_role(
    v_restaurant.id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el catálogo de este restaurante' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para realizar modificaciones en el catálogo.'
      USING ERRCODE = 'P0005';
  END IF;

  IF length(trim(p_name)) < 2 OR length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'El nombre de la categoría debe tener entre 2 y 100 caracteres' USING ERRCODE = '22023';
  END IF;

  IF p_slug !~ '^[a-z0-9-]+$' OR length(trim(p_slug)) < 2 OR length(trim(p_slug)) > 60 THEN
    RAISE EXCEPTION 'El slug de la categoría debe ser alfanumérico en minúsculas con guiones y tener entre 2 y 60 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF p_display_mode NOT IN ('editorial_grid', 'compact_list', 'featured_cards') THEN
    RAISE EXCEPTION 'Modo de visualización de categoría inválido' USING ERRCODE = '22023';
  END IF;

  -- Resolve default menu if not provided
  IF v_menu_id IS NULL THEN
    SELECT m.id INTO v_menu_id
    FROM public.menus m
    WHERE m.restaurant_id = v_restaurant.id
      AND m.is_active = true
    ORDER BY m.sort_order ASC
    LIMIT 1;

    IF v_menu_id IS NULL THEN
      SELECT m.id INTO v_menu_id
      FROM public.menus m
      WHERE m.restaurant_id = v_restaurant.id
      ORDER BY m.sort_order ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_menu_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un menú activo para este restaurante' USING ERRCODE = 'P0002';
  END IF;

  -- Check slug uniqueness inside the restaurant/menu
  IF EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.restaurant_id = v_restaurant.id
      AND c.slug = lower(trim(p_slug))
      AND (p_category_id IS NULL OR c.id <> p_category_id)
  ) THEN
    RAISE EXCEPTION 'Ya existe una categoría con el identificador "%" en este restaurante', p_slug USING ERRCODE = '23505';
  END IF;

  IF p_category_id IS NULL THEN
    INSERT INTO public.categories (
      restaurant_id,
      menu_id,
      slug,
      name,
      subtitle,
      description,
      display_mode,
      is_active,
      sort_order
    ) VALUES (
      v_restaurant.id,
      v_menu_id,
      lower(trim(p_slug)),
      trim(p_name),
      nullif(trim(p_subtitle), ''),
      nullif(trim(p_description), ''),
      p_display_mode,
      COALESCE(p_is_active, true),
      COALESCE(p_sort_order, 0)
    ) RETURNING * INTO v_category;

    v_action := 'category.create';
  ELSE
    SELECT * INTO v_old_category
    FROM public.categories c
    WHERE c.id = p_category_id
      AND c.restaurant_id = v_restaurant.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Categoría no encontrada' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.categories
    SET
      slug = lower(trim(p_slug)),
      name = trim(p_name),
      subtitle = nullif(trim(p_subtitle), ''),
      description = nullif(trim(p_description), ''),
      display_mode = p_display_mode,
      is_active = COALESCE(p_is_active, is_active),
      sort_order = COALESCE(p_sort_order, sort_order),
      updated_at = now()
    WHERE id = p_category_id
      AND restaurant_id = v_restaurant.id
    RETURNING * INTO v_category;

    v_action := 'category.update';
  END IF;

  INSERT INTO public.audit_logs (
    restaurant_id,
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    NULL,
    auth.uid(),
    v_action,
    'category',
    v_category.id,
    CASE WHEN v_action = 'category.update' THEN row_to_json(v_old_category) ELSE NULL END,
    row_to_json(v_category)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'category_id', v_category.id,
    'slug', v_category.slug,
    'name', v_category.name
  );
END;
$$;

REVOKE ALL ON FUNCTION private.admin_upsert_category_impl(text, uuid, uuid, text, text, text, text, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_upsert_category_impl(text, uuid, uuid, text, text, text, text, text, boolean, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_category(
  p_restaurant_slug text,
  p_category_id uuid DEFAULT NULL,
  p_menu_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_slug text DEFAULT '',
  p_subtitle text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_display_mode text DEFAULT 'editorial_grid',
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_upsert_category_impl(
    p_restaurant_slug,
    p_category_id,
    p_menu_id,
    p_name,
    p_slug,
    p_subtitle,
    p_description,
    p_display_mode,
    p_is_active,
    p_sort_order
  );
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_category(text, uuid, uuid, text, text, text, text, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_category(text, uuid, uuid, text, text, text, text, text, boolean, integer) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Category Delete & Reorder RPCs
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_delete_category_impl(
  p_restaurant_slug text,
  p_category_id uuid,
  p_reassign_to_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_category public.categories%ROWTYPE;
  v_prod_count integer;
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
  ELSIF auth.uid() IS NOT NULL AND private.has_restaurant_role(
    v_restaurant.id,
    ARRAY['owner', 'admin']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para eliminar categorías' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para realizar modificaciones en el catálogo.'
      USING ERRCODE = 'P0005';
  END IF;

  SELECT * INTO v_category
  FROM public.categories c
  WHERE c.id = p_category_id
    AND c.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer INTO v_prod_count
  FROM public.products p
  WHERE p.category_id = p_category_id
    AND p.restaurant_id = v_restaurant.id;

  IF v_prod_count > 0 THEN
    IF p_reassign_to_category_id IS NULL THEN
      RAISE EXCEPTION 'No se puede eliminar la categoría "%" porque contiene % platos. Reasigna los platos primero.',
        v_category.name, v_prod_count
        USING ERRCODE = '23503';
    END IF;

    IF p_reassign_to_category_id = p_category_id THEN
      RAISE EXCEPTION 'La categoría de destino no puede ser la misma categoría a eliminar' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.categories c2
      WHERE c2.id = p_reassign_to_category_id
        AND c2.restaurant_id = v_restaurant.id
    ) THEN
      RAISE EXCEPTION 'Categoría de destino no válida' USING ERRCODE = '22023';
    END IF;

    UPDATE public.products
    SET category_id = p_reassign_to_category_id, updated_at = now()
    WHERE category_id = p_category_id
      AND restaurant_id = v_restaurant.id;
  END IF;

  DELETE FROM public.categories
  WHERE id = p_category_id
    AND restaurant_id = v_restaurant.id;

  INSERT INTO public.audit_logs (
    restaurant_id,
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    NULL,
    auth.uid(),
    'category.delete',
    'category',
    p_category_id,
    row_to_json(v_category),
    jsonb_build_object('reassigned_count', v_prod_count, 'reassigned_to', p_reassign_to_category_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_id', p_category_id,
    'deleted_name', v_category.name,
    'reassigned_count', v_prod_count
  );
END;
$$;

REVOKE ALL ON FUNCTION private.admin_delete_category_impl(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_delete_category_impl(text, uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_category(
  p_restaurant_slug text,
  p_category_id uuid,
  p_reassign_to_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_delete_category_impl(
    p_restaurant_slug,
    p_category_id,
    p_reassign_to_category_id
  );
$$;

REVOKE ALL ON FUNCTION public.admin_delete_category(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_category(text, uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.admin_reorder_categories_impl(
  p_restaurant_slug text,
  p_category_orders jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_elem jsonb;
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
  ELSIF auth.uid() IS NOT NULL AND private.has_restaurant_role(
    v_restaurant.id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para reordenar categorías' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para realizar modificaciones en el catálogo.'
      USING ERRCODE = 'P0005';
  END IF;

  IF jsonb_typeof(p_category_orders) <> 'array' THEN
    RAISE EXCEPTION 'p_category_orders debe ser un array jsonb' USING ERRCODE = '22023';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_category_orders)
  LOOP
    UPDATE public.categories
    SET
      sort_order = (v_elem->>'sort_order')::integer,
      updated_at = now()
    WHERE id = (v_elem->>'id')::uuid
      AND restaurant_id = v_restaurant.id;
  END LOOP;

  INSERT INTO public.audit_logs (
    restaurant_id,
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    NULL,
    auth.uid(),
    'categories.reorder',
    'category',
    NULL,
    NULL,
    p_category_orders
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION private.admin_reorder_categories_impl(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_reorder_categories_impl(text, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reorder_categories(
  p_restaurant_slug text,
  p_category_orders jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_reorder_categories_impl(
    p_restaurant_slug,
    p_category_orders
  );
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_categories(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_categories(text, jsonb) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Product Full Upsert & Delete RPCs (with Options & Option Groups sync)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_upsert_product_impl(
  p_restaurant_slug text,
  p_product_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_slug text DEFAULT '',
  p_short_description text DEFAULT NULL,
  p_long_description text DEFAULT NULL,
  p_base_price numeric DEFAULT 0,
  p_compare_at_price numeric DEFAULT NULL,
  p_portion_label text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_image_alt text DEFAULT NULL,
  p_availability_status text DEFAULT 'available',
  p_is_featured boolean DEFAULT false,
  p_is_new boolean DEFAULT false,
  p_is_chef_choice boolean DEFAULT false,
  p_badges text[] DEFAULT '{}'::text[],
  p_exclusive_location_id uuid DEFAULT NULL,
  p_sort_order integer DEFAULT 0,
  p_option_groups jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_old_product public.products%ROWTYPE;
  v_action text;
  v_has_access boolean := false;
  v_grp_elem jsonb;
  v_opt_elem jsonb;
  v_grp_id uuid;
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
  ELSIF auth.uid() IS NOT NULL AND private.has_restaurant_role(
    v_restaurant.id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el catálogo de este restaurante' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para realizar modificaciones en el catálogo.'
      USING ERRCODE = 'P0005';
  END IF;

  IF length(trim(p_name)) < 2 OR length(trim(p_name)) > 140 THEN
    RAISE EXCEPTION 'El nombre del plato debe tener entre 2 y 140 caracteres' USING ERRCODE = '22023';
  END IF;

  IF p_slug !~ '^[a-z0-9-]+$' OR length(trim(p_slug)) < 2 OR length(trim(p_slug)) > 80 THEN
    RAISE EXCEPTION 'El slug del plato debe ser alfanumérico en minúsculas con guiones y tener entre 2 y 80 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF p_base_price IS NULL OR p_base_price < 1000 OR p_base_price > 50000000 THEN
    RAISE EXCEPTION 'El precio base debe estar entre $1.000 y $50.000.000 COP' USING ERRCODE = '22023';
  END IF;

  IF p_compare_at_price IS NOT NULL AND p_compare_at_price <= p_base_price THEN
    RAISE EXCEPTION 'El precio de comparación debe ser estrictamente mayor al precio base' USING ERRCODE = '22023';
  END IF;

  IF p_availability_status NOT IN ('available', 'sold_out', 'hidden') THEN
    RAISE EXCEPTION 'Estado de disponibilidad del plato inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = p_category_id
      AND c.restaurant_id = v_restaurant.id
  ) THEN
    RAISE EXCEPTION 'Categoría no válida para este restaurante' USING ERRCODE = '22023';
  END IF;

  IF p_exclusive_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = p_exclusive_location_id
      AND l.restaurant_id = v_restaurant.id
  ) THEN
    RAISE EXCEPTION 'Sede exclusiva no válida' USING ERRCODE = '22023';
  END IF;

  -- Protect security test fixture
  IF (p_product_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id AND p.slug = 'corte-secreto-pruebas-internas'
  )) OR p_slug = 'corte-secreto-pruebas-internas' THEN
    RAISE EXCEPTION 'Este producto de prueba de seguridad RLS no puede modificarse' USING ERRCODE = '42501';
  END IF;

  -- Ensure uniqueness of slug inside this restaurant
  IF EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.restaurant_id = v_restaurant.id
      AND p.slug = lower(trim(p_slug))
      AND (p_product_id IS NULL OR p.id <> p_product_id)
  ) THEN
    RAISE EXCEPTION 'Ya existe un plato con el identificador / slug "%" en este restaurante', p_slug USING ERRCODE = '23505';
  END IF;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products (
      restaurant_id,
      category_id,
      slug,
      name,
      short_description,
      long_description,
      base_price,
      compare_at_price,
      image_url,
      image_alt,
      availability_status,
      is_featured,
      is_new,
      is_chef_choice,
      badges,
      portion_label,
      exclusive_location_id,
      sort_order
    ) VALUES (
      v_restaurant.id,
      p_category_id,
      lower(trim(p_slug)),
      trim(p_name),
      nullif(trim(p_short_description), ''),
      nullif(trim(p_long_description), ''),
      p_base_price,
      p_compare_at_price,
      nullif(trim(p_image_url), ''),
      nullif(trim(p_image_alt), ''),
      p_availability_status,
      COALESCE(p_is_featured, false),
      COALESCE(p_is_new, false),
      COALESCE(p_is_chef_choice, false),
      COALESCE(p_badges, '{}'::text[]),
      nullif(trim(p_portion_label), ''),
      p_exclusive_location_id,
      COALESCE(p_sort_order, 0)
    ) RETURNING * INTO v_product;

    v_action := 'product.create';
  ELSE
    SELECT * INTO v_old_product
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.restaurant_id = v_restaurant.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plato no encontrado' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.products
    SET
      category_id = p_category_id,
      slug = lower(trim(p_slug)),
      name = trim(p_name),
      short_description = nullif(trim(p_short_description), ''),
      long_description = nullif(trim(p_long_description), ''),
      base_price = p_base_price,
      compare_at_price = p_compare_at_price,
      image_url = nullif(trim(p_image_url), ''),
      image_alt = nullif(trim(p_image_alt), ''),
      availability_status = p_availability_status,
      is_featured = COALESCE(p_is_featured, false),
      is_new = COALESCE(p_is_new, false),
      is_chef_choice = COALESCE(p_is_chef_choice, false),
      badges = COALESCE(p_badges, '{}'::text[]),
      portion_label = nullif(trim(p_portion_label), ''),
      exclusive_location_id = p_exclusive_location_id,
      sort_order = COALESCE(p_sort_order, sort_order),
      updated_at = now()
    WHERE id = p_product_id
      AND restaurant_id = v_restaurant.id
    RETURNING * INTO v_product;

    v_action := 'product.update';
  END IF;

  -- Synchronize Option Groups and Options declaratively
  IF p_option_groups IS NOT NULL AND jsonb_typeof(p_option_groups) = 'array' THEN
    -- Delete existing option groups for this product (cascades to product_options)
    DELETE FROM public.product_option_groups
    WHERE product_id = v_product.id
      AND restaurant_id = v_restaurant.id;

    FOR v_grp_elem IN SELECT * FROM jsonb_array_elements(p_option_groups)
    LOOP
      IF trim(COALESCE(v_grp_elem->>'name', '')) <> '' THEN
        INSERT INTO public.product_option_groups (
          restaurant_id,
          product_id,
          name,
          helper_text,
          is_required,
          min_selections,
          max_selections,
          sort_order
        ) VALUES (
          v_restaurant.id,
          v_product.id,
          trim(v_grp_elem->>'name'),
          nullif(trim(COALESCE(v_grp_elem->>'helper_text', '')), ''),
          COALESCE((v_grp_elem->>'is_required')::boolean, false),
          GREATEST(0, COALESCE((v_grp_elem->>'min_selections')::integer, 0)),
          GREATEST(1, COALESCE((v_grp_elem->>'max_selections')::integer, 1)),
          COALESCE((v_grp_elem->>'sort_order')::integer, 0)
        ) RETURNING id INTO v_grp_id;

        IF v_grp_elem ? 'options' AND jsonb_typeof(v_grp_elem->'options') = 'array' THEN
          FOR v_opt_elem IN SELECT * FROM jsonb_array_elements(v_grp_elem->'options')
          LOOP
            IF trim(COALESCE(v_opt_elem->>'name', '')) <> '' THEN
              INSERT INTO public.product_options (
                restaurant_id,
                option_group_id,
                name,
                price_delta,
                is_available,
                sort_order
              ) VALUES (
                v_restaurant.id,
                v_grp_id,
                trim(v_opt_elem->>'name'),
                GREATEST(0, COALESCE((v_opt_elem->>'price_delta')::numeric, 0)),
                COALESCE((v_opt_elem->>'is_available')::boolean, true),
                COALESCE((v_opt_elem->>'sort_order')::integer, 0)
              );
            END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (
    restaurant_id,
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    NULL,
    auth.uid(),
    v_action,
    'product',
    v_product.id,
    CASE WHEN v_action = 'product.update' THEN row_to_json(v_old_product) ELSE NULL END,
    row_to_json(v_product)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', v_product.id,
    'slug', v_product.slug,
    'name', v_product.name
  );
END;
$$;

REVOKE ALL ON FUNCTION private.admin_upsert_product_impl(text, uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, text, boolean, boolean, boolean, text[], uuid, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_upsert_product_impl(text, uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, text, boolean, boolean, boolean, text[], uuid, integer, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_restaurant_slug text,
  p_product_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_slug text DEFAULT '',
  p_short_description text DEFAULT NULL,
  p_long_description text DEFAULT NULL,
  p_base_price numeric DEFAULT 0,
  p_compare_at_price numeric DEFAULT NULL,
  p_portion_label text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_image_alt text DEFAULT NULL,
  p_availability_status text DEFAULT 'available',
  p_is_featured boolean DEFAULT false,
  p_is_new boolean DEFAULT false,
  p_is_chef_choice boolean DEFAULT false,
  p_badges text[] DEFAULT '{}'::text[],
  p_exclusive_location_id uuid DEFAULT NULL,
  p_sort_order integer DEFAULT 0,
  p_option_groups jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_upsert_product_impl(
    p_restaurant_slug,
    p_product_id,
    p_category_id,
    p_name,
    p_slug,
    p_short_description,
    p_long_description,
    p_base_price,
    p_compare_at_price,
    p_portion_label,
    p_image_url,
    p_image_alt,
    p_availability_status,
    p_is_featured,
    p_is_new,
    p_is_chef_choice,
    p_badges,
    p_exclusive_location_id,
    p_sort_order,
    p_option_groups
  );
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_product(text, uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, text, boolean, boolean, boolean, text[], uuid, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(text, uuid, uuid, text, text, text, text, numeric, numeric, text, text, text, text, boolean, boolean, boolean, text[], uuid, integer, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.admin_delete_product_impl(
  p_restaurant_slug text,
  p_product_id uuid
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
  ELSIF auth.uid() IS NOT NULL AND private.has_restaurant_role(
    v_restaurant.id,
    ARRAY['owner', 'admin']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para eliminar platos' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para realizar modificaciones en el catálogo.'
      USING ERRCODE = 'P0005';
  END IF;

  SELECT * INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plato no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_product.slug = 'corte-secreto-pruebas-internas' THEN
    RAISE EXCEPTION 'Este producto de prueba de seguridad RLS no puede eliminarse' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.products
  WHERE id = p_product_id
    AND restaurant_id = v_restaurant.id;

  INSERT INTO public.audit_logs (
    restaurant_id,
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    NULL,
    auth.uid(),
    'product.delete',
    'product',
    p_product_id,
    row_to_json(v_product),
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_id', p_product_id,
    'deleted_name', v_product.name
  );
END;
$$;

REVOKE ALL ON FUNCTION private.admin_delete_product_impl(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_delete_product_impl(text, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_product(
  p_restaurant_slug text,
  p_product_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_delete_product_impl(
    p_restaurant_slug,
    p_product_id
  );
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(text, uuid) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Extend Operational Console Snapshot with Categories and Option Groups
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.get_operational_console_snapshot_impl(
  p_restaurant_slug text,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_entitlements public.restaurant_entitlements%ROWTYPE;
  v_has_access boolean := false;
  v_categories jsonb;
  v_products jsonb;
  v_inquiries jsonb;
  v_direct_orders jsonb;
  v_audit_logs jsonb;
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
  ELSIF auth.uid() IS NOT NULL AND private.has_location_role(
    v_restaurant.id,
    p_location_id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acceso denegado a la consola operativa de este tenant' USING ERRCODE = '42501';
  END IF;

  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = p_location_id AND l.restaurant_id = v_restaurant.id
  ) THEN
    RAISE EXCEPTION 'Sede no válida para este restaurante' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_entitlements
  FROM public.restaurant_entitlements re
  WHERE re.restaurant_id = v_restaurant.id;

  -- Categories with real product count
  SELECT COALESCE(jsonb_agg(row_to_json(c_row)), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT
      c.id,
      c.menu_id,
      c.slug,
      c.name,
      c.subtitle,
      c.description,
      c.display_mode,
      c.is_active,
      c.sort_order,
      (
        SELECT count(*)::integer
        FROM public.products p
        WHERE p.category_id = c.id
          AND p.restaurant_id = v_restaurant.id
          AND p.slug <> 'corte-secreto-pruebas-internas'
      ) AS products_count
    FROM public.categories c
    WHERE c.restaurant_id = v_restaurant.id
    ORDER BY c.sort_order ASC
  ) c_row;

  -- Products with details and option groups
  SELECT COALESCE(jsonb_agg(row_to_json(p_row)), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      p.id,
      p.slug,
      p.name,
      p.short_description,
      p.long_description,
      p.base_price AS global_base_price,
      COALESCE(
        CASE WHEN p_location_id IS NOT NULL THEN pl.price_override ELSE NULL END,
        p.base_price
      ) AS base_price,
      p.compare_at_price,
      CASE WHEN p_location_id IS NOT NULL THEN pl.price_override ELSE NULL END AS price_override,
      p.availability_status AS global_availability_status,
      CASE
        WHEN p_location_id IS NOT NULL AND pl.id IS NOT NULL AND pl.is_offered = false THEN 'hidden'
        WHEN p_location_id IS NOT NULL AND pl.id IS NOT NULL THEN pl.availability_status
        ELSE p.availability_status
      END AS availability_status,
      p.is_featured,
      p.is_new,
      p.is_chef_choice,
      p.badges,
      p.portion_label,
      p.image_url,
      p.image_alt,
      p.category_id,
      c.name AS category_name,
      p.exclusive_location_id,
      l.name AS exclusive_location_name,
      (
        SELECT count(*)::integer
        FROM public.product_locations pl_cnt
        WHERE pl_cnt.product_id = p.id
          AND (pl_cnt.price_override IS NOT NULL OR pl_cnt.availability_status <> 'available' OR pl_cnt.is_offered = false)
      ) AS location_overrides_count,
      p.sort_order,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', pog.id,
              'name', pog.name,
              'helper_text', pog.helper_text,
              'is_required', pog.is_required,
              'min_selections', pog.min_selections,
              'max_selections', pog.max_selections,
              'sort_order', pog.sort_order,
              'options', (
                SELECT COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', po.id,
                      'name', po.name,
                      'price_delta', po.price_delta,
                      'is_available', po.is_available,
                      'sort_order', po.sort_order
                    ) ORDER BY po.sort_order ASC
                  ),
                  '[]'::jsonb
                )
                FROM public.product_options po
                WHERE po.option_group_id = pog.id
              )
            ) ORDER BY pog.sort_order ASC
          ),
          '[]'::jsonb
        )
        FROM public.product_option_groups pog
        WHERE pog.product_id = p.id
      ) AS option_groups,
      p.updated_at
    FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.locations l ON l.id = p.exclusive_location_id
    LEFT JOIN public.product_locations pl
      ON p_location_id IS NOT NULL
      AND pl.product_id = p.id
      AND pl.location_id = p_location_id
    WHERE p.restaurant_id = v_restaurant.id
      AND p.slug <> 'corte-secreto-pruebas-internas'
      AND (
        p_location_id IS NULL
        OR p.exclusive_location_id IS NULL
        OR p.exclusive_location_id = p_location_id
      )
    ORDER BY c.sort_order ASC, p.sort_order ASC
  ) p_row;

  SELECT COALESCE(jsonb_agg(row_to_json(i_row)), '[]'::jsonb)
  INTO v_inquiries
  FROM (
    SELECT
      ei.id,
      ei.reference_code,
      ei.location_id,
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
      l.city AS location_city,
      es.name AS event_space_name,
      ep.name AS event_package_name,
      ep.base_price AS package_base_price
    FROM public.event_inquiries ei
    LEFT JOIN public.locations l ON l.id = ei.location_id
    LEFT JOIN public.event_spaces es ON es.id = ei.event_space_id
    LEFT JOIN public.event_packages ep ON ep.id = ei.event_package_id
    WHERE ei.restaurant_id = v_restaurant.id
      AND (p_location_id IS NULL OR ei.location_id = p_location_id)
    ORDER BY ei.created_at DESC
    LIMIT 30
  ) i_row;

  SELECT COALESCE(jsonb_agg(row_to_json(o_row)), '[]'::jsonb)
  INTO v_direct_orders
  FROM (
    SELECT
      ord.id,
      ord.reference_code,
      ord.location_id,
      ord.fulfillment_type,
      ord.table_number,
      ord.pickup_slot,
      ord.customer_name,
      ord.customer_phone,
      ord.delivery_address,
      ord.delivery_neighborhood,
      ord.delivery_notes,
      ord.payment_method,
      ord.payment_details,
      ord.items,
      ord.subtotal_amount,
      ord.delivery_fee,
      ord.total_amount,
      ord.status,
      ord.internal_admin_notes,
      ord.created_at,
      ord.updated_at,
      l.name AS location_name,
      l.city AS location_city
    FROM public.direct_orders ord
    LEFT JOIN public.locations l ON l.id = ord.location_id
    WHERE ord.restaurant_id = v_restaurant.id
      AND (p_location_id IS NULL OR ord.location_id = p_location_id)
    ORDER BY ord.created_at DESC
    LIMIT 35
  ) o_row;

  SELECT COALESCE(jsonb_agg(row_to_json(a_row)), '[]'::jsonb)
  INTO v_audit_logs
  FROM (
    SELECT
      al.id,
      al.location_id,
      l.name AS location_name,
      al.action,
      al.entity_type,
      al.entity_id,
      al.previous_state,
      al.new_state,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.locations l ON l.id = al.location_id
    WHERE al.restaurant_id = v_restaurant.id
      AND (p_location_id IS NULL OR al.location_id = p_location_id OR al.location_id IS NULL)
    ORDER BY al.created_at DESC
    LIMIT 20
  ) a_row;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'restaurant_slug', v_restaurant.slug,
    'selected_location_id', p_location_id,
    'entitlements', row_to_json(v_entitlements),
    'categories', v_categories,
    'products', v_products,
    'inquiries', v_inquiries,
    'direct_orders', v_direct_orders,
    'audit_logs', v_audit_logs
  );
END;
$$;

REVOKE ALL ON FUNCTION private.get_operational_console_snapshot_impl(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_operational_console_snapshot_impl(text, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_operational_console_snapshot(
  p_restaurant_slug text,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_operational_console_snapshot_impl(p_restaurant_slug, p_location_id);
$$;

REVOKE ALL ON FUNCTION public.get_operational_console_snapshot(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_operational_console_snapshot(text, uuid) TO anon, authenticated, service_role;
-- ----------------------------------------------------------------------------
-- 5. Seed New Categories for Casa Brasa (Multi-City Steakhouse)
-- ----------------------------------------------------------------------------


INSERT INTO public.categories (
  id, restaurant_id, menu_id, slug, name, subtitle, description, display_mode, is_active, sort_order
) VALUES
(
  '11111111-1111-4111-8111-111111111305',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111201',
  'guarniciones-y-vegetales',
  'Guarniciones Artesanales & Vegetales al Fuego',
  'Acompañamientos nobles cocinados al rescoldo',
  'Papas nativas, vegetales orgánicos glaseados al fuego y arroces melosos.',
  'editorial_grid', true, 5
),
(
  '11111111-1111-4111-8111-111111111306',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111201',
  'postres-y-cafes-de-origen',
  'Postres al Horno de Leña & Cafés de Finca',
  'El cierre dulce con chocolate de origen y café especial',
  'Postres horneados al minuto y café Geisha filtrado en mesa.',
  'editorial_grid', true, 6
),
(
  '11111111-1111-4111-8111-111111111307',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111201',
  'cortes-wagyu-y-especiales',
  'Selección Especial Wagyu & Cortes de Autor',
  'Marmoleo superior BMS 7 a 12 de lotes exclusivos',
  'Cortes con infiltración de grasa sedosa y máxima terneza.',
  'editorial_grid', true, 7
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ----------------------------------------------------------------------------
-- 6. Seed 93 Additional Dishes for Casa Brasa (Reaching 104 Total Dishes)
-- ----------------------------------------------------------------------------


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'carpaccio-de-lomo-trufa-y-parmesano', 'Carpaccio de Lomo Maduro, Trufa & Lascas de Parmesano 24 Meses', 'Finas láminas de solomillo madurado, vinagreta tibia de trufa negra, alcaparras baby y rúgula silvestre.',
  52000, NULL, 'available', true, false, false,
  ARRAY['Sin Gluten', 'Entrada Fría']::text[], '140g · Ideal para compartir', 3
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'empanadas-de-costilla-brasa', 'Trilogía de Empanadas de Asado de Tira al Fuego', 'Masa crocante de maíz amarillo rellena de costilla desmechada braseada durante 12 horas, con ají de maracuyá.',
  38000, NULL, 'available', false, true, false,
  ARRAY['Receta de Autor']::text[], '3 unidades · 180g', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'morcilla-artesanal-y-chimichurri', 'Morcilla Bombón Artesanal a la Parrilla con Manzana Asada', 'Embutido de la casa con arroz y especias andinas, chutney de manzana verde al rescoldo y reducción de balsámico.',
  36000, NULL, 'available', false, false, false,
  ARRAY['Tradición Brasa']::text[], '200g', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'chorizo-de-cochinillo-ahumado', 'Chorizo Rústico de Cochinillo Ahumado al Quebracho', 'Elaborado en taller propio con trozos nobles de cerdo ibérico y pimentón dulce, servido con arepa de choclo tibia.',
  42000, NULL, 'available', false, false, true,
  ARRAY['Embutido de Autor']::text[], '220g · Incluye arepa', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'provoleta-fundida-con-oregano', 'Provoleta al Hierro Fundido con Pimientos Confitados', 'Queso provolone hilado dorado a la brasa con orégano fresco de la huerta, tomates secos y pan de masa madre.',
  44000, NULL, 'available', false, false, false,
  ARRAY['Vegetariano']::text[], '250g al horno de barro', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'tartar-de-atun-rojo-y-aguacate', 'Tartar de Atún Rojo del Pacífico con Aguacate Tatemado', 'Atún calidad sashimi marinado en soya añeja, aceite de ajonjolí tostado y emulsión de aguacate a la brasa.',
  58000, NULL, 'available', true, false, true,
  ARRAY['Del Mar', 'Sin Gluten']::text[], '160g', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'croquetas-de-jamon-serrano', 'Croquetas Melosas de Jamón Ibérico & Alioli de Ajo Asado', 'Bechamel cremosa con jamón curado 18 meses, rebozado crujiente panko y toque de ciboulette fresco.',
  39000, NULL, 'available', false, false, false,
  ARRAY['Recomendado']::text[], '4 unidades', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'chicharron-de-tira-crocante', 'Panceta Crujiente en Cocción Lenta & Guacamole Ahumado', 'Chicharrón de cerdo criado en pastura, piel suflada extracrocante con sal marina y lima kaffir.',
  48000, NULL, 'available', false, false, false,
  ARRAY['Favorito']::text[], '280g', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'langostinos-al-ajillo-de-lena', 'Langostinos Jumbo al Ajillo con Mantequilla de Avellana', 'Salteados al hierro con ajo laminado dorado, vino blanco seco, perejil crespo y chips de focaccia.',
  68000, NULL, 'available', true, false, false,
  ARRAY['Mariscos al Fuego']::text[], '4 unidades jumbo · 220g', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111301', 'calamares-al-humo-de-romero', 'Calamares del Caribe Sellados al Humo de Romero Silvestre', 'Tubos de calamar tiernos pasados por la plancha de hierro a 300°C con vinagreta de cítricos y albahaca.',
  49000, NULL, 'sold_out', false, false, false,
  ARRAY['Temporada']::text[], '190g', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'bife-de-chorizo-400g-dry-aged', 'Bife de Chorizo Clásico · Dry-Aged 30 Días', 'Corte tradicional argentino con capa de grasa exterior caramelizada y terneza profunda por maduración en sal.',
  118000, NULL, 'available', true, false, true,
  ARRAY['Corte Noble', 'Dry-Aged 30 Días']::text[], '400g en crudo · Incluye 1 guarnición', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'vacio-angus-al-asador-lento', 'Vacío de Res Angus al Asador de Cruz (Cocción 3 Horas)', 'Corte fibroso de gran sabor cocinado a fuego indirecto con leña de manzano hasta lograr jugosidad absoluta.',
  98000, NULL, 'available', false, false, false,
  ARRAY['Cocción Lenta', 'Angus Certificado']::text[], '380g', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'asado-de-tira-banderita-angus', 'Asado de Tira Corte Banderita · Grano & Pastura', 'Costillas de res cortadas transversalmente a 1 cm, doradas a fuego rápido con sal en grano y chimichurri rústico.',
  89000, NULL, 'available', false, false, false,
  ARRAY['Clásico Parrillero']::text[], '450g con hueso', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'entrecote-parisien-a-la-pimienta', 'Entrecôte Parisien con Salsa de Pimienta Verde & Cognac', 'Bife angosto bañado en emulsión tibia de fondo oscuro reducido, crema de leche y granos de pimienta de Madagascar.',
  122000, NULL, 'available', false, true, false,
  ARRAY['Clásico Internacional']::text[], '350g', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 't-bone-steak-porterhouse-600g', 'Porterhouse T-Bone · Lomo & Filete en un Solo Corte', 'La unión perfecta del bife de chorizo y el lomo fino separados por el característico hueso en T.',
  175000, NULL, 'available', true, false, true,
  ARRAY['Corte Doble', '40 Días Maduración']::text[], '650g con hueso', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'medallon-de-lomo-fino-al-trapo', 'Solomillo de Res al Trapo al Estilo Andino', 'Lomo fino envuelto en lienzo de algodón con costra densa de sal marina y orégano, asado directo sobre las brasas.',
  86000, NULL, 'available', false, false, false,
  ARRAY['Magro & Tierno']::text[], '300g centro de lomo', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'picanha-black-angus-en-espada', 'Picanha Black Angus Sellada en Espada de Autor', 'Tapa de cuadril con media luna de grasa crocante, laminada al momento frente a la mesa con escamas de sal.',
  105000, NULL, 'available', true, false, false,
  ARRAY['Parrilla Tradicional']::text[], '400g para compartir', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'short-rib-braseado-16-horas', 'Costilla de Res Short Rib Braseada al Tinto & Tuétano', 'Hueso completo de costilla que se desprende con cuchara, glaseado con miel de caña y cerveza negra artesanal.',
  96000, NULL, 'available', false, false, true,
  ARRAY['Plato Insignia Cocina Lenta']::text[], '500g con hueso', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'costillas-de-cordero-patagonico', 'Rack de Costillas de Cordero con Costra de Finas Hierbas', 'Cordero joven asado al punto rosado con romero fresco, tomillo de páramo y mostaza dijonnaise.',
  135000, NULL, 'available', false, true, false,
  ARRAY['Importado']::text[], '380g · 4 costillas', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'pechuga-campestre-al-limon-y-rescoldo', 'Pechuga de Pollo Orgánico Pastoril al Carbón', 'Pollo de campo marinado con limón mandarino, ajo confitado y orégano de huerta, terminado con piel crujiente.',
  56000, NULL, 'available', false, false, false,
  ARRAY['Opción Ligera']::text[], '320g', 13
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'salmon-chileno-a-la-tabla-de-cedro', 'Salmón del Pacífico Asado sobre Tabla de Cedro Ahumado', 'Filete fresco sellado sobre madera templada con glaseado de maracuyá picante y sésamo negro.',
  78000, NULL, 'available', false, false, false,
  ARRAY['Pescados al Fuego']::text[], '280g', 14
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111302', 'matambre-de-cerdo-a-la-pizza', 'Matambre de Cerdo a la Leña con Mozzarella & Tomates Asados', 'Corte plano de cerdo dorado a fuego vivo con salsa napolitana casera, orégano silvestre y albahaca fresca.',
  69000, NULL, 'available', false, false, false,
  ARRAY['Receta Especial']::text[], '350g', 15
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'wagyu-a5-kagoshima-strip-200g', 'Wagyu A5 Kagoshima Ribeye · Certificado Japón (BMS 10-12)', 'La máxima expresión de marmoleado del mundo. Carne japonesa de textura etérea que se funde a temperatura corporal.',
  285000, NULL, 'available', true, true, true,
  ARRAY['A5 Japón', 'BMS 10-12', 'Edición Límite']::text[], '200g servido sobre piedra caliente', 1
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'wagyu-cross-flank-steak-bavette', 'Bavette Wagyu Cross F1 Australiano · Marmoleo 7+', 'Corte de vacío interno con fibras jugosas y profundo perfil mineral, sellado a la plancha de hierro fundido.',
  148000, NULL, 'available', false, false, true,
  ARRAY['Wagyu Australiano']::text[], '350g', 2
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'hamburguesa-wagyu-brasa-trufada', 'Burger Insignia Wagyu 220g en Pan Brioche & Trufa Negra', 'Blend de Wagyu y picaña madurada, queso cheddar inglés 12 meses, tocineta ahumada al manzano y mayo de trufa.',
  64000, NULL, 'available', true, false, false,
  ARRAY['Favorito Gourmet']::text[], '220g carne + papas rústicas', 3
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'picanha-wagyu-australiana-400g', 'Picanha Wagyu Australiana Marmoleo 8-9', 'Infiltración uniforme de grasa dulce y aromática, asada entera a fuego lento y fileteada al término.',
  189000, NULL, 'available', false, false, true,
  ARRAY['Corte Exclusivo']::text[], '400g', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'denver-steak-wagyu-cross', 'Denver Cut Wagyu Cross · Centro de Aguja Tierno', 'El secreto mejor guardado de los carniceros: un músculo oculto con marmoleado excepcional similar al ribeye.',
  128000, NULL, 'available', false, false, false,
  ARRAY['Descubrimiento']::text[], '320g', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'flat-iron-steak-black-onyx', 'Flat Iron Black Onyx · Mármol MB3+ Reserva', 'Segundo corte más tierno de la res tras el lomo fino, libre de grasa superficial con gran jugosidad.',
  112000, NULL, 'available', false, false, false,
  ARRAY['Black Onyx']::text[], '300g', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'entrecote-dry-aged-60-dias-reserva', 'Entrecôte Gran Reserva · Maduración Extrema 60 Días', 'Notas potentes a queso azul añejo, avellanas tostadas y mantequilla de pastura. Exclusivo para paladares expertos.',
  168000, NULL, 'available', true, false, true,
  ARRAY['Dry-Aged 60 Días', 'Stock Limitado']::text[], '380g', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'steak-tartare-wagyu-en-mesa', 'Steak Tartare de Wagyu Preparado Frente al Comensal', 'Picado a mano al momento con chalotas, yema de huevo orgánico de campo, alcaparras y tostadas de brioche.',
  72000, NULL, 'available', false, true, false,
  ARRAY['Experiencia en Mesa']::text[], '180g', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'costillar-asado-wagyu-short-rib', 'Costillar Wagyu Short Rib de 800g a Fuego Lento', 'Asado durante 8 horas sobre leña de encino con rociado constante de caldo de huesos y vinagre de manzana.',
  198000, NULL, 'sold_out', false, false, false,
  ARRAY['Agotado por Lote']::text[], '800g con hueso', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111307', 'lomo-fino-rossini-con-foie-gras', 'Solomillo Rossini con Medallón de Foie Gras & Salsa Oporto', 'Lomo fino al punto exacto coronado con hígado de pato sellado a fuego vivo y reducción aterciopelada de vino dulce.',
  158000, NULL, 'available', false, false, true,
  ARRAY['Alta Cocina']::text[], '250g solomillo + 60g foie', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'pure-de-papa-criolla-trufa-negra', 'Puré Cremoso de Papa Criolla con Mantequilla de Trufa', 'Papa criolla andina batida con crema fresca de ordeño, mantequilla francesa y brunoise de trufa negra.',
  28000, NULL, 'available', false, false, true,
  ARRAY['Sin Gluten', 'Vegetariano']::text[], '220g', 1
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'papas-rusticas-con-parmesano-y-romero', 'Papas Rústicas Doble Cocción con Parmesano & Romero', 'Hervidas primero y luego fritas a alta temperatura para lograr piel crocante y corazón suave como crema.',
  24000, NULL, 'available', false, false, false,
  ARRAY['Favorito']::text[], '250g', 2
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'zanahorias-baby-glaseadas-al-fuego', 'Zanahorias Baby Asadas con Miel de Abejas & Comino Tostado', 'Zanahorias orgánicas enteras caramelizadas a la parrilla con reducción de naranja agria y sal en escamas.',
  22000, NULL, 'available', false, false, false,
  ARRAY['Vegetariano']::text[], '200g', 3
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'ensalada-verde-de-rucula-y-parmesano', 'Ensalada de Rúgula Silvestre, Higos Asados & Gorgonzola', 'Hojas frescas de rúgula aliñadas con vinagreta de miel de panela, nueces garrapiñadas y queso azul cremoso.',
  32000, NULL, 'available', false, false, false,
  ARRAY['Ensalada Fresca']::text[], '190g', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'arroz-meloso-al-rescoldo-con-tuetano', 'Arroz Meloso al Sartén de Hierro con Sofrito & Tuétano', 'Arroz de grano corto tostado en grasa de costilla con fondo oscuro de cocción lenta y cebollino fino.',
  34000, NULL, 'available', true, false, false,
  ARRAY['Tradición de Fuego']::text[], '280g', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'tomates-heirloom-con-burrata-tibia', 'Burrata Artesanal 150g con Tomates Heirloom Confitados', 'Corazón cremoso de stracciatella sobre tomates asados a la leña, pesto de albahaca fresca y piñones.',
  46000, NULL, 'available', true, false, true,
  ARRAY['Vegetariano']::text[], '300g', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'maiz-tierno-choclo-con-queso-costeno', 'Mazorca Dulce Desgranada con Queso Costeño Rallado & Ají Suave', 'Choclo tierno sellado a las brasas bañado con crema agria, cilantro cimarrón y toque de paprika ahumada.',
  26000, NULL, 'available', false, false, false,
  ARRAY['Acompañamiento Clásico']::text[], '230g', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'cebollas-asadas-al-balsamico', 'Cebollas Moradas Caramelizadas al Horno con Romero & Aceto', 'Cebollas enteras asadas entre las cenizas con reducción espesa de aceto balsámico de Módena.',
  21000, NULL, 'available', false, false, false,
  ARRAY['Vegano', 'Sin Gluten']::text[], '180g', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'yucas-fritas-con-suero-atollabuey', 'Yucas Bravas Crujientes con Suero Criollo & Chiles Dulces', 'Bastones de yuca cocida al vapor y frita al punto dorado con dip artesanal de suero costeño.',
  23000, NULL, 'available', false, false, false,
  ARRAY['Típico']::text[], '240g', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'champinones-salteados-al-jerez', 'Mix de Hongos Silvestres & Setas al Sartén con Jerez Oloroso', 'Portobello, champiñón París y shiitake salteados con chalotas, tomillo fresco y vino generoso.',
  36000, NULL, 'available', false, false, false,
  ARRAY['Vegetariano']::text[], '210g', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'platano-maduro-asado-con-queso', 'Plátano Maduro al Horno con Bocadillo Veleño & Queso Paipa', 'La clásica combinación dulce y salada colombiana con queso Paipa semimaduro derretido a la leña.',
  25000, NULL, 'available', false, false, false,
  ARRAY['Dulce & Salado']::text[], '220g', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'espinacas-a-la-crema-gratinadas', 'Espinacas Frescas a la Crema con Nuez Moscada & Gruyère', 'Hojas tiernas reducidas en bechamel suave con queso gruyère suizo gratinado a la salamandra.',
  29000, NULL, 'available', false, false, false,
  ARRAY['Vegetariano']::text[], '200g', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'ensalada-coleslaw-con-manzana-verde', 'Coleslaw Rústico de Repollo Morado, Manzana & Mostaza Antigua', 'Ensalada refrescante con mayonesa ligera de yogur griego, semillas de girasol tostadas y vinagre de sidra.',
  19000, NULL, 'available', false, false, false,
  ARRAY['Acompañamiento Fresco']::text[], '180g', 13
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111305', 'focaccia-artesanal-de-masa-madre', 'Focaccia de Romero & Sal Marina Horneada en Casa', 'Elaborada diariamente con fermentación natural de 48 horas y aceite de oliva virgen extra español.',
  18000, NULL, 'available', false, false, false,
  ARRAY['Panadería Propia']::text[], '4 porciones', 14
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'luigi-bosca-malbec-doc', 'Luigi Bosca D.O.C. Single Vineyard Malbec · Luján de Cuyo', 'Aromas a moras maduras, café y especias dulces. Taninos maduros y cuerpo estructurado.',
  185000, NULL, 'available', false, false, false,
  ARRAY['Tinto Argentina']::text[], 'Botella 750ml', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'enemigo-cabernet-franc', 'El Enemigo Cabernet Franc · Gualtallary, Valle de Uco', 'Elaborado por Alejandro Vigil. Notas herbales, fruta negra, pimienta y acidez mineral vibrante.',
  265000, NULL, 'available', true, false, true,
  ARRAY['Vino de Culto', '94 Pts']::text[], 'Botella 750ml', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'rutini-cabernet-malbec', 'Rutini Cabernet - Malbec Encuentro · Mendoza', 'Clásico coupage argentino con 12 meses de crianza en barrica de roble francés y americano.',
  210000, NULL, 'available', false, false, false,
  ARRAY['Tinto Equilibrado']::text[], 'Botella 750ml', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'pesquera-crianza-ribera-del-duero', 'Tinto Pesquera Crianza · D.O. Ribera del Duero, España', '100% Tempranillo de Alejandro Fernández. Fruta roja confitada, vainilla y final largo balsámico.',
  295000, NULL, 'available', false, false, true,
  ARRAY['Ribera del Duero']::text[], 'Botella 750ml', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'carmelo-patti-cabernet-sauvignon', 'Carmelo Patti Cabernet Sauvignon Reserva · Perdriel', 'Vino de autor tradicional de producción minúscula. Estilo bordelés con más de 5 años de estiba.',
  320000, NULL, 'available', false, true, false,
  ARRAY['Edición de Colección']::text[], 'Botella 750ml', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'clos-des-fous-pinot-noir', 'Clos des Fous Pinot Noir Latuffa · Traiguén, Chile Austral', 'Pinot Noir de clima frío extremo sobre suelos volcánicos. Frutillas silvestres, tierra mojada y sotobosque.',
  240000, NULL, 'available', false, false, false,
  ARRAY['Tinto Fresco']::text[], 'Botella 750ml', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'montes-alpha-syrah-colchagua', 'Montes Alpha Syrah · Valle de Colchagua, Chile', 'Potente, oscuro y carnoso con notas a grosellas negras, cuero y chocolate amargo.',
  195000, NULL, 'available', false, false, false,
  ARRAY['Syrah Reserva']::text[], 'Botella 750ml', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'chateaud-neuf-du-pape-guigal', 'E. Guigal Châteauneuf-du-Pape · Ródano Sur, Francia', 'Garnacha, Syrah y Mourvèdre. Ciruela madura, regaliz, garriga y elegancia ancestral francesa.',
  450000, NULL, 'available', true, false, true,
  ARRAY['Gran Cru Francés']::text[], 'Botella 750ml', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'brunello-di-montalcino-banfi', 'Castello Banfi Brunello di Montalcino DOCG · Toscana, Italia', '100% Sangiovese Grosso madurado 2 años en toneles de roble eslavo. Complejidad aromática pura.',
  520000, NULL, 'available', false, false, true,
  ARRAY['Ícono Italiano']::text[], 'Botella 750ml', 13
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'tapanappa-foggy-hill-pinot-noir', 'Tapanappa Foggy Hill Pinot Noir · Fleurieu, Australia', 'Expresión australiana refinada de viñedos costeros envueltos en niebla marina constante.',
  280000, NULL, 'available', false, false, false,
  ARRAY['Nuevo Mundo']::text[], 'Botella 750ml', 14
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'veuve-clicquot-brut-champagne', 'Veuve Clicquot Yellow Label Brut · Reims, Champagne, Francia', 'Burbuja fina persistente, notas de brioche tostado, manzana asada y frescura cítrica incomparable.',
  480000, NULL, 'available', true, false, false,
  ARRAY['Champagne Francés']::text[], 'Botella 750ml', 15
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'louis-roederer-cristal-reserva', 'Louis Roederer Cristal Millésime · Champagne Prestige', 'El champagne más célebre del mundo en añada excepcional. Pureza mineral y textura de seda.',
  1850000, NULL, 'available', false, false, true,
  ARRAY['Prestige Cuvée', 'Exclusivo']::text[], 'Botella 750ml', 16
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'cloudy-bay-sauvignon-blanc', 'Cloudy Bay Sauvignon Blanc · Marlborough, Nueva Zelanda', 'Referente mundial de la variedad: maracuyá intenso, lima fresca, pasto recién cortado y mineralidad.',
  275000, NULL, 'available', true, false, false,
  ARRAY['Blanco Insignia']::text[], 'Botella 750ml', 17
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'chablis-premier-cru-drouhin', 'Joseph Drouhin Chablis Premier Cru · Borgoña, Francia', 'Chardonnay puro sin madera. Piedra de fusil, cítricos amarillos y tensión marina limpia.',
  360000, NULL, 'available', false, false, false,
  ARRAY['Blanco Borgoña']::text[], 'Botella 750ml', 18
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'cava-gramona-imperial-gran-reserva', 'Gramona Imperial Corpinnat Gran Reserva Brut · Penedès', 'Espumoso biodinámico con más de 50 meses de crianza en rima. Bollería fina y manzana madura.',
  230000, NULL, 'available', false, false, false,
  ARRAY['Espumoso Método Tradicional']::text[], 'Botella 750ml', 19
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'whispering-angel-rose-provence', 'Château dEsclans Whispering Angel Rosé · Côtes de Provence', 'El rosado más afamado de la Costa Azul. Pálido, seco, con notas sutiles de durazno blanco y flores.',
  225000, NULL, 'available', false, false, false,
  ARRAY['Rosé de Provence']::text[], 'Botella 750ml', 20
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'copa-catena-zapata-malbec', 'Copa de Vino Catena Zapata Malbec Servida en Mesa', 'Degustación individual servida en copa Riedel Vinum desde botella preservada con sistema Coravin.',
  48000, NULL, 'available', false, false, false,
  ARRAY['Vino por Copa']::text[], 'Copa 150ml', 21
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'copa-cloudy-bay-sauvignon', 'Copa de Sauvignon Blanc Cloudy Bay Fría', 'Servida a 9°C en copa de cristal templado. Ideal para acompañar entradas al rescoldo o pescados.',
  52000, NULL, 'available', false, false, false,
  ARRAY['Vino por Copa']::text[], 'Copa 150ml', 22
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'oporto-taylor-fladgate-10-years', 'Taylor Fladgate 10 Year Old Tawny Port · Duero, Portugal', 'Vino fortificado con notas a higos secos, nueces caramelizadas y caramelo toffee. Perfecto con postres.',
  195000, NULL, 'available', false, false, false,
  ARRAY['Vino Fortificado']::text[], 'Botella 750ml', 23
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111304', 'copa-de-oporto-tawny-10-anos', 'Copa de Oporto Tawny 10 Años Digestivo', 'Servicio digestivo en copa cordial para culminar la sobremesa.',
  35000, NULL, 'available', false, false, false,
  ARRAY['Digestivo en Copa']::text[], 'Copa 75ml', 24
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'negroni-ahumado-con-mezcal', 'Negroni al Carbón & Mezcal Espadín Oaxaqueño', 'Gin artesanal, Campari infusionado con cacao, vermut rosso Carpano y humo de madera de cerezo.',
  48000, NULL, 'available', true, false, true,
  ARRAY['Coctel Insignia', 'Humo en Mesa']::text[], 'Vaso Old Fashioned · Hielo tallado', 2
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'smoky-margarita-con-jalapeno', 'Margarita Ahumada con Sal de Gusano & Jalapeño Asado', 'Tequila reposado 100% agave, licor de naranja, jugo de lima fresca y borde escarchado con sal de chile.',
  46000, NULL, 'available', false, false, false,
  ARRAY['Cítrico & Especiado']::text[], 'Copa Coupe', 3
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'bourbon-sour-miel-de-panela', 'Bourbon Sour con Miel de Panela Quemada & Albúmina', 'Whiskey Bourbon americano, zumo de limón mandarino, reducción de panela y gotas de Angostura.',
  44000, NULL, 'available', false, false, false,
  ARRAY['Equilibrado']::text[], 'Vaso bajo con hielo roca', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'gin-tonic-botanico-andino', 'Gin Tonic Andino con Bayas de Enebro & Romero Tatemado', 'Gin London Dry destilado con botánicos colombianos, agua tónica premium Fever-Tree y piel de pomelo.',
  45000, NULL, 'available', false, false, false,
  ARRAY['Refrescante']::text[], 'Copa Balón', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'mojito-de-ron-anejo-y-hierbabuena', 'Mojito Reserva de Ron Añejo Colombiano 12 Años', 'Macerado con hierbabuena fresca de páramo, azúcar morena de caña, lima y toque de soda artesanal.',
  42000, NULL, 'available', false, false, false,
  ARRAY['Clásico del Caribe']::text[], 'Vaso Collins', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'carajillo-con-licor-43-y-espresso', 'Carajillo Shakerato con Licor 43 & Café Geisha', 'Batido en coctelera con espresso doble recién extraído y licor de vainilla mediterráneo.',
  39000, NULL, 'available', true, false, false,
  ARRAY['Favorito Sobremesa']::text[], 'Copa corta', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'moscow-mule-en-taza-de-cobre', 'Moscow Mule en Vaso de Cobre con Ginger Beer Picante', 'Vodka ultrafiltrado, zumo de lima recién exprimido y refresco artesanal de jengibre fermentado.',
  44000, NULL, 'available', false, false, false,
  ARRAY['Cobre & Frío']::text[], 'Taza de cobre 350ml', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'penicillin-whisky-ahumado-turba', 'Penicillin Cocktail con Whisky Islay de Turba Intensa', 'Scotch mezclado con miel de jengibre, limón fresco y float de Laphroaig 10 años en superficie.',
  52000, NULL, 'available', false, true, true,
  ARRAY['Notas de Turba']::text[], 'Vaso Old Fashioned', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'sangria-tinto-reserva-de-la-casa', 'Jarra de Sangría de Autor con Frutas Asadas & Canela', 'Vino tinto reserva macerado con licor de naranja, manzanas a la brasa, fresas y naranja en rodajas.',
  95000, NULL, 'available', true, false, false,
  ARRAY['Para Compartir']::text[], 'Jarra 1 Litro (4 a 5 copas)', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'trago-macallan-12-anos-doble-barril', 'The Macallan 12 Años Double Cask Highland Single Malt', 'Trago de whisky escocés madurado en roble americano y europeo sazonado con jerez.',
  68000, NULL, 'available', false, false, false,
  ARRAY['Single Malt']::text[], 'Medida 2 oz · En vaso Riedel', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'trago-zacapa-23-solera-gran-reserva', 'Ron Zacapa Centenario 23 Sistema Solera', 'Ron de altura guatemalteco añejado en barricas de roble blanco con notas de toffee y miel de caña.',
  48000, NULL, 'available', false, false, false,
  ARRAY['Ron Reserva']::text[], 'Medida 2 oz', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'trago-tequila-don-julio-70-cristalino', 'Don Julio 70 Añejo Cristalino 100% Agave', 'El primer tequila añejo cristalino del mundo: notas amaderadas y vainilla con suavidad de blanco.',
  55000, NULL, 'available', false, false, false,
  ARRAY['Tequila Premium']::text[], 'Medida 2 oz', 13
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'limonada-de-coco-fresca', 'Limonada Frappé de Coco Natural (Mocktail Sin Alcohol)', 'Crema de coco virgen batida al punto de nieve con jugo de lima ácida y hierbabuena fresca.',
  22000, NULL, 'available', false, false, false,
  ARRAY['Sin Alcohol', 'Mocktail']::text[], 'Vaso 400ml', 14
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'soda-artesanal-de-frutos-rojos', 'Soda Artesanal de Frutos Rojos Silvestres & Albahaca', 'Compota casera de moras, frambuesas y arándanos con soda carbonatada y hojas de albahaca fresca.',
  19000, NULL, 'available', false, false, false,
  ARRAY['Sin Alcohol', 'Refrescante']::text[], 'Vaso 380ml', 15
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111303', 'cerveza-artesanal-ipa-colombiana', 'Cerveza Artesanal IPA Doble Lúpulo · Cervecería Local', 'Cerveza rubia con amargor marcado y notas cítricas a maracuyá y mango biche.',
  24000, NULL, 'available', false, false, false,
  ARRAY['Cerveza Artesanal']::text[], 'Botella 330ml', 16
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'volcan-de-chocolate-70-porciento', 'Volcán Tibio de Chocolate de Origen Arauca 70%', 'Bizcocho caliente con corazón fundido de chocolate amargo colombiano, servido con helado de vainilla en rama.',
  34000, NULL, 'available', true, false, true,
  ARRAY['Chocolate Colombiano', 'Hornada al Minuto']::text[], 'Porción individual · Horneado al instante', 1
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'flan-de-caramelo-con-tuetano-dulce', 'Flan Cremoso de Yemas al Rescoldo con Dulce de Leche', 'Textura aterciopelada sin burbujas, bañado con caramelo líquido tostado y crema chantilly ligera.',
  28000, NULL, 'available', false, false, false,
  ARRAY['Clásico Portátil']::text[], '180g', 2
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'milhojas-de-arequipe-y-crema-diplomata', 'Milhojas Crocante con Arequipe Artesanal & Crema Diplomata', 'Capas de hojaldre invertido extraquebradizo relleno al momento para conservar crocancia insuperable.',
  32000, NULL, 'available', true, false, false,
  ARRAY['Favorito Casa Brasa']::text[], 'Porción generosa', 3
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'pina-asada-al-ron-y-helado-de-coco', 'Piña Oro Miel Asada en Almíbar de Ron & Helado de Coco', 'Cilindro de piña dorada al asador con canela en rama, azúcar morena y quenelle de helado artesanal.',
  29000, NULL, 'available', false, false, false,
  ARRAY['Sin Gluten']::text[], '220g', 4
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'tarta-de-queso-vasca-al-horno-de-lena', 'Tarta de Queso Vasca Horneada a Alta Temperatura', 'Costra tostada oscura y centro cremoso semilíquido con toques de queso azul suave y sal marina.',
  35000, NULL, 'available', true, true, true,
  ARRAY['Receta Especial']::text[], 'Porción individual', 5
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'tres-leches-ahumado-con-whisky', 'Bizcocho Tres Leches Emborrachado en Reducción de Bourbon', 'Bizcocho esponjoso bañado en infusión de leche condensada, crema y leche evaporada con merengue quemado.',
  31000, NULL, 'available', false, false, false,
  ARRAY['Postre Húmedo']::text[], '230g', 6
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'tabla-de-quesos-madurados-colombianos', 'Selección de Quesos Madurados de Cundinamarca & Dulces Caseros', 'Queso Paipa añejo, queso azul de Ubaté y queso de cabra con jalea de guayaba agria y nueces pecán.',
  49000, NULL, 'available', false, false, false,
  ARRAY['Para Compartir']::text[], '300g con tostas', 7
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'helados-artesanales-de-la-casa', 'Dúo de Helados Artesanales (Vainilla Bourbon & Frutos del Bosque)', 'Elaborados en casa con leche entera de pastura y frutas seleccionadas de agricultores locales.',
  22000, NULL, 'available', false, false, false,
  ARRAY['2 Sabores']::text[], '2 bolas · 160g', 8
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'cafe-geisha-filtrado-v60', 'Café Geisha Especialidad · Finca La Palma & El Tucán (V60)', 'Taza limpia con notas a jazmín, bergamota, té negro y durazno. Filtrado en mesa con tetera de cuello de ganso.',
  24000, NULL, 'available', true, false, true,
  ARRAY['Café Especialidad 88+']::text[], 'Taza 250ml', 9
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'espresso-doble-de-origen-huila', 'Espresso Doble Origen Huila · Perfil Cacao & Panela', 'Extracción concentrada de tueste medio con crema densa color avellana y acidez málica equilibrada.',
  12000, NULL, 'available', false, false, false,
  ARRAY['Extracción Clásica']::text[], '60ml', 10
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'cappuccino-con-leche-texturizada', 'Cappuccino Clásico con Leche de Pastura Cremada & Canela', 'Espresso simple con microespuma sedosa y diseño de latte art elaborado por nuestro barista.',
  16000, NULL, 'available', false, false, false,
  ARRAY['Cafetería']::text[], 'Taza 180ml', 11
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;


INSERT INTO public.products (
  restaurant_id, category_id, slug, name, short_description,
  base_price, compare_at_price, availability_status, is_featured, is_new, is_chef_choice,
  badges, portion_label, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111306', 'infusion-botanica-digestiva', 'Infusión Botánica de Toronjil, Cidrón & Menta Silvestre', 'Hojas frescas de la huerta secadas a la sombra, servidas en tetera de cristal templado.',
  14000, NULL, 'available', false, false, false,
  ARRAY['Sin Cafeína']::text[], 'Tetera individual', 12
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  availability_status = EXCLUDED.availability_status,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  is_chef_choice = EXCLUDED.is_chef_choice,
  badges = EXCLUDED.badges,
  portion_label = EXCLUDED.portion_label,
  sort_order = EXCLUDED.sort_order;

-- ----------------------------------------------------------------------------
-- 7. Seed Sample Option Groups for Selected Dishes
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_cb_id uuid := '11111111-1111-4111-8111-111111111111';
  v_prod_burger_id uuid;
  v_prod_volcano_id uuid;
  v_grp_id uuid;
BEGIN
  -- Wagyu Burger options
  SELECT id INTO v_prod_burger_id FROM public.products WHERE slug = 'hamburguesa-wagyu-brasa-trufada' AND restaurant_id = v_cb_id;
  IF v_prod_burger_id IS NOT NULL THEN
    DELETE FROM public.product_option_groups WHERE product_id = v_prod_burger_id;

    INSERT INTO public.product_option_groups (
      restaurant_id, product_id, name, helper_text, is_required, min_selections, max_selections, sort_order
    ) VALUES (
      v_cb_id, v_prod_burger_id, 'Término de la carne', 'Recomendamos Término Medio para máxima jugosidad del Wagyu.', true, 1, 1, 1
    ) RETURNING id INTO v_grp_id;

    INSERT INTO public.product_options (restaurant_id, option_group_id, name, price_delta, is_available, sort_order) VALUES
      (v_cb_id, v_grp_id, 'Término Medio — Recomendado (56°C)', 0, true, 1),
      (v_cb_id, v_grp_id, 'Tres Cuartos (63°C)', 0, true, 2),
      (v_cb_id, v_grp_id, 'Bien Asada (70°C)', 0, true, 3);

    INSERT INTO public.product_option_groups (
      restaurant_id, product_id, name, helper_text, is_required, min_selections, max_selections, sort_order
    ) VALUES (
      v_cb_id, v_prod_burger_id, 'Acompañamiento artesanal', 'Elige tu guarnición incluida o mejora a opción premium.', true, 1, 1, 2
    ) RETURNING id INTO v_grp_id;

    INSERT INTO public.product_options (restaurant_id, option_group_id, name, price_delta, is_available, sort_order) VALUES
      (v_cb_id, v_grp_id, 'Papas rústicas con sal de romero', 0, true, 1),
      (v_cb_id, v_grp_id, 'Ensalada fresca de rúgula y parmesano', 0, true, 2),
      (v_cb_id, v_grp_id, 'Papas trufadas con queso parmesano 24 meses', 12000, true, 3);
  END IF;

  -- Volcano dessert options
  SELECT id INTO v_prod_volcano_id FROM public.products WHERE slug = 'volcan-de-chocolate-70-porciento' AND restaurant_id = v_cb_id;
  IF v_prod_volcano_id IS NOT NULL THEN
    DELETE FROM public.product_option_groups WHERE product_id = v_prod_volcano_id;

    INSERT INTO public.product_option_groups (
      restaurant_id, product_id, name, helper_text, is_required, min_selections, max_selections, sort_order
    ) VALUES (
      v_cb_id, v_prod_volcano_id, 'Acompañamiento de helado artesanal', 'Servido frío sobre el volcán tibio.', true, 1, 1, 1
    ) RETURNING id INTO v_grp_id;

    INSERT INTO public.product_options (restaurant_id, option_group_id, name, price_delta, is_available, sort_order) VALUES
      (v_cb_id, v_grp_id, 'Helado artesanal de Vainilla Bourbon en rama', 0, true, 1),
      (v_cb_id, v_grp_id, 'Helado artesanal de Frutos del Bosque', 0, true, 2),
      (v_cb_id, v_grp_id, 'Sin helado', 0, true, 3);
  END IF;
END;
$$;
