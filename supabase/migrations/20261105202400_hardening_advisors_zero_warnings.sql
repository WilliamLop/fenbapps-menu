-- ============================================================================
-- MIGRATION 0003: Security Advisor Hardening (Zero Warnings in `public`)
-- 1. Revoke public execution of Supabase's default `public.rls_auto_enable()`.
-- 2. Add explicit deny-all policy on `private.rate_limit_buckets`.
-- 3. Move privileged inquiry insertion into `private.insert_validated_event_inquiry`
--    (`SECURITY DEFINER` in non-exposed `private` schema) and expose a
--    `SECURITY INVOKER` wrapper in `public.submit_public_event_inquiry`.
-- ============================================================================

-- 1. Lock down default `public.rls_auto_enable()` if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

-- 2. Explicit deny-all policy on `private.rate_limit_buckets` for direct queries
DROP POLICY IF EXISTS rate_limit_buckets_no_direct_access ON private.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_no_direct_access
  ON private.rate_limit_buckets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 3. Move SECURITY DEFINER inquiry logic to `private` schema
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

  IF p_tentative_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha tentativa del evento no puede estar en el pasado.'
      USING ERRCODE = 'P0004';
  END IF;

  v_ref_code := upper(left(replace(v_restaurant_slug, '-', ''), 2))
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

REVOKE ALL ON FUNCTION private.insert_validated_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.insert_validated_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) TO anon, authenticated, service_role;

-- Replace public function with SECURITY INVOKER wrapper
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.insert_validated_event_inquiry(
    p_restaurant_id,
    p_location_id,
    p_event_space_id,
    p_event_package_id,
    p_event_type,
    p_tentative_date,
    p_preferred_time_slot,
    p_guest_count,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_company_name,
    p_special_requests,
    p_privacy_accepted,
    p_source_ip_hash
  );
$$;

REVOKE ALL ON FUNCTION public.submit_public_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_public_event_inquiry(
  uuid, uuid, uuid, uuid, text, date, text, integer, text, text, text, text, text, boolean, text
) TO anon, authenticated, service_role;
