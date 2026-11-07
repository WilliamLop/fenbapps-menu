-- ============================================================================
-- Migration: 20261106180000_saas_entitlements_and_multi_city_isolation.sql
-- Purpose (Phase 1 / Iteration 7):
--   1. SaaS Commercial Architecture:
--      - `private.platform_admins` (isolated Super-Admin registry)
--      - `public.restaurant_entitlements` (1:1 immutable tenant plan_tier,
--        design_tier, subscription_status ['active', 'past_due_grace',
--        'vitrine_only', 'suspended'], per-location billing fees & overrides).
--      - Gatekeeper helpers `private.can_tenant_mutate` & `private.has_active_feature`
--        preventing "free-rider" catalog edits in `vitrine_only` and blocking
--        unpaid module submissions in PostgreSQL RPCs.
--   2. Multi-Location & Multi-City Operational Isolation:
--      - Composite unique constraints `(id, restaurant_id)` on `locations` & `products`.
--      - `public.product_locations` for per-location `availability_status`,
--        `is_offered`, and regional `price_override`.
--      - `locations.delivery_config` & `locations.timezone` for city-specific
--        shipping fees, minimum orders, WhatsApp & transfer accounts.
--      - `restaurant_members.location_scope` + `public.restaurant_member_locations`
--        + `audit_logs.location_id`.
--      - Seed 3rd location for `casa-brasa` in a second city (`Medellín · Provenza`)
--        with dedicated salon, regional dish overrides, isolated order & inquiry.
--   3. Zero-Trust Transactional & Multi-Location Console RPCs:
--      - Recompute real location prices & stock inside `insert_validated_direct_order`.
--      - Filter `get_operational_console_snapshot` by `p_location_id` (zero tray mixing).
--      - Support per-location or global updates in `update_product_operational_state`.
--      - Expose `super_admin_list_tenants` & `super_admin_update_entitlements`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Super-Admin Registry (`private.platform_admins`) & Helper
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'super_admin'
    CHECK (role IN ('super_admin', 'billing_ops')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admins_deny_direct ON private.platform_admins;
CREATE POLICY platform_admins_deny_direct
  ON private.platform_admins
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM private.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.is_active = true
    )
  END;
$$;

