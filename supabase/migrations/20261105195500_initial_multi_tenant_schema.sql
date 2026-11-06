-- ============================================================================
-- MIGRATION 0001: Multi-Tenant Core Schema, Menu, Events & Audit Logs
-- Project: fenbapps-restaurants-menu (Supabase PostgreSQL)
-- Standards: 3NF, UUID PKs, NUMERIC money, TIMESTAMPTZ, explicit FK indexes
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- Ensure private schema is never exposed to public roles directly
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 1. Utility Trigger Function: updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Core Multi-Tenant Tables: restaurants, locations, restaurant_members
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 3 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  tagline text CHECK (tagline IS NULL OR length(tagline) <= 220),
  story_excerpt text CHECK (story_excerpt IS NULL OR length(story_excerpt) <= 2000),
  cuisine_type text CHECK (cuisine_type IS NULL OR length(cuisine_type) <= 80),
  currency_code text NOT NULL DEFAULT 'COP' CHECK (length(currency_code) = 3),
  is_demo boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  enabled_modules jsonb NOT NULL DEFAULT '{"menu": true, "events": true, "site": true}'::jsonb,
  theme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  address_line text NOT NULL CHECK (length(address_line) BETWEEN 4 AND 250),
  neighborhood text CHECK (neighborhood IS NULL OR length(neighborhood) <= 100),
  city text NOT NULL DEFAULT 'Bogotá' CHECK (length(city) <= 100),
  google_maps_url text CHECK (google_maps_url IS NULL OR length(google_maps_url) <= 500),
  whatsapp_phone text CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^\+?[0-9]{10,15}$'),
  contact_phone text CHECK (contact_phone IS NULL OR length(contact_phone) <= 30),
  opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights text[] NOT NULL DEFAULT '{}',
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_locations_restaurant_sort
  ON public.locations (restaurant_id, is_active, sort_order);

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_members_user_tenant
  ON public.restaurant_members (user_id, restaurant_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_restaurant_members_restaurant
  ON public.restaurant_members (restaurant_id);

CREATE TRIGGER trg_restaurant_members_updated_at
  BEFORE UPDATE ON public.restaurant_members
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Module 1: Intelligent Digital Menu
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  description text CHECK (description IS NULL OR length(description) <= 350),
  schedule_label text CHECK (schedule_label IS NULL OR length(schedule_label) <= 120),
  service_notes text CHECK (service_notes IS NULL OR length(service_notes) <= 400),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_menus_restaurant_sort
  ON public.menus (restaurant_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_menus_location_id
  ON public.menus (location_id);

CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  subtitle text CHECK (subtitle IS NULL OR length(subtitle) <= 180),
  description text CHECK (description IS NULL OR length(description) <= 350),
  display_mode text NOT NULL DEFAULT 'editorial_grid'
    CHECK (display_mode IN ('editorial_grid', 'compact_list', 'featured_cards')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_menu_sort
  ON public.categories (restaurant_id, menu_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_categories_menu_id
  ON public.categories (menu_id);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 80),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 140),
  short_description text CHECK (short_description IS NULL OR length(short_description) <= 280),
  long_description text CHECK (long_description IS NULL OR length(long_description) <= 1000),
  base_price numeric(12,2) NOT NULL CHECK (base_price >= 0),
  compare_at_price numeric(12,2) CHECK (compare_at_price IS NULL OR compare_at_price >= base_price),
  image_url text CHECK (image_url IS NULL OR length(image_url) <= 600),
  image_alt text CHECK (image_alt IS NULL OR length(image_alt) <= 200),
  availability_status text NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'sold_out', 'hidden', 'archived')),
  is_featured boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  is_chef_choice boolean NOT NULL DEFAULT false,
  badges text[] NOT NULL DEFAULT '{}',
  portion_label text CHECK (portion_label IS NULL OR length(portion_label) <= 90),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_restaurant_category_sort
  ON public.products (restaurant_id, category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products (category_id);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  helper_text text CHECK (helper_text IS NULL OR length(helper_text) <= 150),
  is_required boolean NOT NULL DEFAULT false,
  min_selections integer NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections integer NOT NULL DEFAULT 1 CHECK (max_selections >= 1 AND max_selections >= min_selections),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_option_groups_product
  ON public.product_option_groups (product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_option_groups_restaurant
  ON public.product_option_groups (restaurant_id);

CREATE TRIGGER trg_product_option_groups_updated_at
  BEFORE UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  option_group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  price_delta numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_options_group
  ON public.product_options (option_group_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_options_restaurant
  ON public.product_options (restaurant_id);

CREATE TRIGGER trg_product_options_updated_at
  BEFORE UPDATE ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Module 2: Commercial Events & Celebrations System
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  subtitle text CHECK (subtitle IS NULL OR length(subtitle) <= 180),
  description text NOT NULL CHECK (length(description) <= 1500),
  capacity_seated integer NOT NULL CHECK (capacity_seated > 0),
  capacity_cocktail integer CHECK (capacity_cocktail IS NULL OR capacity_cocktail >= capacity_seated),
  min_guests integer NOT NULL DEFAULT 8 CHECK (min_guests > 0),
  ambiance_tags text[] NOT NULL DEFAULT '{}',
  equipment_features text[] NOT NULL DEFAULT '{}',
  cover_image_url text CHECK (cover_image_url IS NULL OR length(cover_image_url) <= 600),
  gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_event_spaces_restaurant_sort
  ON public.event_spaces (restaurant_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_event_spaces_location_id
  ON public.event_spaces (location_id);

CREATE TRIGGER trg_event_spaces_updated_at
  BEFORE UPDATE ON public.event_spaces
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  event_category text NOT NULL
    CHECK (event_category IN ('corporate', 'birthday', 'anniversary', 'family_celebration', 'private_dining', 'custom')),
  badge_label text CHECK (badge_label IS NULL OR length(badge_label) <= 60),
  tagline text CHECK (tagline IS NULL OR length(tagline) <= 220),
  description text NOT NULL CHECK (length(description) <= 1500),
  pricing_model text NOT NULL CHECK (pricing_model IN ('per_person', 'fixed_package', 'custom_quote')),
  base_price numeric(12,2) CHECK (base_price IS NULL OR base_price >= 0),
  min_guests integer NOT NULL DEFAULT 10 CHECK (min_guests > 0),
  max_guests integer CHECK (max_guests IS NULL OR max_guests >= min_guests),
  duration_hours numeric(4,1) CHECK (duration_hours IS NULL OR duration_hours > 0),
  includes_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions_text text CHECK (conditions_text IS NULL OR length(conditions_text) <= 1000),
  cover_image_url text CHECK (cover_image_url IS NULL OR length(cover_image_url) <= 600),
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_event_packages_restaurant_sort
  ON public.event_packages (restaurant_id, is_active, sort_order);

CREATE TRIGGER trg_event_packages_updated_at
  BEFORE UPDATE ON public.event_packages
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE CHECK (length(reference_code) BETWEEN 6 AND 24),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  event_space_id uuid REFERENCES public.event_spaces(id) ON DELETE SET NULL,
  event_package_id uuid REFERENCES public.event_packages(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 2 AND 80),
  tentative_date date NOT NULL,
  preferred_time_slot text NOT NULL
    CHECK (preferred_time_slot IN ('lunch', 'afternoon', 'dinner', 'full_evening')),
  guest_count integer NOT NULL CHECK (guest_count BETWEEN 2 AND 1000),
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 2 AND 120),
  customer_phone text NOT NULL CHECK (length(customer_phone) BETWEEN 7 AND 25),
  customer_email text CHECK (customer_email IS NULL OR length(customer_email) <= 160),
  company_name text CHECK (company_name IS NULL OR length(company_name) <= 120),
  special_requests text CHECK (special_requests IS NULL OR length(special_requests) <= 1000),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'contacted', 'quoted', 'confirmed', 'rejected', 'archived')),
  internal_admin_notes text CHECK (internal_admin_notes IS NULL OR length(internal_admin_notes) <= 2000),
  privacy_accepted boolean NOT NULL CHECK (privacy_accepted = true),
  privacy_accepted_at timestamptz NOT NULL DEFAULT now(),
  privacy_policy_version text NOT NULL DEFAULT 'v1.0-CO-1581' CHECK (length(privacy_policy_version) <= 40),
  source_ip_hash text CHECK (source_ip_hash IS NULL OR length(source_ip_hash) <= 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_restaurant_status_date
  ON public.event_inquiries (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_location_id
  ON public.event_inquiries (location_id);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_event_space_id
  ON public.event_inquiries (event_space_id);

CREATE INDEX IF NOT EXISTS idx_event_inquiries_event_package_id
  ON public.event_inquiries (event_package_id);

CREATE TRIGGER trg_event_inquiries_updated_at
  BEFORE UPDATE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Forensic Audit Logs & Anti-Abuse Rate Limit Buckets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 2 AND 80),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 2 AND 60),
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_created
  ON public.audit_logs (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id
  ON public.audit_logs (actor_user_id);

CREATE TABLE IF NOT EXISTS private.rate_limit_buckets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_key text NOT NULL,
  action_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_lookup
  ON private.rate_limit_buckets (bucket_key, action_name, created_at DESC);
