-- Migration: fix team_members RLS recursion by using SECURITY DEFINER function
-- Prevents infinite recursion when evaluating DELETE policy on public.team_members

-- 1) Create or replace helper function that checks if a user is team leader.
--    SECURITY DEFINER allows the function to execute with the owner's privileges
--    so the internal SELECT won't re-trigger RLS for the calling role.
CREATE OR REPLACE FUNCTION public.is_team_leader(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND (role = 'leader' OR is_leader = true)
  );
$$;

-- (Optional) Ensure the function owner is a role that can bypass RLS (usually the DB owner).
-- If needed, after deploying run: ALTER FUNCTION public.is_team_leader(uuid, uuid) OWNER TO postgres;

-- 2) Replace the problematic policy with one that calls the helper.
DROP POLICY IF EXISTS "Team leaders can remove members" ON public.team_members;

CREATE POLICY "Team leaders can remove members"
ON public.team_members FOR DELETE
USING (
  public.is_team_leader(team_id, auth.uid())  -- uses helper instead of querying same table directly
  AND team_members.user_id <> auth.uid()
);
