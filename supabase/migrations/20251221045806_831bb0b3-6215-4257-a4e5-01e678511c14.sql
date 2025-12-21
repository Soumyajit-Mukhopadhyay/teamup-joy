-- Create user roles enum and table for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create hackathons table with approval workflow
CREATE TABLE public.hackathons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  region text NOT NULL DEFAULT 'Global',
  location text NOT NULL DEFAULT 'Online',
  url text,
  organizer text,
  tags text[],
  is_global boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;

-- RLS policies for hackathons
CREATE POLICY "Anyone can view approved hackathons"
ON public.hackathons FOR SELECT
USING (status = 'approved');

CREATE POLICY "Admins can view all hackathons"
ON public.hackathons FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can submit hackathons"
ON public.hackathons FOR INSERT
WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

CREATE POLICY "Admins can update hackathons"
ON public.hackathons FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hackathons"
ON public.hackathons FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create admin notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage notifications
CREATE POLICY "Admins can view notifications"
ON public.admin_notifications FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update notifications"
ON public.admin_notifications FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notifications"
ON public.admin_notifications FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert notifications"
ON public.admin_notifications FOR INSERT
WITH CHECK (true);

-- Create trigger to notify admin when hackathon is submitted
CREATE OR REPLACE FUNCTION public.notify_hackathon_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, reference_id, reference_type)
  VALUES (
    'hackathon_submission',
    'New Hackathon Submission',
    'A new hackathon "' || NEW.name || '" has been submitted for approval.',
    NEW.id,
    'hackathon'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_hackathon_submitted
  AFTER INSERT ON public.hackathons
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_hackathon_submission();

-- Update timestamp trigger for hackathons
CREATE TRIGGER update_hackathons_updated_at
  BEFORE UPDATE ON public.hackathons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_leader column to team_members for clearer leader status
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_leader boolean NOT NULL DEFAULT false;

-- Create policy for team leaders to manage members
CREATE POLICY "Team leaders can remove members"
ON public.team_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND (tm.role = 'leader' OR tm.is_leader = true)
  )
  AND team_members.user_id != auth.uid()
);

-- Function to check if user is team leader
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
  )
$$;