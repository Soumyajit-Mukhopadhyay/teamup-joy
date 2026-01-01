-- Create table for pending AI training suggestions from users
CREATE TABLE public.ai_pending_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  suggestion_text TEXT NOT NULL,
  parsed_pattern JSONB,
  safety_analysis JSONB,
  risk_level TEXT DEFAULT 'pending' CHECK (risk_level IN ('pending', 'low', 'medium', 'high', 'critical', 'auto_approved', 'auto_denied')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'auto_applied')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_pending_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can see their own suggestions
CREATE POLICY "Users can view own suggestions"
ON public.ai_pending_suggestions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create suggestions
CREATE POLICY "Users can create suggestions"
ON public.ai_pending_suggestions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.ai_pending_suggestions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update suggestions (approve/deny)
CREATE POLICY "Admins can update suggestions"
ON public.ai_pending_suggestions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.ai_pending_suggestions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));