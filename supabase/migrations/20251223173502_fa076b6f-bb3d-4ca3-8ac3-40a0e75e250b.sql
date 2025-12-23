-- Create a trigger function to delete teams when they have no members left
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_teams()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- After a member is deleted, check if team has any members left
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = OLD.team_id) THEN
    -- Delete the team if no members remain
    DELETE FROM teams WHERE id = OLD.team_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger that fires after a team member is deleted
DROP TRIGGER IF EXISTS trigger_cleanup_orphaned_teams ON team_members;
CREATE TRIGGER trigger_cleanup_orphaned_teams
AFTER DELETE ON team_members
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_teams();