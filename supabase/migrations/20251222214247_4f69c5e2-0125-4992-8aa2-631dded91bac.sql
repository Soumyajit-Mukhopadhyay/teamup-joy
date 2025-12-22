-- Allow anyone to view teams that are looking for teammates
CREATE POLICY "Anyone can view teams looking for teammates"
ON public.teams
FOR SELECT
USING (looking_for_teammates = true);