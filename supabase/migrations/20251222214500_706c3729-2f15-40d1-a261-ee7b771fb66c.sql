-- Update the notify_looking_for_teammates function to include the friend's actual name
CREATE OR REPLACE FUNCTION public.notify_looking_for_teammates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  team_leader_id uuid;
  team_leader_name text;
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
    
    -- Get team leader's name
    SELECT username INTO team_leader_name FROM profiles WHERE user_id = team_leader_id LIMIT 1;
    IF team_leader_name IS NULL THEN
      team_leader_name := 'Your friend';
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
          team_leader_name || ' is Looking for Teammates',
          team_leader_name || ' is looking for teammates for team "' || team_name || '" in ' || COALESCE(hackathon_name, 'a hackathon'),
          NEW.id,
          'team'
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;