import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Eye, EyeOff, Crown, ChevronRight, ExternalLink } from 'lucide-react';

interface TeamLooking {
  id: string;
  name: string;
  hackathon_id: string;
  hackathon_name: string;
  looking_visibility: string;
  member_count: number;
  is_leader: boolean;
  members: {
    user_id: string;
    username: string;
    userid: string;
    is_leader: boolean;
  }[];
}

interface ProfileLookingForTeammatesSectionProps {
  targetUserId: string;
  isOwnProfile: boolean;
}

const ProfileLookingForTeammatesSection = ({ targetUserId, isOwnProfile }: ProfileLookingForTeammatesSectionProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamLooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      // Check if current user is friends with target user
      if (user && user.id !== targetUserId) {
        const { data: friendData } = await supabase
          .from('friends')
          .select('id')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
          .single();
        
        setIsFriend(!!friendData);
      }

      // Get teams where target user is leader and looking for teammates
      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('team_id, is_leader, role')
        .eq('user_id', targetUserId);

      if (!teamMemberships || teamMemberships.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      const leaderTeamIds = teamMemberships
        .filter(m => m.is_leader || m.role === 'leader')
        .map(m => m.team_id);

      if (leaderTeamIds.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      // Fetch teams that are looking for teammates
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', leaderTeamIds)
        .eq('looking_for_teammates', true);

      if (!teamsData || teamsData.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      // Filter based on visibility
      const visibleTeams = teamsData.filter(team => {
        if (isOwnProfile) return true; // Own profile sees all
        if (team.looking_visibility === 'anyone') return true;
        if (team.looking_visibility === 'friends_only' && (isFriend || user?.id === targetUserId)) return true;
        return false;
      });

      if (visibleTeams.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      // Get hackathon names
      const hackathonIds = visibleTeams.map(t => t.hackathon_id);
      const { data: hackathons } = await supabase
        .from('hackathons')
        .select('id, slug, name')
        .or(`slug.in.(${hackathonIds.join(',')}),id.in.(${hackathonIds.join(',')})`);

      const hackathonMap: Record<string, string> = {};
      hackathons?.forEach(h => {
        hackathonMap[h.slug] = h.name;
        hackathonMap[h.id] = h.name;
      });

      // Get members for each team
      const teamIds = visibleTeams.map(t => t.id);
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('team_id, user_id, is_leader, role')
        .in('team_id', teamIds);

      const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', memberUserIds);

      const enrichedTeams: TeamLooking[] = visibleTeams.map(team => {
        const teamMembers = (allMembers || [])
          .filter(m => m.team_id === team.id)
          .map(m => {
            const profile = profiles?.find(p => p.user_id === m.user_id);
            return {
              user_id: m.user_id,
              username: profile?.username || 'Unknown',
              userid: profile?.userid || '',
              is_leader: m.is_leader || m.role === 'leader',
            };
          })
          .sort((a, b) => (a.is_leader ? -1 : 1));

        return {
          id: team.id,
          name: team.name,
          hackathon_id: team.hackathon_id,
          hackathon_name: hackathonMap[team.hackathon_id] || team.hackathon_id,
          looking_visibility: team.looking_visibility,
          member_count: teamMembers.length,
          is_leader: true,
          members: teamMembers,
        };
      });

      setTeams(enrichedTeams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user, isOwnProfile, isFriend]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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
    return null;
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Looking for Teammates</h3>
        </div>
        <Badge variant="secondary">{teams.length}</Badge>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="p-4 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{team.name}</h4>
                    <Badge variant="outline" className="text-xs gap-1">
                      {team.looking_visibility === 'friends_only' ? (
                        <><EyeOff className="h-3 w-3" /> Friends only</>
                      ) : (
                        <><Eye className="h-3 w-3" /> Anyone</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{team.hackathon_name}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/team/${team.id}/details`)}
                  className="gap-1"
                >
                  View <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

              {/* Members preview */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Members:</span>
                <div className="flex -space-x-2">
                  {team.members.slice(0, 4).map((member) => (
                    <Avatar
                      key={member.user_id}
                      className="h-7 w-7 border-2 border-background cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => navigate(`/user/${member.userid}`)}
                    >
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {member.username[0]?.toUpperCase()}
                        {member.is_leader && (
                          <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {team.members.length > 4 && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                      +{team.members.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProfileLookingForTeammatesSection;
