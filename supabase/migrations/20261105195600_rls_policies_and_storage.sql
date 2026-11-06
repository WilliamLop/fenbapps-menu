-- ============================================================================
-- MIGRATION 0002: Hardened Row-Level Security (RLS), Private Functions & Storage
-- Project: fenbapps-restaurants-menu
-- Security Rules:
--   1. Every table in public & private has RLS enabled & forced.
--   2. Security Definer helpers live in `private` schema with `SET search_path = ''`.
--   3. All policies wrap functions in `(SELECT ...)` for PostgreSQL initPlan caching.
--   4. All UPDATE policies define both `USING` and `WITH CHECK` to block tenant hopping.
--   5. `event_inquiries` has ZERO public SELECT access; submissions go through a
--      rate-limited, validated RPC function `public.create_public_event_inquiry`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Security Helper Functions in `private` schema
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.has_restaurant_role(
  target_restaurant_id uuid,
  allowed_roles text[] DEFAULT ARRAY['owner', 'admin', 'editor']
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = target_restaurant_id
      AND rm.user_id = (SELECT auth.uid())
      AND rm.role = ANY(allowed_roles)
      AND rm.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION private.has_restaurant_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_restaurant_role(uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_restaurant_published(
  target_restaurant_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = target_restaurant_id
      AND r.is_published = true
  );
$$;

REVOKE ALL ON FUNCTION private.is_restaurant_published(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_restaurant_published(uuid) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Enable and Force RLS on all tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus FORCE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options FORCE ROW LEVEL SECURITY;

ALTER TABLE public.event_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_spaces FORCE ROW LEVEL SECURITY;

ALTER TABLE public.event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_packages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.event_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inquiries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE private.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.rate_limit_buckets FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. RLS Policies: `public.restaurants`
-- ----------------------------------------------------------------------------
CREATE POLICY restaurants_select_anon
  ON public.restaurants
  FOR SELECT
  TO anon
  USING (is_published = true);

CREATE POLICY restaurants_select_authenticated
  ON public.restaurants
  FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR (SELECT private.has_restaurant_role(id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY restaurants_update_admin
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(id, ARRAY['owner', 'admin'])))
  WITH CHECK ((SELECT private.has_restaurant_role(id, ARRAY['owner', 'admin'])));

-- ----------------------------------------------------------------------------
-- 4. RLS Policies: `public.locations`
-- ----------------------------------------------------------------------------
CREATE POLICY locations_select_anon
  ON public.locations
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY locations_select_authenticated
  ON public.locations
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY locations_insert_member
  ON public.locations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

CREATE POLICY locations_update_member
  ON public.locations
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

CREATE POLICY locations_delete_admin
  ON public.locations
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- ----------------------------------------------------------------------------
-- 5. RLS Policies: `public.restaurant_members`
-- ----------------------------------------------------------------------------
CREATE POLICY restaurant_members_select_member
  ON public.restaurant_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin']))
  );

CREATE POLICY restaurant_members_insert_owner
  ON public.restaurant_members
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])));

CREATE POLICY restaurant_members_update_owner
  ON public.restaurant_members
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])));

CREATE POLICY restaurant_members_delete_owner
  ON public.restaurant_members
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])));

-- ----------------------------------------------------------------------------
-- 6. RLS Policies: `public.menus`, `public.categories`, `public.products`
-- ----------------------------------------------------------------------------
CREATE POLICY menus_select_anon
  ON public.menus
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY menus_select_authenticated
  ON public.menus
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY menus_insert_member
  ON public.menus
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY menus_update_member
  ON public.menus
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY menus_delete_admin
  ON public.menus
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Categories
CREATE POLICY categories_select_anon
  ON public.categories
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY categories_select_authenticated
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY categories_insert_member
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY categories_update_member
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY categories_delete_admin
  ON public.categories
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Products
CREATE POLICY products_select_anon
  ON public.products
  FOR SELECT
  TO anon
  USING (
    availability_status IN ('available', 'sold_out')
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY products_select_authenticated
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    (availability_status IN ('available', 'sold_out') AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY products_insert_member
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY products_update_member
  ON public.products
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY products_delete_admin
  ON public.products
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Product Option Groups
CREATE POLICY product_option_groups_select_anon
  ON public.product_option_groups
  FOR SELECT
  TO anon
  USING ((SELECT private.is_restaurant_published(restaurant_id)));

CREATE POLICY product_option_groups_select_authenticated
  ON public.product_option_groups
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.is_restaurant_published(restaurant_id))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY product_option_groups_insert_member
  ON public.product_option_groups
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY product_option_groups_update_member
  ON public.product_option_groups
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY product_option_groups_delete_admin
  ON public.product_option_groups
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Product Options
CREATE POLICY product_options_select_anon
  ON public.product_options
  FOR SELECT
  TO anon
  USING ((SELECT private.is_restaurant_published(restaurant_id)));

CREATE POLICY product_options_select_authenticated
  ON public.product_options
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.is_restaurant_published(restaurant_id))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY product_options_insert_member
  ON public.product_options
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY product_options_update_member
  ON public.product_options
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY product_options_delete_admin
  ON public.product_options
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: `event_spaces`, `event_packages`, `event_inquiries`
-- ----------------------------------------------------------------------------
CREATE POLICY event_spaces_select_anon
  ON public.event_spaces
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY event_spaces_select_authenticated
  ON public.event_spaces
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY event_spaces_insert_member
  ON public.event_spaces
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_spaces_update_member
  ON public.event_spaces
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_spaces_delete_admin
  ON public.event_spaces
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Event Packages
CREATE POLICY event_packages_select_anon
  ON public.event_packages
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT private.is_restaurant_published(restaurant_id))
  );

