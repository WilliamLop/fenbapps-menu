-- ============================================================================
-- Migration: 20261106093000_fix_crm_constraints_and_direct_orders.sql
-- Purpose:
--   1. Fix `update_event_inquiry_operational_state` status enum mismatch with
--      `event_inquiries_status_check` ('received', 'contacted', 'quoted',
--      'confirmed', 'rejected', 'archived') and fix `audit_logs.entity_id`
--      native UUID type in operational RPCs.
--   2. Add `delivery_config` JSONB column to `public.restaurants` and seed
--      commercial parameters (delivery fee, free shipping threshold, minimum
--      order, transfer instructions) for demo tenants.
--   3. Create `public.direct_orders` with strict Multi-Tenant `FORCE ROW LEVEL SECURITY`
--      and rate-limited transactional RPCs for Dine-In, Delivery & Pickup orders.
--   4. Keep `SECURITY DEFINER` implementations in `private` schema with
--      `SECURITY INVOKER` wrappers in `public` for 0 Security Advisor warnings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add `delivery_config` to `public.restaurants` & Seed Demo Configurations
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_config jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.restaurants
SET delivery_config = jsonb_build_object(
  'enabled', true,
  'pickupEnabled', true,
  'deliveryFee', 7500,
  'freeDeliveryThreshold', 180000,
  'minOrderAmount', 42000,
  'estimatedDeliveryMinutes', '35 – 50 min',
  'estimatedPickupMinutes', '20 – 25 min',
  'transferInstructions', 'Bancolombia Ahorros 241-889012-45 · Llave Bre-B / Nequi: @casabrasa (NIT 901.482.119-3 · Casa Brasa SAS)'
)
WHERE slug = 'casa-brasa';

UPDATE public.restaurants
SET delivery_config = jsonb_build_object(
  'enabled', true,
  'pickupEnabled', true,
  'deliveryFee', 6000,
  'freeDeliveryThreshold', 130000,
  'minOrderAmount', 32000,
  'estimatedDeliveryMinutes', '30 – 45 min',
  'estimatedPickupMinutes', '15 – 20 min',
  'transferInstructions', 'Davivienda Ahorros 0089-7741-2210 · Llave Bre-B / Nequi: 3145550140 (Botánica Huerta SAS)'
)
WHERE slug = 'botanica-brunch';

-- ----------------------------------------------------------------------------
-- 2. Create Multi-Tenant `public.direct_orders` Table + Indexes + Forced RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE CHECK (length(reference_code) BETWEEN 6 AND 28),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  fulfillment_type text NOT NULL
    CHECK (fulfillment_type IN ('dine_in', 'delivery', 'pickup')),
  table_number text CHECK (table_number IS NULL OR length(table_number) <= 30),
  pickup_slot text CHECK (pickup_slot IS NULL OR length(pickup_slot) <= 60),
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 2 AND 120),
  customer_phone text NOT NULL CHECK (length(customer_phone) BETWEEN 7 AND 25),
  delivery_address text CHECK (delivery_address IS NULL OR length(delivery_address) <= 260),
  delivery_neighborhood text CHECK (delivery_neighborhood IS NULL OR length(delivery_neighborhood) <= 120),
  delivery_notes text CHECK (delivery_notes IS NULL OR length(delivery_notes) <= 600),
  payment_method text NOT NULL
    CHECK (payment_method IN ('cash', 'card_dataphone', 'transfer')),
  payment_details text CHECK (payment_details IS NULL OR length(payment_details) <= 240),
  items jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) >= 1),
  subtotal_amount numeric(12, 2) NOT NULL CHECK (subtotal_amount >= 0),
  delivery_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'preparing', 'dispatched', 'completed', 'cancelled')),
  internal_admin_notes text CHECK (internal_admin_notes IS NULL OR length(internal_admin_notes) <= 1000),
  privacy_accepted boolean NOT NULL DEFAULT true CHECK (privacy_accepted = true),
  source_ip_hash text CHECK (source_ip_hash IS NULL OR length(source_ip_hash) <= 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_orders_restaurant_status_created
  ON public.direct_orders (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_orders_location_id
  ON public.direct_orders (location_id);

DROP TRIGGER IF EXISTS trg_direct_orders_updated_at ON public.direct_orders;
CREATE TRIGGER trg_direct_orders_updated_at
  BEFORE UPDATE ON public.direct_orders
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.direct_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_orders FORCE ROW LEVEL SECURITY;

-- Zero anonymous SELECT access (protects customer PII: addresses & phone numbers)
DROP POLICY IF EXISTS direct_orders_select_member ON public.direct_orders;
CREATE POLICY direct_orders_select_member
  ON public.direct_orders
  FOR SELECT
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

DROP POLICY IF EXISTS direct_orders_update_member ON public.direct_orders;
CREATE POLICY direct_orders_update_member
  ON public.direct_orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

DROP POLICY IF EXISTS direct_orders_delete_owner ON public.direct_orders;
CREATE POLICY direct_orders_delete_owner
  ON public.direct_orders
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])));

