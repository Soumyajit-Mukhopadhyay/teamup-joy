-- Make the team-files bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'team-files';

-- Drop the public viewing policy
DROP POLICY IF EXISTS "Anyone can view team files" ON storage.objects;

-- Create policy for team members to view files in their teams
-- Using a simpler approach: team members can view any file where they're a member of a team
CREATE POLICY "Team members can view team files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'team-files' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
    AND name LIKE tm.team_id::text || '/%'
  )
);

-- Update upload policy to organize by team_id
DROP POLICY IF EXISTS "Team members can upload files" ON storage.objects;

CREATE POLICY "Team members can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-files' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
    AND name LIKE tm.team_id::text || '/%'
  )
);