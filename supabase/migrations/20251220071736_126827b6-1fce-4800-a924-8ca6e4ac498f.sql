-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  userid TEXT NOT NULL UNIQUE,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hackathon_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create team_requests table
CREATE TABLE public.team_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on team_requests
ALTER TABLE public.team_requests ENABLE ROW LEVEL SECURITY;

-- Create messages table for team chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Teams policies - team members can view their teams
CREATE POLICY "Team members can view teams" 
ON public.teams FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.team_id = teams.id 
    AND team_members.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Authenticated users can create teams" 
ON public.teams FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team creators can update teams" 
ON public.teams FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Team creators can delete teams" 
ON public.teams FOR DELETE 
USING (auth.uid() = created_by);

-- Team members policies
CREATE POLICY "Team members can view team members" 
ON public.team_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id 
    AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "Team creators can add members" 
ON public.team_members FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND teams.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Members can leave teams" 
ON public.team_members FOR DELETE 
USING (user_id = auth.uid());

-- Team requests policies
CREATE POLICY "Users can view their requests" 
ON public.team_requests FOR SELECT 
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Authenticated users can create requests" 
ON public.team_requests FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Request recipients can update requests" 
ON public.team_requests FOR UPDATE 
USING (to_user_id = auth.uid());

CREATE POLICY "Request senders can delete requests" 
ON public.team_requests FOR DELETE 
USING (from_user_id = auth.uid());

-- Messages policies
CREATE POLICY "Team members can view messages" 
ON public.messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.team_id = messages.team_id 
    AND team_members.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can send messages" 
ON public.messages FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.team_id = messages.team_id 
    AND team_members.user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_requests_updated_at
  BEFORE UPDATE ON public.team_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for team files
INSERT INTO storage.buckets (id, name, public) VALUES ('team-files', 'team-files', true);

-- Storage policies for team files
CREATE POLICY "Anyone can view team files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'team-files');

CREATE POLICY "Authenticated users can upload team files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'team-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'team-files' AND auth.uid()::text = (storage.foldername(name))[1]);