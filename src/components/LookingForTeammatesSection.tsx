import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, UserPlus, Eye, EyeOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TeamLookingForMembers {
  id: string;
  name: string;
  hackathon_id: string;
  looking_visibility: string;
  leader_profile?: {
    username: string;
    userid: string;
    user_id: string;
  };
  member_count: number;
  already_requested: boolean;
}

interface LookingForTeammatesSectionProps {
  hackathonSlug: string;
}

const LookingForTeammatesSection = ({ hackathonSlug }: LookingForTeammatesSectionProps) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamLookingForMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !hackathonSlug) return;
    fetchTeamsLookingForMembers();
  }, [user, hackathonSlug]);

  const fetchTeamsLookingForMembers = async () => {
    if (!user) return;

    // Fetch teams looking for teammates for this hackathon
    const { data: teamsData, error } = await supabase
      .from('teams')
      .select('id, name, hackathon_id, looking_visibility, created_by')
      .eq('hackathon_id', hackathonSlug)
      .eq('looking_for_teammates', true);

    if (error || !teamsData) {
      setTeams([]);
      setLoading(false);
      return;
    }

    // Get user's friends for visibility filtering
    const { data: friendsData } = await supabase
      .from('friends')
      .select('friend_id, user_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const friendIds = new Set(
      (friendsData || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id)
    );

    // Filter teams based on visibility
    const visibleTeams = teamsData.filter(team => {
      if (team.created_by === user.id) return false; // Don't show own teams
      if (team.looking_visibility === 'anyone') return true;
      if (team.looking_visibility === 'friends_only') {
        return friendIds.has(team.created_by);
      }
      return false;
    });

    if (visibleTeams.length === 0) {
      setTeams([]);
      setLoading(false);
      return;
    }

    // Get team leaders' profiles
    const leaderIds = visibleTeams.map(t => t.created_by);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, userid')
      .in('user_id', leaderIds);

    // Get member counts
    const teamIds = visibleTeams.map(t => t.id);
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds);

    const memberCounts: Record<string, number> = {};
    (memberships || []).forEach(m => {
      memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
    });

    // Check if user already requested to join these teams
    const { data: existingRequests } = await supabase
      .from('team_requests')
      .select('team_id')
      .eq('from_user_id', user.id)
      .eq('status', 'pending')
      .in('team_id', teamIds);

    const requestedTeamIds = new Set((existingRequests || []).map(r => r.team_id));

    // Check if user is already a member of any team
    const { data: userMemberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .in('team_id', teamIds);

    const memberTeamIds = new Set((userMemberships || []).map(m => m.team_id));

    const enrichedTeams: TeamLookingForMembers[] = visibleTeams
      .filter(t => !memberTeamIds.has(t.id)) // Filter out teams user is already in
      .map(team => ({
        id: team.id,
        name: team.name,
        hackathon_id: team.hackathon_id,
        looking_visibility: team.looking_visibility,
        leader_profile: profiles?.find(p => p.user_id === team.created_by),
        member_count: memberCounts[team.id] || 1,
        already_requested: requestedTeamIds.has(team.id),
      }));

    setTeams(enrichedTeams);
    setLoading(false);
  };

  const requestToJoin = async (team: TeamLookingForMembers) => {
    if (!user || !team.leader_profile) return;
    
    setRequestingTeamId(team.id);

    try {
      const { error } = await supabase.from('team_requests').insert({
        team_id: team.id,
        from_user_id: user.id,
        to_user_id: team.leader_profile.user_id,
        status: 'pending',
      });

      if (error) throw error;

      toast.success(`Request sent to join "${team.name}"`);
      setTeams(prev => prev.map(t => 
        t.id === team.id ? { ...t, already_requested: true } : t
      ));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setRequestingTeamId(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Looking for Teammates</h3>
        </div>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return null; // Don't show section if no teams are looking
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Looking for Teammates</h3>
        <Badge variant="secondary" className="ml-auto">{teams.length}</Badge>
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="space-y-3 pr-2">
          {teams.map((team) => (
            <div 
              key={team.id} 
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {team.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{team.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>by @{team.leader_profile?.userid}</span>
                    <span>•</span>
                    <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
                    {team.looking_visibility === 'friends_only' && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Friends only
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant={team.already_requested ? 'outline' : 'default'}
                disabled={team.already_requested || requestingTeamId === team.id}
                onClick={() => requestToJoin(team)}
                className="shrink-0 ml-2"
              >
                {team.already_requested ? (
                  'Requested'
                ) : requestingTeamId === team.id ? (
                  'Sending...'
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Join
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LookingForTeammatesSection;
