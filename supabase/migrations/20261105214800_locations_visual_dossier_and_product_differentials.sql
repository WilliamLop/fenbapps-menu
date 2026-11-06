-- ============================================================================
-- MIGRATION 0004: Multi-Location Visual Dossier, Salon Galleries & Product Differentials
-- ============================================================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS description text CHECK (description IS NULL OR length(description) <= 800),
  ADD COLUMN IF NOT EXISTS cover_image_url text CHECK (cover_image_url IS NULL OR length(cover_image_url) <= 600),
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclusive_features text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS exclusive_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pairing_note text CHECK (pairing_note IS NULL OR length(pairing_note) <= 300);

CREATE INDEX IF NOT EXISTS idx_products_exclusive_location_id
  ON public.products (exclusive_location_id);
