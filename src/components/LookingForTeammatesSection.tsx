import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, UserPlus, Globe, UserCheck, ChevronRight, Crown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  members?: {
    user_id: string;
    username: string;
    userid: string;
    is_leader: boolean;
  }[];
}

interface LookingForTeammatesSectionProps {
  hackathonSlug: string;
}

const LookingForTeammatesSection = ({ hackathonSlug }: LookingForTeammatesSectionProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anyoneTeams, setAnyoneTeams] = useState<TeamLookingForMembers[]>([]);
  const [friendsTeams, setFriendsTeams] = useState<TeamLookingForMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);

  const fetchTeamsLookingForMembers = useCallback(async () => {
    if (!user || !hackathonSlug) {
      setLoading(false);
      return;
    }

    try {
      // Fetch teams looking for teammates for this hackathon
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, hackathon_id, looking_visibility, created_by')
        .eq('hackathon_id', hackathonSlug)
        .eq('looking_for_teammates', true);

      if (error) {
        console.error('Error fetching teams:', error);
        setAnyoneTeams([]);
        setFriendsTeams([]);
        setLoading(false);
        return;
      }

      if (!teamsData || teamsData.length === 0) {
        setAnyoneTeams([]);
        setFriendsTeams([]);
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
        setAnyoneTeams([]);
        setFriendsTeams([]);
        setLoading(false);
        return;
      }

      // Get team leaders' profiles
      const leaderIds = visibleTeams.map(t => t.created_by);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', leaderIds);

      // Get all members for teams
      const teamIds = visibleTeams.map(t => t.id);
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('team_id, user_id, is_leader, role')
        .in('team_id', teamIds);

      // Get profiles for all members
      const allMemberIds = [...new Set((allMembers || []).map(m => m.user_id))];
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', allMemberIds);

      const memberCounts: Record<string, number> = {};
      const teamMembersMap: Record<string, typeof allMembers> = {};
      
      (allMembers || []).forEach(m => {
        memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
        if (!teamMembersMap[m.team_id]) teamMembersMap[m.team_id] = [];
        teamMembersMap[m.team_id].push(m);
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
        .filter(t => !memberTeamIds.has(t.id))
        .map(team => {
          const teamMembers = (teamMembersMap[team.id] || []).map(m => {
            const profile = allProfiles?.find(p => p.user_id === m.user_id);
            return {
              user_id: m.user_id,
              username: profile?.username || 'Unknown',
              userid: profile?.userid || '',
              is_leader: m.is_leader || m.role === 'leader',
            };
          }).sort((a, b) => (a.is_leader ? -1 : 1));

          return {
            id: team.id,
            name: team.name,
            hackathon_id: team.hackathon_id,
            looking_visibility: team.looking_visibility,
            leader_profile: profiles?.find(p => p.user_id === team.created_by),
            member_count: memberCounts[team.id] || 1,
            already_requested: requestedTeamIds.has(team.id),
            members: teamMembers,
          };
        });

      // Separate into two lists
      setAnyoneTeams(enrichedTeams.filter(t => t.looking_visibility === 'anyone'));
      setFriendsTeams(enrichedTeams.filter(t => t.looking_visibility === 'friends_only'));
    } catch (err) {
      console.error('Unexpected error:', err);
      setAnyoneTeams([]);
      setFriendsTeams([]);
    } finally {
      setLoading(false);
    }
  }, [user, hackathonSlug]);

  useEffect(() => {
    if (!user || !hackathonSlug) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetchTeamsLookingForMembers();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`looking-for-teammates-${hackathonSlug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `hackathon_id=eq.${hackathonSlug}`,
        },
        () => {
          fetchTeamsLookingForMembers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_requests',
        },
        () => {
          fetchTeamsLookingForMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, hackathonSlug, fetchTeamsLookingForMembers]);

  const requestToJoin = async (team: TeamLookingForMembers) => {
    if (!user || !team.leader_profile) return;
    
    setRequestingTeamId(team.id);

    try {
      const { data: existing } = await supabase
        .from('team_requests')
        .select('id, status')
        .eq('team_id', team.id)
        .eq('from_user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pending') {
          toast.error('Request already pending');
          return;
        }
        await supabase
          .from('team_requests')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        const { error } = await supabase.from('team_requests').insert({
          team_id: team.id,
          from_user_id: user.id,
          to_user_id: team.leader_profile.user_id,
          status: 'pending',
        });

        if (error) throw error;
      }

      toast.success(`Request sent to join "${team.name}"`);
      
      const updateTeam = (t: TeamLookingForMembers) => 
        t.id === team.id ? { ...t, already_requested: true } : t;
      setAnyoneTeams(prev => prev.map(updateTeam));
      setFriendsTeams(prev => prev.map(updateTeam));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setRequestingTeamId(null);
    }
  };

  const renderTeamCard = (team: TeamLookingForMembers) => (
    <div 
      key={team.id} 
      className="p-4 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/team/${team.id}/details`)}
            className="gap-1"
          >
            View <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={team.already_requested ? 'outline' : 'default'}
            disabled={team.already_requested || requestingTeamId === team.id}
            onClick={() => requestToJoin(team)}
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
      </div>

      {/* Members preview */}
      {team.members && team.members.length > 0 && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
          <div className="flex -space-x-2">
            {team.members.slice(0, 4).map((member) => (
              <Avatar
                key={member.user_id}
                className="h-6 w-6 border-2 border-background cursor-pointer hover:scale-110 transition-transform"
                onClick={() => navigate(`/user/${member.userid}`)}
              >
                <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                  {member.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {team.members.length > 4 && (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                +{team.members.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {team.members.find(m => m.is_leader)?.username} (leader)
            {team.members.length > 1 && ` + ${team.members.length - 1} more`}
          </span>
        </div>
      )}
    </div>
  );

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

  const totalTeams = anyoneTeams.length + friendsTeams.length;

  if (totalTeams === 0) {
    return null;
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Looking for Teammates</h3>
        <Badge variant="secondary" className="ml-auto">{totalTeams}</Badge>
      </div>

      <Tabs defaultValue={anyoneTeams.length > 0 ? "anyone" : "friends"} className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="anyone" className="flex-1 gap-1 text-xs">
            <Globe className="h-3 w-3" />
            Anyone ({anyoneTeams.length})
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex-1 gap-1 text-xs">
            <UserCheck className="h-3 w-3" />
            Friends ({friendsTeams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anyone">
          {anyoneTeams.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No teams open to anyone right now
            </p>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3 pr-2">
                {anyoneTeams.map(renderTeamCard)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="friends">
          {friendsTeams.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No friend teams looking for members
            </p>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3 pr-2">
                {friendsTeams.map(renderTeamCard)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LookingForTeammatesSection;