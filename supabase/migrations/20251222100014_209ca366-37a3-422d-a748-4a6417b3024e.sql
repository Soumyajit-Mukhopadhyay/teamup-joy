-- Add a stable, URL-safe identifier for hackathons so the app can use one consistent ID across UI, teams, and admin tools
ALTER TABLE public.hackathons
ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing rows
UPDATE public.hackathons
SET slug = id::text
WHERE slug IS NULL;

-- Require slug
ALTER TABLE public.hackathons
ALTER COLUMN slug SET NOT NULL;

-- Ensure slug is unique
CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_key
ON public.hackathons (slug);

-- Auto-set slug on insert when not provided
CREATE OR REPLACE FUNCTION public.set_hackathon_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_hackathon_slug_trigger ON public.hackathons;
CREATE TRIGGER set_hackathon_slug_trigger
BEFORE INSERT ON public.hackathons
FOR EACH ROW
EXECUTE FUNCTION public.set_hackathon_slug();