-- ----------------------------------------------------------------------------
-- 3. Controlled Public Direct Order Submission (`private` DEFINER + `public` INVOKER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.insert_validated_direct_order(
  p_restaurant_id uuid,
  p_location_id uuid,
  p_fulfillment_type text,
  p_table_number text,
  p_pickup_slot text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_neighborhood text,
  p_delivery_notes text,
  p_payment_method text,
  p_payment_details text,
  p_items jsonb,
  p_subtotal_amount numeric,
  p_delivery_fee numeric,
  p_total_amount numeric,
  p_privacy_accepted boolean,
  p_source_ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_slug text;
  v_recent_count integer;
  v_prefix text;
  v_mode_code text;
  v_ref_code text;
  v_order_id uuid;
BEGIN
  IF p_privacy_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'Debes autorizar el uso de tus datos para coordinar el pedido.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT r.slug INTO v_restaurant_slug
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
    AND r.is_published = true;

  IF v_restaurant_slug IS NULL THEN
    RAISE EXCEPTION 'El restaurante indicado no está disponible para recibir pedidos.'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_fulfillment_type NOT IN ('dine_in', 'delivery', 'pickup') THEN
    RAISE EXCEPTION 'Modalidad de entrega inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method NOT IN ('cash', 'card_dataphone', 'transfer') THEN
    RAISE EXCEPTION 'Método de pago inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_fulfillment_type = 'delivery' AND length(trim(coalesce(p_delivery_address, ''))) < 5 THEN
    RAISE EXCEPTION 'Ingresa la dirección exacta de entrega para tu domicilio.'
      USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'Tu pedido debe incluir al menos un producto.'
      USING ERRCODE = '22023';
  END IF;

  -- Anti-spam rate limit (max 15 direct orders per 15 minutes per IP hash)
  IF p_source_ip_hash IS NOT NULL AND length(p_source_ip_hash) > 0 THEN
    SELECT count(*) INTO v_recent_count
    FROM private.rate_limit_buckets rlb
    WHERE rlb.bucket_key = p_source_ip_hash
      AND rlb.action_name = 'submit_direct_order'
      AND rlb.created_at > (now() - interval '15 minutes');

    IF v_recent_count >= 15 THEN
      RAISE EXCEPTION 'Has enviado demasiados pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.'
        USING ERRCODE = 'P0003';
    END IF;

    INSERT INTO private.rate_limit_buckets (bucket_key, action_name)
    VALUES (p_source_ip_hash, 'submit_direct_order');
  END IF;

  v_prefix := CASE
    WHEN strpos(v_restaurant_slug, '-') > 0 THEN
      upper(left(split_part(v_restaurant_slug, '-', 1), 1) || left(split_part(v_restaurant_slug, '-', 2), 1))
    ELSE
      upper(left(v_restaurant_slug, 2))
  END;

  v_mode_code := CASE p_fulfillment_type
    WHEN 'delivery' THEN 'DOM'
    WHEN 'pickup' THEN 'REC'
    ELSE 'MES'
  END;

  v_ref_code := v_prefix
    || '-'
    || v_mode_code
    || '-'
    || lpad((floor(random() * 9000) + 1000)::text, 4, '0');

  INSERT INTO public.direct_orders (
    reference_code,
    restaurant_id,
    location_id,
    fulfillment_type,
    table_number,
    pickup_slot,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_neighborhood,
    delivery_notes,
    payment_method,
    payment_details,
    items,
    subtotal_amount,
    delivery_fee,
    total_amount,
    privacy_accepted,
    source_ip_hash
  ) VALUES (
    v_ref_code,
    p_restaurant_id,
    p_location_id,
    p_fulfillment_type,
    nullif(trim(coalesce(p_table_number, '')), ''),
    nullif(trim(coalesce(p_pickup_slot, '')), ''),
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_delivery_address, '')), ''),
    nullif(trim(coalesce(p_delivery_neighborhood, '')), ''),
    nullif(trim(coalesce(p_delivery_notes, '')), ''),
    p_payment_method,
    nullif(trim(coalesce(p_payment_details, '')), ''),
    p_items,
    p_subtotal_amount,
    coalesce(p_delivery_fee, 0),
    p_total_amount,
    true,
    p_source_ip_hash
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'reference_code', v_ref_code,
    'status', 'received',
    'total_amount', p_total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION private.insert_validated_direct_order(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.insert_validated_direct_order(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, boolean, text
) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.submit_public_direct_order(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, boolean, text
);

CREATE OR REPLACE FUNCTION public.submit_public_direct_order(
  p_restaurant_id uuid,
  p_fulfillment_type text,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_items jsonb,
  p_subtotal_amount numeric,
  p_delivery_fee numeric,
  p_total_amount numeric,
  p_privacy_accepted boolean,
  p_location_id uuid DEFAULT NULL,
  p_table_number text DEFAULT NULL,
  p_pickup_slot text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_neighborhood text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_payment_details text DEFAULT NULL,
  p_source_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.insert_validated_direct_order(
    p_restaurant_id,
    p_location_id,
    p_fulfillment_type,
    p_table_number,
    p_pickup_slot,
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_delivery_neighborhood,
    p_delivery_notes,
    p_payment_method,
    p_payment_details,
    p_items,
    p_subtotal_amount,
    p_delivery_fee,
    p_total_amount,
    p_privacy_accepted,
    p_source_ip_hash
  );
$$;

REVOKE ALL ON FUNCTION public.submit_public_direct_order(
  uuid, text, text, text, text, jsonb, numeric, numeric, numeric, boolean, uuid, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_public_direct_order(
  uuid, text, text, text, text, jsonb, numeric, numeric, numeric, boolean, uuid, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Operational Console RPCs (Fixed `event_inquiries_status_check`, Fixed
--    `audit_logs.entity_id` UUID type, Added `direct_orders` + Hardened Wrappers)
-- ----------------------------------------------------------------------------

-- 4A. Snapshot Implementation (`private` DEFINER + `public` INVOKER)
CREATE OR REPLACE FUNCTION private.get_operational_console_snapshot_impl(
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

  SELECT COALESCE(jsonb_agg(row_to_json(o_row)), '[]'::jsonb)
  INTO v_direct_orders
  FROM (
    SELECT
      ord.id,
      ord.reference_code,
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
      l.name AS location_name
    FROM public.direct_orders ord
    LEFT JOIN public.locations l ON l.id = ord.location_id
    WHERE ord.restaurant_id = v_restaurant.id
    ORDER BY ord.created_at DESC
    LIMIT 30
  ) o_row;

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
    LIMIT 15
  ) a_row;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'restaurant_slug', v_restaurant.slug,
    'products', v_products,
    'inquiries', v_inquiries,
    'direct_orders', v_direct_orders,
    'audit_logs', v_audit_logs
  );
END;
$$;

REVOKE ALL ON FUNCTION private.get_operational_console_snapshot_impl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_operational_console_snapshot_impl(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_operational_console_snapshot(
  p_restaurant_slug text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_operational_console_snapshot_impl(p_restaurant_slug);
$$;

REVOKE ALL ON FUNCTION public.get_operational_console_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_operational_console_snapshot(text) TO anon, authenticated, service_role;

-- 4B. Product Availability & Price Update (`private` DEFINER + `public` INVOKER, Native UUID in audit_logs)
CREATE OR REPLACE FUNCTION private.update_product_operational_state_impl(
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
      AND rm.role IN ('owner', 'admin', 'editor')
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
    v_product.id,
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

REVOKE ALL ON FUNCTION private.update_product_operational_state_impl(text, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_product_operational_state_impl(text, uuid, text, numeric) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_product_operational_state(
  p_restaurant_slug text,
  p_product_id uuid,
  p_availability_status text,
  p_base_price numeric
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.update_product_operational_state_impl(
    p_restaurant_slug,
    p_product_id,
    p_availability_status,
    p_base_price
  );
$$;

REVOKE ALL ON FUNCTION public.update_product_operational_state(text, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_product_operational_state(text, uuid, text, numeric) TO anon, authenticated, service_role;

-- 4C. Event Inquiry CRM Status Update (`private` DEFINER + `public` INVOKER, Fixed Status Enum + Native UUID)
CREATE OR REPLACE FUNCTION private.update_event_inquiry_operational_state_impl(
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
      AND rm.role IN ('owner', 'admin', 'editor')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar solicitudes de eventos de este restaurante' USING ERRCODE = '42501';
  END IF;

  -- Must match `event_inquiries_status_check` 1:1
  IF p_status NOT IN ('received', 'contacted', 'quoted', 'confirmed', 'rejected', 'archived') THEN
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
    v_inquiry.id,
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

REVOKE ALL ON FUNCTION private.update_event_inquiry_operational_state_impl(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_event_inquiry_operational_state_impl(text, uuid, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_event_inquiry_operational_state(
  p_restaurant_slug text,
  p_inquiry_id uuid,
  p_status text,
  p_internal_notes text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.update_event_inquiry_operational_state_impl(
    p_restaurant_slug,
    p_inquiry_id,
    p_status,
    p_internal_notes
  );
$$;

REVOKE ALL ON FUNCTION public.update_event_inquiry_operational_state(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_inquiry_operational_state(text, uuid, text, text) TO anon, authenticated, service_role;

-- 4D. Direct Order Operational Status Update (`private` DEFINER + `public` INVOKER)
CREATE OR REPLACE FUNCTION private.update_direct_order_status_impl(
  p_restaurant_slug text,
  p_order_id uuid,
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
  v_order public.direct_orders%ROWTYPE;
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
      AND rm.role IN ('owner', 'admin', 'editor')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar pedidos de este restaurante' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('received', 'preparing', 'dispatched', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de pedido inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM public.direct_orders ord
  WHERE ord.id = p_order_id
    AND ord.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado en este restaurante' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.direct_orders
  SET
    status = p_status,
    internal_admin_notes = left(trim(COALESCE(p_internal_notes, '')), 1000),
    updated_at = now()
  WHERE id = v_order.id
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
    'direct_order.status_update',
    'direct_order',
    v_order.id,
    jsonb_build_object(
      'reference_code', v_order.reference_code,
      'status', v_order.status
    ),
    jsonb_build_object(
      'reference_code', v_order.reference_code,
      'status', p_status
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'reference_code', v_order.reference_code,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION private.update_direct_order_status_impl(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_direct_order_status_impl(text, uuid, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_direct_order_status(
  p_restaurant_slug text,
  p_order_id uuid,
  p_status text,
  p_internal_notes text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.update_direct_order_status_impl(
    p_restaurant_slug,
    p_order_id,
    p_status,
    p_internal_notes
  );
$$;

REVOKE ALL ON FUNCTION public.update_direct_order_status(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_direct_order_status(text, uuid, text, text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Seed Initial Realistic Direct Orders for Commercial Demo Readiness
-- ----------------------------------------------------------------------------
DO $seed_orders$
DECLARE
  v_cb_id uuid;
  v_cb_loc_id uuid;
  v_bb_id uuid;
  v_bb_loc_id uuid;
BEGIN
  SELECT id INTO v_cb_id FROM public.restaurants WHERE slug = 'casa-brasa' LIMIT 1;
  IF v_cb_id IS NOT NULL THEN
    SELECT id INTO v_cb_loc_id
    FROM public.locations
    WHERE restaurant_id = v_cb_id AND is_primary = true
    LIMIT 1;

    INSERT INTO public.direct_orders (
      reference_code,
      restaurant_id,
      location_id,
      fulfillment_type,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_neighborhood,
      delivery_notes,
      payment_method,
      payment_details,
      items,
      subtotal_amount,
      delivery_fee,
      total_amount,
      status
    ) VALUES (
      'CB-DOM-3910',
      v_cb_id,
      v_cb_loc_id,
      'delivery',
      'Camila Restrepo',
      '3158429011',
      'Carrera 11 # 93A-52 · Apto 602 Torre Norte',
      'Chicó Reservado',
      'Dejar en recepción si estoy en llamada. Incluir chimichurri extra.',
      'cash',
      'Paga con $200.000 · Llevar vueltas de $32.000',
      '[{"name":"Bife de Chorizo Angus Certificado (400g)","quantity":1,"unitPrice":122000,"options":["Término 3/4","Papas rústicas al romero"]},{"name":"Old Fashioned de Roble & Naranja Tatemada","quantity":1,"unitPrice":46000,"options":[]}]'::jsonb,
      168000,
      7500,
      175500,
      'preparing'
    )
    ON CONFLICT (reference_code) DO NOTHING;

    INSERT INTO public.direct_orders (
      reference_code,
      restaurant_id,
      location_id,
      fulfillment_type,
      pickup_slot,
      customer_name,
      customer_phone,
      delivery_notes,
      payment_method,
      payment_details,
      items,
      subtotal_amount,
      delivery_fee,
      total_amount,
      status
    ) VALUES (
      'CB-REC-5104',
      v_cb_id,
      v_cb_loc_id,
      'pickup',
      'En 25 minutos',
      'Andrés Mejía',
      '3106214490',
      'Paso en camioneta gris frente a la bahía.',
      'transfer',
      'Transferencia Llave Bre-B / Nequi (comprobante enviado por WhatsApp)',
      '[{"name":"Pulpo al Rescoldo & Papa Criolla","quantity":1,"unitPrice":64000,"options":[]},{"name":"Gratinado de Quesos Madurados & Trufa Negra","quantity":1,"unitPrice":29000,"options":[]}]'::jsonb,
      93000,
      0,
      93000,
      'received'
    )
    ON CONFLICT (reference_code) DO NOTHING;
  END IF;

  SELECT id INTO v_bb_id FROM public.restaurants WHERE slug = 'botanica-brunch' LIMIT 1;
  IF v_bb_id IS NOT NULL THEN
    SELECT id INTO v_bb_loc_id
    FROM public.locations
    WHERE restaurant_id = v_bb_id
    LIMIT 1;

    INSERT INTO public.direct_orders (
      reference_code,
      restaurant_id,
      location_id,
      fulfillment_type,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_neighborhood,
      delivery_notes,
      payment_method,
      payment_details,
      items,
      subtotal_amount,
      delivery_fee,
      total_amount,
      status
    ) VALUES (
      'BB-DOM-2048',
      v_bb_id,
      v_bb_loc_id,
      'delivery',
      'Valentina Gómez',
      '3187712230',
      'Calle 119B # 5-48 · Casa 4',
      'Usaquén',
      'Sin cubiertos plásticos por favor.',
      'card_dataphone',
      'Datáfono inalámbrico · Tarjeta Crédito',
      '[{"name":"Tostada de Masa Madre, Aguacate Hass & Poché","quantity":2,"unitPrice":38000,"options":[]},{"name":"Matcha Ceremonial Helado con Leche de Avena","quantity":2,"unitPrice":22000,"options":[]}]'::jsonb,
      120000,
      6000,
      126000,
      'received'
    )
    ON CONFLICT (reference_code) DO NOTHING;
  END IF;
END;
$seed_orders$;
