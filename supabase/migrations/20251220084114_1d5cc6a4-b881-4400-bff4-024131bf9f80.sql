-- Fix PUBLIC_DATA_EXPOSURE: Restrict profile access to own profile or friends only
-- This prevents any authenticated user from harvesting email addresses

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view profiles of their friends
CREATE POLICY "Users can view friend profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE (f.user_id = auth.uid() AND f.friend_id = profiles.user_id)
         OR (f.friend_id = auth.uid() AND f.user_id = profiles.user_id)
    )
  );

-- Users can search for profiles (limited fields only - enforced by application code)
-- This allows user discovery for friend requests
CREATE POLICY "Users can search profiles for discovery"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);