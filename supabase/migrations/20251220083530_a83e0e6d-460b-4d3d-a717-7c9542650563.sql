-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles access to authenticated users only
-- This prevents unauthenticated scraping of user emails

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() IS NOT NULL);