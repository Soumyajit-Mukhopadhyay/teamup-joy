-- Add looking_for_teammates to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS looking_for_teammates boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS looking_visibility text NOT NULL DEFAULT 'anyone' CHECK (looking_visibility IN ('anyone', 'friends_only'));

-- Create notifications table for all types of notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Create AI learning feedback table
CREATE TABLE IF NOT EXISTS public.ai_learning_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_message text NOT NULL,
  ai_response text NOT NULL,
  tool_calls jsonb,
  was_successful boolean,
  user_rating integer CHECK (user_rating >= 1 AND user_rating <= 5),
  feedback_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on ai_learning_feedback
ALTER TABLE public.ai_learning_feedback ENABLE ROW LEVEL SECURITY;

-- Only system can insert learning feedback (no user access needed)
CREATE POLICY "System can insert learning feedback"
ON public.ai_learning_feedback FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can read learning feedback"
ON public.ai_learning_feedback FOR SELECT
USING (true);

-- Function to create notifications when someone is looking for teammates
CREATE OR REPLACE FUNCTION public.notify_looking_for_teammates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_leader_id uuid;
  team_name text;
  hackathon_name text;
  friend_record RECORD;
BEGIN
  -- Only trigger when looking_for_teammates changes to true
  IF NEW.looking_for_teammates = true AND (OLD.looking_for_teammates = false OR OLD.looking_for_teammates IS NULL) THEN
    -- Get team leader
    SELECT user_id INTO team_leader_id FROM team_members WHERE team_id = NEW.id AND is_leader = true LIMIT 1;
    IF team_leader_id IS NULL THEN
      team_leader_id := NEW.created_by;
    END IF;
    
    team_name := NEW.name;
    
    -- Get hackathon name
    SELECT name INTO hackathon_name FROM hackathons WHERE slug = NEW.hackathon_id OR id::text = NEW.hackathon_id LIMIT 1;
    
    -- If visibility is friends_only, notify friends
    IF NEW.looking_visibility = 'friends_only' THEN
      FOR friend_record IN 
        SELECT friend_id FROM friends WHERE user_id = team_leader_id
        UNION
        SELECT user_id FROM friends WHERE friend_id = team_leader_id
      LOOP
        INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
        VALUES (
          friend_record.friend_id,
          'looking_for_teammates',
          'Friend Looking for Teammates',
          'Your friend is looking for teammates for team "' || team_name || '" in ' || COALESCE(hackathon_name, 'a hackathon'),
          NEW.id,
          'team'
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for looking_for_teammates notifications
DROP TRIGGER IF EXISTS notify_looking_for_teammates_trigger ON public.teams;
CREATE TRIGGER notify_looking_for_teammates_trigger
  AFTER UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_looking_for_teammates();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;