-- Remove email column from profiles table to prevent email harvesting
-- Email already exists in auth.users and is accessible via session
-- Users can only see their own email via the authenticated user object

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;