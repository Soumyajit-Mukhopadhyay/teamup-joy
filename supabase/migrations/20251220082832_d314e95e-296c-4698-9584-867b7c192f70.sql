-- Add storage policy for friends to access friend chat files
CREATE POLICY "Friends can view friend files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'team-files' AND
  name LIKE 'friends/%' AND
  auth.uid() IS NOT NULL AND
  (
    -- User owns the file (file path starts with friends/{user_id}/)
    name LIKE 'friends/' || auth.uid()::text || '/%' OR
    -- User is friends with file owner (check both directions in friends table)
    EXISTS (
      SELECT 1 FROM public.friends f
      WHERE 
        (f.user_id = auth.uid() AND name LIKE 'friends/' || f.friend_id::text || '/%') OR
        (f.friend_id = auth.uid() AND name LIKE 'friends/' || f.user_id::text || '/%')
    )
  )
);

-- Add storage policy for friends to upload their own files
CREATE POLICY "Users can upload friend chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-files' AND
  name LIKE 'friends/' || auth.uid()::text || '/%' AND
  auth.uid() IS NOT NULL
);