REVOKE ALL ON FUNCTION private.is_platform_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_platform_super_admin() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. SaaS Commercial Entitlements (`public.restaurant_entitlements`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_entitlements (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan_tier text NOT NULL DEFAULT 'basic'
    CHECK (plan_tier IN ('basic', 'standard', 'full')),
  design_tier text NOT NULL DEFAULT 'basic'
    CHECK (design_tier IN ('basic', 'standard', 'premium')),
  subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due_grace', 'vitrine_only', 'suspended')),
  max_locations integer NOT NULL DEFAULT 1
    CHECK (max_locations >= 1 AND max_locations <= 200),
  setup_one_time_fee numeric(12, 2) NOT NULL DEFAULT 1200000
    CHECK (setup_one_time_fee >= 0),
  monthly_base_fee numeric(12, 2) NOT NULL DEFAULT 149000
    CHECK (monthly_base_fee >= 0),
  extra_location_fee numeric(12, 2) NOT NULL DEFAULT 99000
    CHECK (extra_location_fee >= 0),
  feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(feature_overrides) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_restaurant_entitlements_updated_at ON public.restaurant_entitlements;
CREATE TRIGGER trg_restaurant_entitlements_updated_at
  BEFORE UPDATE ON public.restaurant_entitlements
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.restaurant_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_entitlements FORCE ROW LEVEL SECURITY;

-- Public & tenant members may READ entitlements to adapt UI, but have ZERO write policies
DROP POLICY IF EXISTS restaurant_entitlements_select_public ON public.restaurant_entitlements;
CREATE POLICY restaurant_entitlements_select_public
  ON public.restaurant_entitlements
  FOR SELECT
  TO anon, authenticated
  USING (
    (SELECT private.is_restaurant_published(restaurant_id))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
    OR (SELECT private.is_platform_super_admin())
  );

-- Seed entitlements for all existing restaurants
INSERT INTO public.restaurant_entitlements (
  restaurant_id,
  plan_tier,
  design_tier,
  subscription_status,
  max_locations,
  setup_one_time_fee,
  monthly_base_fee,
  extra_location_fee,
  feature_overrides
)
SELECT
  r.id,
  CASE
    WHEN r.slug = 'casa-brasa' THEN 'full'
    WHEN r.slug = 'botanica-brunch' THEN 'full'
    ELSE 'basic'
  END,
  CASE
    WHEN r.slug = 'casa-brasa' THEN 'premium'
    WHEN r.slug = 'botanica-brunch' THEN 'standard'
    ELSE 'basic'
  END,
  'active',
  CASE
    WHEN r.slug = 'casa-brasa' THEN 5
    ELSE 1
  END,
  CASE
    WHEN r.slug = 'casa-brasa' THEN 3200000
    WHEN r.slug = 'botanica-brunch' THEN 1950000
    ELSE 1200000
  END,
  CASE
    WHEN r.slug = 'casa-brasa' THEN 389000
    WHEN r.slug = 'botanica-brunch' THEN 389000
    ELSE 149000
  END,
  CASE
    WHEN r.slug = 'casa-brasa' THEN 169000
    WHEN r.slug = 'botanica-brunch' THEN 149000
    ELSE 99000
  END,
  '{}'::jsonb
FROM public.restaurants r
ON CONFLICT (restaurant_id) DO NOTHING;

-- Gatekeeper Helper 1: Can tenant mutate catalog / prices / orders / CRM?
-- Returns FALSE when `subscription_status` is 'vitrine_only' or 'suspended'!
CREATE OR REPLACE FUNCTION private.can_tenant_mutate(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT re.subscription_status IN ('active', 'past_due_grace')
      FROM public.restaurant_entitlements re
      WHERE re.restaurant_id = p_restaurant_id
    ),
    true
  );
$$;

REVOKE ALL ON FUNCTION private.can_tenant_mutate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_tenant_mutate(uuid) TO anon, authenticated, service_role;

-- Gatekeeper Helper 2: Deterministic SaaS Feature Evaluation
CREATE OR REPLACE FUNCTION private.has_active_feature(
  p_restaurant_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ent public.restaurant_entitlements%ROWTYPE;
BEGIN
  SELECT * INTO v_ent
  FROM public.restaurant_entitlements re
  WHERE re.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Suspended blocks everything; Vitrine Only freezes all interactive & CRM engines
  IF v_ent.subscription_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF v_ent.subscription_status = 'vitrine_only' THEN
    RETURN p_feature IN ('site', 'menu_vitrine');
  END IF;

  -- Explicit boolean override by Super-Admin takes precedence when active/grace
  IF v_ent.feature_overrides ? p_feature
     AND jsonb_typeof(v_ent.feature_overrides -> p_feature) = 'boolean' THEN
    RETURN (v_ent.feature_overrides ->> p_feature)::boolean;
  END IF;

  CASE p_feature
    WHEN 'site' THEN
      RETURN true;
    WHEN 'menu_vitrine' THEN
      RETURN true;
    WHEN 'table_shortlist' THEN
      RETURN v_ent.plan_tier IN ('basic', 'standard', 'full');
    WHEN 'catalog_mutations' THEN
      RETURN v_ent.plan_tier IN ('basic', 'standard', 'full');
    WHEN 'direct_orders' THEN
      RETURN v_ent.plan_tier IN ('standard', 'full');
    WHEN 'promotions' THEN
      RETURN v_ent.plan_tier IN ('standard', 'full');
    WHEN 'events_crm' THEN
      RETURN v_ent.plan_tier = 'full';
    WHEN 'multi_location' THEN
      RETURN v_ent.plan_tier = 'full';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION private.has_active_feature(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_active_feature(uuid, text) TO anon, authenticated, service_role;

-- Prevent non-super-admins from escalating `is_demo`, `is_published`, `slug`, or `enabled_modules` on `public.restaurants`
CREATE OR REPLACE FUNCTION private.guard_restaurant_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR private.is_platform_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.is_demo IS DISTINCT FROM OLD.is_demo
     OR NEW.is_published IS DISTINCT FROM OLD.is_published
     OR NEW.enabled_modules IS DISTINCT FROM OLD.enabled_modules THEN
    RAISE EXCEPTION 'Solo Super-Admin puede alterar parámetros comerciales de plataforma.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_tenant_mutate(OLD.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina: reactiva tu membresía para editar configuración.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_restaurant_protected_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_restaurant_protected_columns ON public.restaurants;
CREATE TRIGGER trg_guard_restaurant_protected_columns
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION private.guard_restaurant_protected_columns();

-- ----------------------------------------------------------------------------
-- 3. Multi-Location & Multi-City Schema (`product_locations`, `locations`, RBAC)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_id_restaurant_id_unique'
  ) THEN
    ALTER TABLE public.locations
      ADD CONSTRAINT locations_id_restaurant_id_unique UNIQUE (id, restaurant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_id_restaurant_id_unique'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_id_restaurant_id_unique UNIQUE (id, restaurant_id);
  END IF;
END;
$$;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS delivery_config jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Bogota';

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_location_created
  ON public.audit_logs (restaurant_id, location_id, created_at DESC);

ALTER TABLE public.restaurant_members
  ADD COLUMN IF NOT EXISTS location_scope text NOT NULL DEFAULT 'all'
    CHECK (location_scope IN ('all', 'assigned'));

CREATE TABLE IF NOT EXISTS public.restaurant_member_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.restaurant_members(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, location_id),
  FOREIGN KEY (location_id, restaurant_id)
    REFERENCES public.locations(id, restaurant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_restaurant_member_locations_member
  ON public.restaurant_member_locations (member_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_member_locations_location
  ON public.restaurant_member_locations (location_id);

ALTER TABLE public.restaurant_member_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_member_locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_locations_select_member ON public.restaurant_member_locations;
CREATE POLICY member_locations_select_member
  ON public.restaurant_member_locations
  FOR SELECT
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

DROP POLICY IF EXISTS member_locations_manage_admin ON public.restaurant_member_locations;
CREATE POLICY member_locations_manage_admin
  ON public.restaurant_member_locations
  FOR ALL
  TO authenticated
  USING (
    (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin']))
    AND (SELECT private.can_tenant_mutate(restaurant_id))
  )
  WITH CHECK (
    (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin']))
    AND (SELECT private.can_tenant_mutate(restaurant_id))
  );

-- Per-Location Catalog Matrix (`public.product_locations`)
CREATE TABLE IF NOT EXISTS public.product_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  location_id uuid NOT NULL,
  is_offered boolean NOT NULL DEFAULT true,
  availability_status text NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'sold_out', 'hidden')),
  price_override numeric(12, 2)
    CHECK (price_override IS NULL OR (price_override >= 0 AND price_override <= 50000000)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, location_id),
  FOREIGN KEY (product_id, restaurant_id)
    REFERENCES public.products(id, restaurant_id) ON DELETE CASCADE,
  FOREIGN KEY (location_id, restaurant_id)
    REFERENCES public.locations(id, restaurant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_locations_restaurant_loc
  ON public.product_locations (restaurant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_product_locations_product
  ON public.product_locations (product_id);

DROP TRIGGER IF EXISTS trg_product_locations_updated_at ON public.product_locations;
CREATE TRIGGER trg_product_locations_updated_at
  BEFORE UPDATE ON public.product_locations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_locations_select_public ON public.product_locations;
CREATE POLICY product_locations_select_public
  ON public.product_locations
  FOR SELECT
  TO anon, authenticated
  USING (
    (SELECT private.is_restaurant_published(restaurant_id))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

DROP POLICY IF EXISTS product_locations_manage_member ON public.product_locations;
CREATE POLICY product_locations_manage_member
  ON public.product_locations
  FOR ALL
  TO authenticated
  USING (
    (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
    AND (SELECT private.can_tenant_mutate(restaurant_id))
  )
  WITH CHECK (
    (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
    AND (SELECT private.can_tenant_mutate(restaurant_id))
  );

-- Helper: Check location-scoped role for authenticated members
CREATE OR REPLACE FUNCTION private.has_location_role(
  p_restaurant_id uuid,
  p_location_id uuid,
  p_allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = p_restaurant_id
      AND rm.user_id = auth.uid()
      AND rm.is_active = true
      AND rm.role = ANY(p_allowed_roles)
      AND (
        rm.role IN ('owner', 'admin')
        OR rm.location_scope = 'all'
        OR (
          p_location_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.restaurant_member_locations rml
            WHERE rml.member_id = rm.id
              AND rml.location_id = p_location_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.has_location_role(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_location_role(uuid, uuid, text[]) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Seed Multi-City Scenario on `/casa-brasa` (Bogotá [2 sedes] + Medellín [1 sede])
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cb_id uuid := '11111111-1111-4111-8111-111111111111';
  v_loc_p93 uuid;
  v_loc_zg uuid;
  v_loc_mde uuid := '11111111-2222-4111-8111-333333333333';
  v_space_mde uuid := '11111111-5555-4111-8111-444444444444';
  v_pkg_corp uuid;
  v_prod_pulpo uuid;
  v_prod_ribeye uuid;
  v_prod_tartar uuid;
BEGIN
  SELECT id INTO v_loc_p93 FROM public.locations WHERE restaurant_id = v_cb_id AND slug = 'parque-93' LIMIT 1;
  SELECT id INTO v_loc_zg FROM public.locations WHERE restaurant_id = v_cb_id AND slug = 'zona-g' LIMIT 1;

  -- Enrich Bogotá locations with independent logistics/accounts
  IF v_loc_p93 IS NOT NULL THEN
    UPDATE public.locations
    SET delivery_config = jsonb_build_object(
      'enabled', true,
      'pickupEnabled', true,
      'deliveryFee', 7500,
      'freeDeliveryThreshold', 180000,
      'minOrderAmount', 42000,
      'estimatedDeliveryMinutes', '35 – 45 min (Norte & Chicó)',
      'estimatedPickupMinutes', '20 min en Parque 93',
      'transferInstructions', 'Bancolombia Ahorros 241-889012-45 · Llave Bre-B: @casabrasa93 (Sede Bogotá Parque 93)'
    )
    WHERE id = v_loc_p93;
  END IF;

  IF v_loc_zg IS NOT NULL THEN
    UPDATE public.locations
    SET delivery_config = jsonb_build_object(
      'enabled', true,
      'pickupEnabled', true,
      'deliveryFee', 7000,
      'freeDeliveryThreshold', 170000,
      'minOrderAmount', 42000,
      'estimatedDeliveryMinutes', '30 – 45 min (Chapinero & Rosales)',
      'estimatedPickupMinutes', '20 min en Casona Zona G',
      'transferInstructions', 'Bancolombia Ahorros 241-889012-99 · Llave Bre-B: @casabrasazonag (Sede Bogotá Zona G)'
    )
    WHERE id = v_loc_zg;
  END IF;

  -- Insert 3rd Location in a SECOND CITY: Medellín · Provenza (El Poblado)
  INSERT INTO public.locations (
    id,
    restaurant_id,
    slug,
    name,
    address_line,
    neighborhood,
    city,
    whatsapp_phone,
    contact_phone,
    description,
    cover_image_url,
    gallery_urls,
    exclusive_features,
    opening_hours,
    highlights,
    delivery_config,
    is_primary,
    is_active,
    sort_order
  ) VALUES (
    v_loc_mde,
    v_cb_id,
    'medellin-provenza',
    'Sede Provenza · El Poblado',
    'Carrera 35 # 8A-45 · El Poblado',
    'Provenza · El Poblado',
    'Medellín',
    '+573045550188',
    '(604) 444 9820',
    'Terraza abierta entre vegetación tropical en Provenza con parrilla de roble a la vista, cava climatizada y salón rooftop para eventos.',
    '/demo/casa-brasa/salon-terraza-fuego.jpg',
    '["/demo/casa-brasa/salon-terraza-fuego.jpg", "/demo/casa-brasa/salon-cava-cristal.jpg", "/demo/casa-brasa/hero-steak.jpg"]'::jsonb,
    ARRAY['Rooftop Tropical en Provenza', 'Cava de Autor Antioquia'],
    '[{"days": "Martes a Sábado", "hours": "12:00 m. – 11:30 p. m."}, {"days": "Domingos y Festivos", "hours": "12:00 m. – 6:00 p. m."}]'::jsonb,
    ARRAY['Valet Parking en Carrera 35', 'Terraza Pet Friendly', 'Rooftop Privado 40 pax'],
    jsonb_build_object(
      'enabled', true,
      'pickupEnabled', true,
      'deliveryFee', 6500,
      'freeDeliveryThreshold', 160000,
      'minOrderAmount', 38000,
      'estimatedDeliveryMinutes', '25 – 40 min (El Poblado & Laureles)',
      'estimatedPickupMinutes', '18 min en Provenza',
      'transferInstructions', 'Bancolombia Ahorros 612-990144-08 · Llave Bre-B: @casabrasamde (Casa Brasa Medellín SAS)'
    ),
    false,
    true,
    3
  )
  ON CONFLICT (restaurant_id, slug) DO UPDATE SET
    city = EXCLUDED.city,
    delivery_config = EXCLUDED.delivery_config,
    is_active = true;

  SELECT id INTO v_loc_mde FROM public.locations WHERE restaurant_id = v_cb_id AND slug = 'medellin-provenza';

  -- Insert Dedicated Event Salon in Medellín so Events filter by City -> Sede seamlessly
  INSERT INTO public.event_spaces (
    id,
    restaurant_id,
    location_id,
    slug,
    name,
    subtitle,
    description,
    min_guests,
    capacity_seated,
    capacity_cocktail,
    cover_image_url,
    gallery_urls,
    equipment_features,
    ambiance_tags,
    is_active,
    sort_order
  ) VALUES (
    v_space_mde,
    v_cb_id,
    v_loc_mde,
    'rooftop-provenza-medellin',
    'Rooftop del Bosque · Provenza',
    'Terraza privada cubierta en El Poblado con barra dedicada y sonido independiente',
    'Nuestro espacio insignia en Medellín para cenas corporativas, lanzamientos de marca y celebraciones privadas rodeadas de vegetación nativa.',
    10,
    38,
    55,
    '/demo/casa-brasa/salon-terraza-fuego.jpg',
    '["/demo/casa-brasa/salon-terraza-fuego.jpg", "/demo/casa-brasa/salon-gallery-2.jpg", "/demo/casa-brasa/pkg-celebration.jpg"]'::jsonb,
    ARRAY['Barra de coctelería exclusiva', 'Pantalla 70" 4K', 'Audio Bose independiente', 'Climatización exterior'],
    ARRAY['Rooftop Privado', 'Provenza · El Poblado', 'Vegetación Tropical'],
    true,
    4
  )
  ON CONFLICT (restaurant_id, slug) DO NOTHING;

  -- Backfill NULL location_id on existing demo orders/inquiries to Parque 93 so zero orphan trays exist
  IF v_loc_p93 IS NOT NULL THEN
    UPDATE public.direct_orders
    SET location_id = v_loc_p93
    WHERE restaurant_id = v_cb_id AND location_id IS NULL;

    UPDATE public.event_inquiries
    SET location_id = v_loc_p93
    WHERE restaurant_id = v_cb_id AND location_id IS NULL;
  END IF;

  -- Seed regional product_locations overrides in Medellín (e.g. regional price + 1 dish sold_out only in Medellín!)
  SELECT id INTO v_prod_pulpo FROM public.products WHERE restaurant_id = v_cb_id AND slug LIKE 'pulpo%' LIMIT 1;
  SELECT id INTO v_prod_ribeye FROM public.products WHERE restaurant_id = v_cb_id AND slug LIKE 'ribeye%' LIMIT 1;
  SELECT id INTO v_prod_tartar FROM public.products WHERE restaurant_id = v_cb_id AND slug LIKE '%tuetano%' LIMIT 1;

  IF v_loc_mde IS NOT NULL AND v_prod_pulpo IS NOT NULL THEN
    INSERT INTO public.product_locations (restaurant_id, product_id, location_id, is_offered, availability_status, price_override)
    VALUES (v_cb_id, v_prod_pulpo, v_loc_mde, true, 'available', 62000)
    ON CONFLICT (product_id, location_id) DO NOTHING;
  END IF;

  IF v_loc_mde IS NOT NULL AND v_prod_tartar IS NOT NULL THEN
    INSERT INTO public.product_locations (restaurant_id, product_id, location_id, is_offered, availability_status, price_override)
    VALUES (v_cb_id, v_prod_tartar, v_loc_mde, true, 'sold_out', NULL)
    ON CONFLICT (product_id, location_id) DO NOTHING;
  END IF;

  -- Seed 1 isolated Direct Order & 1 isolated Event Inquiry in Medellín so CRM Location Switcher demonstrates zero mixing immediately!
  IF v_loc_mde IS NOT NULL THEN
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
      status,
      privacy_accepted
    ) VALUES (
      'CB-DOM-MDE1',
      v_cb_id,
      v_loc_mde,
      'delivery',
      'Mateo Restrepo',
      '+57 300 412 8890',
      'Transversal Superior # 10-45 Apto 1102',
      'El Poblado · Los Balsos',
      'Portería principal, anunciar a Casa Brasa Provenza.',
      'transfer',
      'Transferencia Llave Bre-B @casabrasamde confirmada',
      '[{"name": "Pulpo al Rescoldo & Papa Criolla", "quantity": 2, "unitPrice": 62000, "options": []}]'::jsonb,
      124000,
      6500,
      130500,
      'preparing',
      true
    )
    ON CONFLICT (reference_code) DO NOTHING;

    SELECT id INTO v_pkg_corp FROM public.event_packages WHERE restaurant_id = v_cb_id ORDER BY sort_order ASC LIMIT 1;

    INSERT INTO public.event_inquiries (
      reference_code,
      restaurant_id,
      location_id,
      event_space_id,
      event_package_id,
      event_type,
      tentative_date,
      preferred_time_slot,
      guest_count,
      customer_name,
      customer_phone,
      customer_email,
      company_name,
      special_requests,
      status,
      privacy_accepted,
      privacy_accepted_at
    ) VALUES (
      'CB-2611-MDE9',
      v_cb_id,
      v_loc_mde,
      v_space_mde,
      v_pkg_corp,
      'Cena Junta Directiva Regional Antioquia',
      CURRENT_DATE + 18,
      'dinner',
      24,
      'Catalina Arango',
      '+57 301 678 4410',
      'c.arango@grupoantioquia.co',
      'Grupo Industrial Antioquia SAS',
      'Montaje imperial en el Rooftop de Provenza con pantalla para cierre anual.',
      'received',
      true,
      now()
    )
    ON CONFLICT (reference_code) DO NOTHING;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Hardened Public Order & Event Submission RPCs (Plan Gates + Zero-Trust Pricing)
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
  v_restaurant public.restaurants%ROWTYPE;
  v_resolved_location_id uuid;
  v_loc_delivery_cfg jsonb;
  v_effective_delivery_cfg jsonb;
  v_active_loc_count integer;
  v_recent_count integer;
  v_prefix text;
  v_mode_code text;
  v_ref_code text;
  v_order_id uuid;
  v_item jsonb;
  v_prod_id uuid;
  v_qty integer;
  v_prod public.products%ROWTYPE;
  v_pl public.product_locations%ROWTYPE;
  v_has_pl boolean;
  v_base_unit numeric(12, 2);
  v_opt_delta numeric(12, 2);
  v_verified_unit numeric(12, 2);
  v_verified_items jsonb := '[]'::jsonb;
  v_computed_subtotal numeric(12, 2) := 0;
  v_computed_delivery_fee numeric(12, 2) := 0;
  v_computed_total numeric(12, 2) := 0;
BEGIN
  IF p_privacy_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'Debes autorizar el uso de tus datos para coordinar el pedido.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
    AND r.is_published = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El restaurante indicado no está disponible para recibir pedidos.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Plan & Subscription Enforcement in SQL (Blocks Basic / Vitrine Only / Suspended)
  IF NOT private.has_active_feature(v_restaurant.id, 'direct_orders') THEN
    RAISE EXCEPTION 'El motor de pedidos directos no está activo en el plan actual de este restaurante.'
      USING ERRCODE = 'P0005';
  END IF;

  IF p_fulfillment_type NOT IN ('dine_in', 'delivery', 'pickup') THEN
    RAISE EXCEPTION 'Modalidad de entrega inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method NOT IN ('cash', 'card_dataphone', 'transfer') THEN
    RAISE EXCEPTION 'Método de pago inválido.' USING ERRCODE = '22023';
  END IF;

  -- Resolve & validate target location (Mandatory when Multi-Sede)
  SELECT count(*) INTO v_active_loc_count
  FROM public.locations l
  WHERE l.restaurant_id = v_restaurant.id AND l.is_active = true;

  IF p_location_id IS NOT NULL THEN
    SELECT l.id, l.delivery_config
    INTO v_resolved_location_id, v_loc_delivery_cfg
    FROM public.locations l
    WHERE l.id = p_location_id
      AND l.restaurant_id = v_restaurant.id
      AND l.is_active = true;

    IF v_resolved_location_id IS NULL THEN
      RAISE EXCEPTION 'La sede seleccionada no pertenece a este restaurante o no está activa.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_active_loc_count = 1 THEN
    SELECT l.id, l.delivery_config
    INTO v_resolved_location_id, v_loc_delivery_cfg
    FROM public.locations l
    WHERE l.restaurant_id = v_restaurant.id AND l.is_active = true
    LIMIT 1;
  ELSIF v_active_loc_count > 1 THEN
    RAISE EXCEPTION 'Por favor selecciona la ciudad y sede desde la cual deseas realizar tu pedido.'
      USING ERRCODE = '22023';
  END IF;

  v_effective_delivery_cfg := COALESCE(v_loc_delivery_cfg, v_restaurant.delivery_config, '{}'::jsonb);

  IF p_fulfillment_type = 'delivery' THEN
    IF COALESCE((v_effective_delivery_cfg ->> 'enabled')::boolean, true) IS FALSE THEN
      RAISE EXCEPTION 'El servicio a domicilio no está habilitado en esta sede.'
        USING ERRCODE = 'P0005';
    END IF;
    IF length(trim(coalesce(p_delivery_address, ''))) < 5 THEN
      RAISE EXCEPTION 'Ingresa la dirección exacta de entrega para tu domicilio.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF p_fulfillment_type = 'pickup' THEN
    IF COALESCE((v_effective_delivery_cfg ->> 'pickupEnabled')::boolean, true) IS FALSE THEN
      RAISE EXCEPTION 'La modalidad para recoger en sede no está habilitada en esta ubicación.'
        USING ERRCODE = 'P0005';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'Tu pedido debe incluir al menos un producto.'
      USING ERRCODE = '22023';
  END IF;

  -- Zero-Trust Catalog Verification & Price Recomputation per Item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_prod_id := (v_item ->> 'productId')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Identificador de producto inválido en el pedido.' USING ERRCODE = '22023';
    END;

    v_qty := GREATEST(1, LEAST(99, COALESCE((v_item ->> 'quantity')::integer, 1)));

    SELECT * INTO v_prod
    FROM public.products p
    WHERE p.id = v_prod_id
      AND p.restaurant_id = v_restaurant.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los platos seleccionados ya no existe en la carta.'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_prod.availability_status <> 'available' THEN
      RAISE EXCEPTION 'El plato "%" se encuentra agotado o no disponible hoy.', v_prod.name
        USING ERRCODE = 'P0006';
    END IF;

    IF v_prod.exclusive_location_id IS NOT NULL
       AND v_resolved_location_id IS NOT NULL
       AND v_prod.exclusive_location_id <> v_resolved_location_id THEN
      RAISE EXCEPTION 'El plato "%" es exclusivo de otra sede.', v_prod.name
        USING ERRCODE = 'P0006';
    END IF;

    v_has_pl := false;
    IF v_resolved_location_id IS NOT NULL THEN
      SELECT * INTO v_pl
      FROM public.product_locations pl
      WHERE pl.product_id = v_prod.id
        AND pl.location_id = v_resolved_location_id;
      IF FOUND THEN
        v_has_pl := true;
      END IF;
    END IF;

    IF v_has_pl AND (v_pl.is_offered IS FALSE OR v_pl.availability_status <> 'available') THEN
      RAISE EXCEPTION 'El plato "%" se encuentra agotado hoy en la sede seleccionada.', v_prod.name
        USING ERRCODE = 'P0006';
    END IF;

    v_base_unit := CASE
      WHEN v_has_pl AND v_pl.price_override IS NOT NULL THEN v_pl.price_override
      ELSE v_prod.base_price
    END;

    v_opt_delta := 0;
    IF v_item ? 'optionIds' AND jsonb_typeof(v_item -> 'optionIds') = 'array' THEN
      SELECT COALESCE(SUM(po.price_delta), 0)
      INTO v_opt_delta
      FROM public.product_options po
      JOIN public.product_option_groups pog ON pog.id = po.option_group_id
      WHERE pog.product_id = v_prod.id
        AND po.restaurant_id = v_restaurant.id
        AND po.is_available = true
        AND po.id IN (
          SELECT ( elem #>> '{}' )::uuid
          FROM jsonb_array_elements(v_item -> 'optionIds') AS elem
        );
      v_verified_unit := v_base_unit + v_opt_delta;
    ELSE
      -- Backwards-compatible fallback: never allow paying below real location base price
      v_verified_unit := GREATEST(
        v_base_unit,
        COALESCE((v_item ->> 'unitPrice')::numeric, v_base_unit)
      );
    END IF;

    v_computed_subtotal := v_computed_subtotal + (v_verified_unit * v_qty);

    v_verified_items := v_verified_items || jsonb_build_array(
      jsonb_build_object(
        'productId', v_prod.id,
        'name', v_prod.name,
        'quantity', v_qty,
        'unitPrice', v_verified_unit,
        'options', COALESCE(v_item -> 'options', '[]'::jsonb)
      )
    );
  END LOOP;

  IF p_fulfillment_type = 'delivery' THEN
    IF v_computed_subtotal < COALESCE((v_effective_delivery_cfg ->> 'minOrderAmount')::numeric, 0) THEN
      RAISE EXCEPTION 'El pedido mínimo a domicilio en esta sede es de $%.',
        trim(to_char(COALESCE((v_effective_delivery_cfg ->> 'minOrderAmount')::numeric, 0), '999G999G999'))
        USING ERRCODE = '22023';
    END IF;

    IF v_computed_subtotal >= COALESCE((v_effective_delivery_cfg ->> 'freeDeliveryThreshold')::numeric, 999999999) THEN
      v_computed_delivery_fee := 0;
    ELSE
      v_computed_delivery_fee := COALESCE((v_effective_delivery_cfg ->> 'deliveryFee')::numeric, 0);
    END IF;
  ELSE
    v_computed_delivery_fee := 0;
  END IF;

  v_computed_total := v_computed_subtotal + v_computed_delivery_fee;

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
    WHEN strpos(v_restaurant.slug, '-') > 0 THEN
      upper(left(split_part(v_restaurant.slug, '-', 1), 1) || left(split_part(v_restaurant.slug, '-', 2), 1))
    ELSE
      upper(left(v_restaurant.slug, 2))
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
    v_restaurant.id,
    v_resolved_location_id,
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
    v_verified_items,
    v_computed_subtotal,
    v_computed_delivery_fee,
    v_computed_total,
    true,
    p_source_ip_hash
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'reference_code', v_ref_code,
    'status', 'received',
    'subtotal_amount', v_computed_subtotal,
    'delivery_fee', v_computed_delivery_fee,
    'total_amount', v_computed_total
  );
END;
$$;

-- Hardened Event Inquiry Submission (Enforces `events_crm` Plan Feature + Location Ownership)
CREATE OR REPLACE FUNCTION private.insert_validated_event_inquiry(
  p_restaurant_id uuid,
  p_location_id uuid,
  p_event_space_id uuid,
  p_event_package_id uuid,
  p_event_type text,
  p_tentative_date date,
  p_preferred_time_slot text,
  p_guest_count integer,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_company_name text,
  p_special_requests text,
  p_privacy_accepted boolean,
  p_source_ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recent_count integer;
  v_ref_code text;
  v_inquiry_id uuid;
  v_restaurant_slug text;
  v_resolved_loc_id uuid := p_location_id;
  v_prefix text;
BEGIN
  IF p_privacy_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'Debes aceptar la política de tratamiento de datos personales.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT r.slug INTO v_restaurant_slug
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
    AND r.is_published = true;

  IF v_restaurant_slug IS NULL THEN
    RAISE EXCEPTION 'El restaurante indicado no está disponible para recibir solicitudes.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT private.has_active_feature(p_restaurant_id, 'events_crm') THEN
    RAISE EXCEPTION 'El cotizador de eventos privados no está activo en el plan actual de este restaurante.'
      USING ERRCODE = 'P0005';
  END IF;

  -- Validate cross-tenant integrity of location, space, and package
  IF p_event_space_id IS NOT NULL THEN
    SELECT es.location_id INTO v_resolved_loc_id
    FROM public.event_spaces es
    WHERE es.id = p_event_space_id
      AND es.restaurant_id = p_restaurant_id
      AND es.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El salón seleccionado no pertenece a este restaurante.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = p_location_id
        AND l.restaurant_id = p_restaurant_id
        AND l.is_active = true
    ) THEN
      RAISE EXCEPTION 'La sede seleccionada no pertenece a este restaurante.'
        USING ERRCODE = '22023';
    END IF;
    v_resolved_loc_id := p_location_id;
  ELSIF v_resolved_loc_id IS NULL THEN
    SELECT l.id INTO v_resolved_loc_id
    FROM public.locations l
    WHERE l.restaurant_id = p_restaurant_id AND l.is_active = true
    ORDER BY l.is_primary DESC, l.sort_order ASC
    LIMIT 1;
  END IF;

  IF p_event_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_packages ep
    WHERE ep.id = p_event_package_id
      AND ep.restaurant_id = p_restaurant_id
      AND ep.is_active = true
  ) THEN
    RAISE EXCEPTION 'El paquete comercial seleccionado no es válido.'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_ip_hash IS NOT NULL AND length(p_source_ip_hash) > 0 THEN
    SELECT count(*) INTO v_recent_count
    FROM private.rate_limit_buckets rlb
    WHERE rlb.bucket_key = p_source_ip_hash
      AND rlb.action_name = 'submit_event_inquiry'
      AND rlb.created_at > (now() - interval '15 minutes');

    IF v_recent_count >= 12 THEN
      RAISE EXCEPTION 'Has enviado demasiadas solicitudes recientemente. Por favor intenta de nuevo en unos minutos.'
        USING ERRCODE = 'P0003';
    END IF;

    INSERT INTO private.rate_limit_buckets (bucket_key, action_name)
    VALUES (p_source_ip_hash, 'submit_event_inquiry');
  END IF;

  IF p_tentative_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha tentativa del evento no puede estar en el pasado.'
      USING ERRCODE = 'P0004';
  END IF;

  v_prefix := CASE
    WHEN strpos(v_restaurant_slug, '-') > 0 THEN
      upper(left(split_part(v_restaurant_slug, '-', 1), 1) || left(split_part(v_restaurant_slug, '-', 2), 1))
    ELSE
      upper(left(v_restaurant_slug, 2))
  END;

  v_ref_code := v_prefix
    || '-'
    || to_char(CURRENT_DATE, 'YYMM')
    || '-'
    || lpad((floor(random() * 9000) + 1000)::text, 4, '0');

  INSERT INTO public.event_inquiries (
    reference_code,
    restaurant_id,
    location_id,
    event_space_id,
    event_package_id,
    event_type,
    tentative_date,
    preferred_time_slot,
    guest_count,
    customer_name,
    customer_phone,
    customer_email,
    company_name,
    special_requests,
    privacy_accepted,
    privacy_accepted_at,
    source_ip_hash
  ) VALUES (
    v_ref_code,
    p_restaurant_id,
    v_resolved_loc_id,
    p_event_space_id,
    p_event_package_id,
    trim(p_event_type),
    p_tentative_date,
    p_preferred_time_slot,
    p_guest_count,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_email, '')), ''),
    nullif(trim(coalesce(p_company_name, '')), ''),
    nullif(trim(coalesce(p_special_requests, '')), ''),
    true,
    now(),
    p_source_ip_hash
  )
  RETURNING id INTO v_inquiry_id;

  RETURN jsonb_build_object(
    'id', v_inquiry_id,
    'reference_code', v_ref_code,
    'status', 'received'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Multi-Location Operational Console RPCs (Location-Scoped Trays & Stock)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_operational_console_snapshot(text);
DROP FUNCTION IF EXISTS private.get_operational_console_snapshot_impl(text);

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

  SELECT COALESCE(jsonb_agg(row_to_json(p_row)), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      p.id,
      p.slug,
      p.name,
      p.short_description,
      p.base_price AS global_base_price,
      COALESCE(
        CASE WHEN p_location_id IS NOT NULL THEN pl.price_override ELSE NULL END,
        p.base_price
      ) AS base_price,
      CASE WHEN p_location_id IS NOT NULL THEN pl.price_override ELSE NULL END AS price_override,
      p.availability_status AS global_availability_status,
      CASE
        WHEN p_location_id IS NOT NULL AND pl.id IS NOT NULL AND pl.is_offered = false THEN 'hidden'
        WHEN p_location_id IS NOT NULL AND pl.id IS NOT NULL THEN pl.availability_status
        ELSE p.availability_status
      END AS availability_status,
      p.is_featured,
      p.is_chef_choice,
      p.portion_label,
      p.image_url,
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

-- 6B. Product Availability & Price Update (Supports Global OR Location-Specific Update + Vitrine Freeze)
DROP FUNCTION IF EXISTS public.update_product_operational_state(text, uuid, text, numeric);
DROP FUNCTION IF EXISTS private.update_product_operational_state_impl(text, uuid, text, numeric);

CREATE OR REPLACE FUNCTION private.update_product_operational_state_impl(
  p_restaurant_slug text,
  p_product_id uuid,
  p_availability_status text,
  p_base_price numeric,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_loc_name text := NULL;
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
    RAISE EXCEPTION 'No tienes permisos para modificar el catálogo de este restaurante' USING ERRCODE = '42501';
  END IF;

  -- Block Free-Riders when subscription is in `vitrine_only` or `suspended`!
  IF NOT private.can_tenant_mutate(v_restaurant.id) THEN
    RAISE EXCEPTION 'Suscripción en Modo Vitrina Congelado: reactiva la membresía mensual para editar precios o agotados.'
      USING ERRCODE = 'P0005';
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

  IF p_location_id IS NOT NULL THEN
    SELECT l.name INTO v_loc_name
    FROM public.locations l
    WHERE l.id = p_location_id
      AND l.restaurant_id = v_restaurant.id;

    IF v_loc_name IS NULL THEN
      RAISE EXCEPTION 'La sede indicada no pertenece a este restaurante' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.product_locations (
      restaurant_id,
      product_id,
      location_id,
      is_offered,
      availability_status,
      price_override
    ) VALUES (
      v_restaurant.id,
      v_product.id,
      p_location_id,
      true,
      p_availability_status,
      CASE WHEN p_base_price = v_product.base_price THEN NULL ELSE p_base_price END
    )
    ON CONFLICT (product_id, location_id) DO UPDATE SET
      is_offered = true,
      availability_status = EXCLUDED.availability_status,
      price_override = CASE
        WHEN p_base_price = v_product.base_price THEN NULL
        ELSE p_base_price
      END,
      updated_at = now();

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
      p_location_id,
      auth.uid(),
      'product.location_override_update',
      'product_location',
      v_product.id,
      jsonb_build_object(
        'name', v_product.name,
        'location_name', v_loc_name
      ),
      jsonb_build_object(
        'name', v_product.name,
        'location_name', v_loc_name,
        'availability_status', p_availability_status,
        'effective_price', p_base_price
      )
    );
  ELSE
    UPDATE public.products
    SET
      availability_status = p_availability_status,
      base_price = p_base_price,
      compare_at_price = CASE
        WHEN compare_at_price IS NOT NULL AND compare_at_price <= p_base_price THEN NULL
        ELSE compare_at_price
      END,
      updated_at = now()
    WHERE id = v_product.id
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
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', v_product.id,
    'location_id', p_location_id,
    'availability_status', p_availability_status,
    'base_price', p_base_price
  );
END;
$$;

REVOKE ALL ON FUNCTION private.update_product_operational_state_impl(text, uuid, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_product_operational_state_impl(text, uuid, text, numeric, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_product_operational_state(
  p_restaurant_slug text,
  p_product_id uuid,
  p_availability_status text,
  p_base_price numeric,
  p_location_id uuid DEFAULT NULL
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
    p_base_price,
    p_location_id
  );
$$;

REVOKE ALL ON FUNCTION public.update_product_operational_state(text, uuid, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_product_operational_state(text, uuid, text, numeric, uuid) TO anon, authenticated, service_role;

-- 6C. Harden Order & Event Inquiry Status Updates with `can_tenant_mutate` & `location_id` Audit
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

  SELECT * INTO v_inquiry
  FROM public.event_inquiries ei
  WHERE ei.id = p_inquiry_id
    AND ei.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de evento no encontrada en este restaurante' USING ERRCODE = 'P0002';
  END IF;

  IF (v_restaurant.is_demo = true AND v_restaurant.slug <> 'bistro-rival-test') THEN
    v_has_access := true;
  ELSIF auth.uid() IS NOT NULL AND private.has_location_role(
    v_restaurant.id,
    v_inquiry.location_id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar solicitudes de eventos de esta sede' USING ERRCODE = '42501';
  END IF;

  IF NOT private.has_active_feature(v_restaurant.id, 'events_crm') THEN
    RAISE EXCEPTION 'El Mini-CRM de eventos requiere el Plan Full activo.' USING ERRCODE = 'P0005';
  END IF;

  IF p_status NOT IN ('received', 'contacted', 'quoted', 'confirmed', 'rejected', 'archived') THEN
    RAISE EXCEPTION 'Estado de solicitud inválido' USING ERRCODE = '22023';
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
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    v_inquiry.location_id,
    auth.uid(),
    'event_inquiry.status_update',
    'event_inquiry',
    v_inquiry.id,
    jsonb_build_object(
      'reference_code', v_inquiry.reference_code,
      'status', v_inquiry.status
    ),
    jsonb_build_object(
      'reference_code', v_inquiry.reference_code,
      'status', p_status
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

  SELECT * INTO v_order
  FROM public.direct_orders ord
  WHERE ord.id = p_order_id
    AND ord.restaurant_id = v_restaurant.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado en este restaurante' USING ERRCODE = 'P0002';
  END IF;

  IF (v_restaurant.is_demo = true AND v_restaurant.slug <> 'bistro-rival-test') THEN
    v_has_access := true;
  ELSIF auth.uid() IS NOT NULL AND private.has_location_role(
    v_restaurant.id,
    v_order.location_id,
    ARRAY['owner', 'admin', 'editor']
  ) THEN
    v_has_access := true;
  ELSIF private.is_platform_super_admin() THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar pedidos de esta sede' USING ERRCODE = '42501';
  END IF;

  IF NOT private.has_active_feature(v_restaurant.id, 'direct_orders') THEN
    RAISE EXCEPTION 'La gestión de pedidos directos requiere Plan Standard o Full activo.' USING ERRCODE = 'P0005';
  END IF;

  IF p_status NOT IN ('received', 'preparing', 'dispatched', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Estado de pedido inválido' USING ERRCODE = '22023';
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
    location_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state
  ) VALUES (
    v_restaurant.id,
    v_order.location_id,
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

-- ----------------------------------------------------------------------------
-- 7. Fenbapps Super-Admin Control Plane RPCs (`private` DEFINER + `public` INVOKER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.super_admin_list_tenants_impl()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenants jsonb;
BEGIN
  -- Returns commercial portfolio (excludes internal RLS test fixture `bistro-rival-test` unless Super-Admin)
  SELECT COALESCE(jsonb_agg(row_to_json(t_row)), '[]'::jsonb)
  INTO v_tenants
  FROM (
    SELECT
      r.id,
      r.slug,
      r.name,
      r.cuisine_type,
      r.currency_code,
      r.is_demo,
      r.is_published,
      COALESCE(re.plan_tier, 'basic') AS plan_tier,
      COALESCE(re.design_tier, 'basic') AS design_tier,
      COALESCE(re.subscription_status, 'active') AS subscription_status,
      COALESCE(re.max_locations, 1) AS max_locations,
      COALESCE(re.setup_one_time_fee, 1200000) AS setup_one_time_fee,
      COALESCE(re.monthly_base_fee, 149000) AS monthly_base_fee,
      COALESCE(re.extra_location_fee, 99000) AS extra_location_fee,
      COALESCE(re.feature_overrides, '{}'::jsonb) AS feature_overrides,
      re.updated_at AS entitlements_updated_at,
      (
        SELECT count(*)::integer
        FROM public.locations l
        WHERE l.restaurant_id = r.id AND l.is_active = true
      ) AS active_locations_count,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', l.id,
          'slug', l.slug,
          'name', l.name,
          'city', l.city
        ) ORDER BY l.sort_order ASC), '[]'::jsonb)
        FROM public.locations l
        WHERE l.restaurant_id = r.id AND l.is_active = true
      ) AS locations,
      (
        SELECT count(*)::integer
        FROM public.products p
        WHERE p.restaurant_id = r.id AND p.slug <> 'corte-secreto-pruebas-internas'
      ) AS products_count,
      (
        SELECT count(*)::integer
        FROM public.direct_orders d
        WHERE d.restaurant_id = r.id
      ) AS direct_orders_count,
      (
        SELECT count(*)::integer
        FROM public.event_inquiries ei
        WHERE ei.restaurant_id = r.id
      ) AS event_inquiries_count
    FROM public.restaurants r
    LEFT JOIN public.restaurant_entitlements re ON re.restaurant_id = r.id
    WHERE (
      private.is_platform_super_admin()
      OR (r.is_demo = true AND r.slug <> 'bistro-rival-test')
    )
    ORDER BY r.created_at ASC
  ) t_row;

  RETURN jsonb_build_object(
    'is_authenticated_super_admin', private.is_platform_super_admin(),
    'tenants', v_tenants
  );
END;
$$;

REVOKE ALL ON FUNCTION private.super_admin_list_tenants_impl() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.super_admin_list_tenants_impl() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.super_admin_list_tenants()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.super_admin_list_tenants_impl();
$$;

REVOKE ALL ON FUNCTION public.super_admin_list_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_list_tenants() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.super_admin_update_entitlements_impl(
  p_restaurant_id uuid,
  p_plan_tier text,
  p_design_tier text,
  p_subscription_status text,
  p_max_locations integer,
  p_setup_one_time_fee numeric,
  p_monthly_base_fee numeric,
  p_extra_location_fee numeric,
  p_feature_overrides jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurante no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Non-demo tenants strictly require `private.is_platform_super_admin()`
  IF NOT private.is_platform_super_admin() THEN
    IF v_restaurant.is_demo IS NOT TRUE OR v_restaurant.slug = 'bistro-rival-test' THEN
      RAISE EXCEPTION 'Acceso exclusivo para Super-Admin de Fenbapps.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_plan_tier NOT IN ('basic', 'standard', 'full') THEN
    RAISE EXCEPTION 'Plan mensual inválido' USING ERRCODE = '22023';
  END IF;

  IF p_design_tier NOT IN ('basic', 'standard', 'premium') THEN
    RAISE EXCEPTION 'Nivel de diseño único inválido' USING ERRCODE = '22023';
  END IF;

  IF p_subscription_status NOT IN ('active', 'past_due_grace', 'vitrine_only', 'suspended') THEN
    RAISE EXCEPTION 'Estado de suscripción inválido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.restaurant_entitlements (
    restaurant_id,
    plan_tier,
    design_tier,
    subscription_status,
    max_locations,
    setup_one_time_fee,
    monthly_base_fee,
    extra_location_fee,
    feature_overrides
  ) VALUES (
    v_restaurant.id,
    p_plan_tier,
    p_design_tier,
    p_subscription_status,
    GREATEST(1, LEAST(200, COALESCE(p_max_locations, 1))),
    GREATEST(0, COALESCE(p_setup_one_time_fee, 0)),
    GREATEST(0, COALESCE(p_monthly_base_fee, 0)),
    GREATEST(0, COALESCE(p_extra_location_fee, 0)),
    COALESCE(p_feature_overrides, '{}'::jsonb)
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    design_tier = EXCLUDED.design_tier,
    subscription_status = EXCLUDED.subscription_status,
    max_locations = EXCLUDED.max_locations,
    setup_one_time_fee = EXCLUDED.setup_one_time_fee,
    monthly_base_fee = EXCLUDED.monthly_base_fee,
    extra_location_fee = EXCLUDED.extra_location_fee,
    feature_overrides = EXCLUDED.feature_overrides,
    updated_at = now();

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
    'entitlements.super_admin_update',
    'restaurant_entitlements',
    v_restaurant.id,
    NULL,
    jsonb_build_object(
      'plan_tier', p_plan_tier,
      'design_tier', p_design_tier,
      'subscription_status', p_subscription_status,
      'max_locations', p_max_locations,
      'feature_overrides', COALESCE(p_feature_overrides, '{}'::jsonb)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'restaurant_id', v_restaurant.id,
    'restaurant_slug', v_restaurant.slug,
    'plan_tier', p_plan_tier,
    'design_tier', p_design_tier,
    'subscription_status', p_subscription_status
  );
END;
$$;

REVOKE ALL ON FUNCTION private.super_admin_update_entitlements_impl(uuid, text, text, text, integer, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.super_admin_update_entitlements_impl(uuid, text, text, text, integer, numeric, numeric, numeric, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.super_admin_update_entitlements(
  p_restaurant_id uuid,
  p_plan_tier text,
  p_design_tier text,
  p_subscription_status text,
  p_max_locations integer,
  p_setup_one_time_fee numeric,
  p_monthly_base_fee numeric,
  p_extra_location_fee numeric,
  p_feature_overrides jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.super_admin_update_entitlements_impl(
    p_restaurant_id,
    p_plan_tier,
    p_design_tier,
    p_subscription_status,
    p_max_locations,
    p_setup_one_time_fee,
    p_monthly_base_fee,
    p_extra_location_fee,
    p_feature_overrides
  );
$$;

REVOKE ALL ON FUNCTION public.super_admin_update_entitlements(uuid, text, text, text, integer, numeric, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_entitlements(uuid, text, text, text, integer, numeric, numeric, numeric, jsonb) TO anon, authenticated, service_role;
