-- Create table to track which AI provider is assigned to each user
CREATE TABLE public.user_ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  assigned_key_index INTEGER NOT NULL CHECK (assigned_key_index >= 1 AND assigned_key_index <= 8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_ai_providers ENABLE ROW LEVEL SECURITY;

-- Users can view their own assignment
CREATE POLICY "Users can view their own AI provider assignment"
ON public.user_ai_providers
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert (for auto-assignment on signup)
CREATE POLICY "Service role can insert AI provider assignments"
ON public.user_ai_providers
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() = user_id);

-- Service role can update (for failover reassignment)
CREATE POLICY "Service role can update AI provider assignments"
ON public.user_ai_providers
FOR UPDATE
USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() = user_id);

-- Create function to auto-assign random provider on new user creation
CREATE OR REPLACE FUNCTION public.assign_random_ai_provider()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_ai_providers (user_id, assigned_key_index)
  VALUES (NEW.id, floor(random() * 8 + 1)::integer)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign when profile is created (which happens on signup)
CREATE TRIGGER assign_ai_provider_on_profile_create
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_random_ai_provider();

-- Add trigger for updated_at
CREATE TRIGGER update_user_ai_providers_updated_at
BEFORE UPDATE ON public.user_ai_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();