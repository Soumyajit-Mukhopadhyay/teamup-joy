-- Add UPDATE policy for ai_chat_messages to allow soft-delete (hidden_at)
CREATE POLICY "Users can update their own AI chat messages"
ON public.ai_chat_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- FIX SECURITY: Update ai_learning_feedback policies to be service role only
-- Drop overly permissive policies
DROP POLICY IF EXISTS "System can read learning feedback" ON public.ai_learning_feedback;
DROP POLICY IF EXISTS "System can insert learning feedback" ON public.ai_learning_feedback;

-- Create proper restrictive policies (only authenticated backend can access)
CREATE POLICY "Service role can read learning feedback"
ON public.ai_learning_feedback
FOR SELECT
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can insert learning feedback"
ON public.ai_learning_feedback
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- FIX SECURITY: Update ai_learned_patterns policies to be service role only
DROP POLICY IF EXISTS "System can manage patterns" ON public.ai_learned_patterns;

CREATE POLICY "Service role can manage patterns"
ON public.ai_learned_patterns
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- FIX SECURITY: Restrict hackathon_participations to authenticated users only
DROP POLICY IF EXISTS "Anyone can view participations" ON public.hackathon_participations;

CREATE POLICY "Authenticated users can view participations"
ON public.hackathon_participations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- FIX SECURITY: Restrict admin_notifications insert to service role
DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;

CREATE POLICY "Service role can insert admin notifications"
ON public.admin_notifications
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- FIX SECURITY: Restrict notifications insert to service role
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');