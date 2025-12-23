import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Globe,
  UserCheck,
  Search,
  ChevronRight,
  Crown,
  Clock,
  MessageCircle,
  Check,
} from 'lucide-react';

interface TeamMember {
  user_id: string;
  username: string;
  userid: string;
  is_leader: boolean;
  isFriend: boolean;
  requestSent: boolean;
}

interface TeamLookingForMembers {
  id: string;
  name: string;
  hackathon_id: string;
  hackathon_name: string;
  looking_visibility: string;
  leader_profile?: {
    username: string;
    userid: string;
    user_id: string;
  };
  member_count: number;
  already_requested: boolean;
  members: TeamMember[];
}

const LookingForTeammates = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<TeamLookingForMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [sendingFriendRequest, setSendingFriendRequest] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all teams looking for teammates
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, hackathon_id, looking_visibility, created_by')
        .eq('looking_for_teammates', true);

      if (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
        setLoading(false);
        return;
      }

      if (!teamsData || teamsData.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      // Get user's friends
      const { data: friendsData } = await supabase
        .from('friends')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = new Set(
        (friendsData || []).map(f => (f.user_id === user.id ? f.friend_id : f.user_id))
      );

      // Get user's pending friend requests
      const { data: pendingRequests } = await supabase
        .from('friend_requests')
        .select('to_user_id')
        .eq('from_user_id', user.id)
        .eq('status', 'pending');

      const sentRequestIds = new Set((pendingRequests || []).map(r => r.to_user_id));

      // Get user's team memberships
      const { data: userMemberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const memberTeamIds = new Set((userMemberships || []).map(m => m.team_id));

      // Filter teams: exclude own teams and teams user is already in
      const visibleTeams = teamsData.filter(team => {
        if (team.created_by === user.id) return false;
        if (memberTeamIds.has(team.id)) return false;
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

      // Get hackathon info
      const hackathonIds = [...new Set(visibleTeams.map(t => t.hackathon_id))];
      const { data: hackathons } = await supabase
        .from('hackathons')
        .select('id, slug, name')
        .or(`slug.in.(${hackathonIds.join(',')}),id.in.(${hackathonIds.join(',')})`);

      const hackathonMap: Record<string, string> = {};
      hackathons?.forEach(h => {
        hackathonMap[h.slug] = h.name;
        hackathonMap[h.id] = h.name;
      });

      // Get all team members
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

      // Get leader profiles
      const leaderIds = visibleTeams.map(t => t.created_by);
      const { data: leaderProfiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', leaderIds);

      // Check existing team requests
      const { data: existingRequests } = await supabase
        .from('team_requests')
        .select('team_id')
        .eq('from_user_id', user.id)
        .eq('status', 'pending')
        .in('team_id', teamIds);

      const requestedTeamIds = new Set((existingRequests || []).map(r => r.team_id));

      // Build enriched teams
      const enrichedTeams: TeamLookingForMembers[] = visibleTeams.map(team => {
        const teamMembers = (allMembers || [])
          .filter(m => m.team_id === team.id)
          .map(m => {
            const profile = allProfiles?.find(p => p.user_id === m.user_id);
            return {
              user_id: m.user_id,
              username: profile?.username || 'Unknown',
              userid: profile?.userid || '',
              is_leader: m.is_leader || m.role === 'leader',
              isFriend: friendIds.has(m.user_id),
              requestSent: sentRequestIds.has(m.user_id),
            };
          })
          .sort((a, b) => (a.is_leader ? -1 : 1));

        const leaderProfile = leaderProfiles?.find(p => p.user_id === team.created_by);

        return {
          id: team.id,
          name: team.name,
          hackathon_id: team.hackathon_id,
          hackathon_name: hackathonMap[team.hackathon_id] || team.hackathon_id,
          looking_visibility: team.looking_visibility,
          leader_profile: leaderProfile,
          member_count: teamMembers.length || 1,
          already_requested: requestedTeamIds.has(team.id),
          members: teamMembers,
        };
      });

      setTeams(enrichedTeams);
    } catch (err) {
      console.error('Unexpected error:', err);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchTeams();
  }, [user, authLoading, fetchTeams]);

  // Filter teams based on search query (hackathon name, team name, or member name)
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    
    const query = searchQuery.toLowerCase();
    return teams.filter(team => {
      // Search in team name
      if (team.name.toLowerCase().includes(query)) return true;
      // Search in hackathon name
      if (team.hackathon_name.toLowerCase().includes(query)) return true;
      // Search in member names
      if (team.members.some(m => 
        m.username.toLowerCase().includes(query) || 
        m.userid.toLowerCase().includes(query)
      )) return true;
      // Search in leader name
      if (team.leader_profile?.username.toLowerCase().includes(query)) return true;
      if (team.leader_profile?.userid.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [teams, searchQuery]);

  const anyoneTeams = filteredTeams.filter(t => t.looking_visibility === 'anyone');
  const friendsTeams = filteredTeams.filter(t => t.looking_visibility === 'friends_only');

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
      setTeams(prev =>
        prev.map(t => (t.id === team.id ? { ...t, already_requested: true } : t))
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setRequestingTeamId(null);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return;

    setSendingFriendRequest(targetUserId);

    try {
      const { error } = await supabase.from('friend_requests').insert({
        from_user_id: user.id,
        to_user_id: targetUserId,
      });

      if (error) throw error;

      toast.success('Friend request sent!');
      
      // Update local state
      setTeams(prev =>
        prev.map(team => ({
          ...team,
          members: team.members.map(m =>
            m.user_id === targetUserId ? { ...m, requestSent: true } : m
          ),
        }))
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to send friend request');
    } finally {
      setSendingFriendRequest(null);
    }
  };

  const renderTeamCard = (team: TeamLookingForMembers) => (
    <div
      key={team.id}
      className="glass-card p-5 hover:bg-secondary/30 transition-colors"
    >
      {/* Team Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold truncate">{team.name}</h3>
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Users className="h-3 w-3" />
              {team.member_count}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{team.hackathon_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Led by @{team.leader_profile?.userid}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/team/${team.id}/details`)}
          >
            View <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
          <Button
            size="sm"
            variant={team.already_requested ? 'outline' : 'default'}
            disabled={team.already_requested || requestingTeamId === team.id}
            onClick={() => requestToJoin(team)}
          >
            {team.already_requested ? (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Requested
              </>
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

      {/* Team Members */}
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium mb-3">Team Members</p>
        <div className="space-y-2">
          {team.members.map(member => {
            const isCurrentUser = user?.id === member.user_id;
            const showFriendButton = !isCurrentUser && !member.isFriend && !member.requestSent;

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/user/${member.userid}`)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {member.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.username}</span>
                      {member.is_leader && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">@{member.userid}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.isFriend && !isCurrentUser && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/chat/${member.user_id}`)}
                        className="gap-1 h-7 text-xs"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Chat
                      </Button>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Check className="h-3 w-3" />
                        Friend
                      </Badge>
                    </>
                  )}

                  {member.requestSent && !isCurrentUser && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  )}

                  {showFriendButton && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendFriendRequest(member.user_id)}
                      disabled={sendingFriendRequest === member.user_id}
                      className="gap-1 h-7 text-xs"
                    >
                      <UserPlus className="h-3 w-3" />
                      {sendingFriendRequest === member.user_id ? 'Sending...' : 'Add Friend'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <AuthenticatedLayout>
        <div className="container py-16 text-center text-muted-foreground">Loading...</div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container py-8 max-w-4xl">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Find Teammates</h1>
            <p className="text-muted-foreground text-sm">
              Discover teams looking for members and join them
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by hackathon, team, or member name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading teams...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            {searchQuery ? (
              <>
                <p className="text-muted-foreground mb-2">No teams found matching "{searchQuery}"</p>
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-2">No teams looking for members right now</p>
                <p className="text-sm text-muted-foreground/70">
                  Check back later or create your own team
                </p>
              </>
            )}
          </div>
        ) : (
          <Tabs defaultValue={anyoneTeams.length > 0 ? 'anyone' : 'friends'}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="anyone" className="flex-1 gap-2">
                <Globe className="h-4 w-4" />
                Open to Anyone ({anyoneTeams.length})
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex-1 gap-2">
                <UserCheck className="h-4 w-4" />
                Friends' Teams ({friendsTeams.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="anyone">
              {anyoneTeams.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-muted-foreground">No open teams found</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="space-y-4 pr-2">
                    {anyoneTeams.map(renderTeamCard)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="friends">
              {friendsTeams.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <p className="text-muted-foreground">No friends' teams found</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="space-y-4 pr-2">
                    {friendsTeams.map(renderTeamCard)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default LookingForTeammates;
