-- Allow anyone to view team members of teams that are looking for teammates
CREATE POLICY "Anyone can view members of public teams"
ON public.team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teams t 
    WHERE t.id = team_members.team_id 
    AND t.looking_for_teammates = true
  )
);