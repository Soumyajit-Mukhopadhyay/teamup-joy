-- Enable realtime for team_requests and team_members only (notifications already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;