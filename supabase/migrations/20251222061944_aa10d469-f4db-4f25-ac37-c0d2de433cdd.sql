-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Team leaders can remove members" ON public.team_members;

-- Create a security definer function to check team membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
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
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Team members can view team members"
ON public.team_members FOR SELECT
USING (public.is_team_member(team_id, auth.uid()));

-- Recreate team leaders remove policy using security definer
CREATE POLICY "Team leaders can remove members"
ON public.team_members FOR DELETE
USING (
  public.is_team_leader(team_id, auth.uid())
  AND user_id != auth.uid()
);