CREATE POLICY event_packages_select_authenticated
  ON public.event_packages
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND (SELECT private.is_restaurant_published(restaurant_id)))
    OR (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY event_packages_insert_member
  ON public.event_packages
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_packages_update_member
  ON public.event_packages
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_packages_delete_admin
  ON public.event_packages
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

-- Event Inquiries (Private customer PII — zero SELECT for anon!)
CREATE POLICY event_inquiries_select_member
  ON public.event_inquiries
  FOR SELECT
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_inquiries_update_member
  ON public.event_inquiries
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])))
  WITH CHECK ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor'])));

CREATE POLICY event_inquiries_delete_owner
  ON public.event_inquiries
  FOR DELETE
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner'])));

-- ----------------------------------------------------------------------------
-- 8. RLS Policies: `public.audit_logs` (Immutable Forensic Table)
-- ----------------------------------------------------------------------------
CREATE POLICY audit_logs_select_admin
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin'])));

CREATE POLICY audit_logs_insert_member
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = (SELECT auth.uid())
    AND (SELECT private.has_restaurant_role(restaurant_id, ARRAY['owner', 'admin', 'editor']))
  );
-- Note: ZERO UPDATE or DELETE policies on audit_logs -> immutable history!

-- ----------------------------------------------------------------------------
-- 9. Controlled Anti-Spam Event Inquiry Submission RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_public_event_inquiry(
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
BEGIN
  -- 1. Enforce Habeas Data / Privacy acceptance
  IF p_privacy_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'Debes aceptar la política de tratamiento de datos personales.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Verify target restaurant exists and is published
  SELECT r.slug INTO v_restaurant_slug
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
    AND r.is_published = true;

  IF v_restaurant_slug IS NULL THEN
    RAISE EXCEPTION 'El restaurante indicado no está disponible para recibir solicitudes.'
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Enforce Rate Limit (max 4 inquiries per 15 minutes per IP hash)
  IF p_source_ip_hash IS NOT NULL AND length(p_source_ip_hash) > 0 THEN
    SELECT count(*) INTO v_recent_count
    FROM private.rate_limit_buckets rlb
    WHERE rlb.bucket_key = p_source_ip_hash
      AND rlb.action_name = 'submit_event_inquiry'
      AND rlb.created_at > (now() - interval '15 minutes');

    IF v_recent_count >= 4 THEN
      RAISE EXCEPTION 'Has enviado demasiadas solicitudes recientemente. Por favor intenta de nuevo en unos minutos.'
        USING ERRCODE = 'P0003';
    END IF;

    INSERT INTO private.rate_limit_buckets (bucket_key, action_name)
    VALUES (p_source_ip_hash, 'submit_event_inquiry');
  END IF;

  -- 4. Validate tentative date is not in the past
  IF p_tentative_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha tentativa del evento no puede estar en el pasado.'
      USING ERRCODE = 'P0004';
  END IF;

  -- 5. Generate readable reference code (e.g. CB-2611-8492)
  v_ref_code := upper(left(replace(v_restaurant_slug, '-', ''), 2))
    || '-'
    || to_char(CURRENT_DATE, 'YYMM')
    || '-'
    || lpad((floor(random() * 9000) + 1000)::text, 4, '0');

  -- 6. Insert inquiry
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
    p_location_id,
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

REVOKE ALL ON FUNCTION public.submit_public_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_public_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. Supabase Storage Bucket & Policies (`restaurant-assets`)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-assets',
  'restaurant-assets',
  true,
  5242880, -- 5 MB max per image
  ARRAY['image/webp', 'image/avif', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for restaurant assets
CREATE POLICY storage_restaurant_assets_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'restaurant-assets');

-- Authenticated members can upload/update/delete ONLY inside `{restaurant_id}/...`
CREATE POLICY storage_restaurant_assets_member_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (SELECT private.has_restaurant_role(((storage.foldername(name))[1])::uuid, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY storage_restaurant_assets_member_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (SELECT private.has_restaurant_role(((storage.foldername(name))[1])::uuid, ARRAY['owner', 'admin', 'editor']))
  )
  WITH CHECK (
    bucket_id = 'restaurant-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (SELECT private.has_restaurant_role(((storage.foldername(name))[1])::uuid, ARRAY['owner', 'admin', 'editor']))
  );

CREATE POLICY storage_restaurant_assets_member_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (SELECT private.has_restaurant_role(((storage.foldername(name))[1])::uuid, ARRAY['owner', 'admin']))
  );
