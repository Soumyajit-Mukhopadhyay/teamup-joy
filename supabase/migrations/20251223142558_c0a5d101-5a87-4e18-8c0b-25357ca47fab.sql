-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Team members can view teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view public team members" ON public.team_members;
DROP POLICY IF EXISTS "Anyone can view members of public teams" ON public.team_members;

-- Recreate the team members view policy without recursion
-- This policy allows viewing team members if the team is looking for teammates (check teams table directly via join, not subquery that might recurse)
CREATE POLICY "Anyone can view members of public teams" 
ON public.team_members 
FOR SELECT 
USING (
  team_id IN (SELECT id FROM teams WHERE looking_for_teammates = true)
);

-- Recreate teams policy to avoid self-referencing through team_members which references back to teams
CREATE POLICY "Team members can view teams" 
ON public.teams 
FOR SELECT 
USING (
  created_by = auth.uid() OR is_team_member(id, auth.uid())
);