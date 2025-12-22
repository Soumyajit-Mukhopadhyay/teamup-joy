import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  member_count?: number;
  is_leader?: boolean;
}

export const useUserTeamsForHackathon = (hackathonId: string | undefined) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);

  const fetchTeams = async () => {
    if (!user || !hackathonId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    // Get team memberships
    const { data: memberData } = await supabase
      .from('team_members')
      .select('team_id, role, is_leader')
      .eq('user_id', user.id);

    if (!memberData || memberData.length === 0) {
      setTeams([]);
      setTeamCount(0);
      setLoading(false);
      return;
    }

    const teamIds = memberData.map((m) => m.team_id);

    // Get teams for this hackathon
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .eq('hackathon_id', hackathonId);

    if (teamsData && teamsData.length > 0) {
      const teamsWithInfo = teamsData.map((team) => {
        const memberInfo = memberData.find((m) => m.team_id === team.id);
        return {
          ...team,
          is_leader: memberInfo?.role === 'leader' || memberInfo?.is_leader || team.created_by === user.id,
        };
      });
      setTeams(teamsWithInfo);
      setTeamCount(teamsWithInfo.length);
    } else {
      setTeams([]);
      setTeamCount(0);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, [user, hackathonId]);

  const canCreateMoreTeams = teamCount < 5;

  return { teams, loading, teamCount, canCreateMoreTeams, refetch: fetchTeams };
};
