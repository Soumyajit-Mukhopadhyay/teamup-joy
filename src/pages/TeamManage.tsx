import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, UserPlus, X, ArrowLeft, Crown, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  is_leader: boolean;
  profile: {
    username: string;
    userid: string;
  };
}

interface SearchResult {
  id: string;
  user_id: string;
  username: string;
  userid: string;
}

const TeamManage = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    fetchTeamData();
  }, [user, authLoading, teamId]);

  const fetchTeamData = async () => {
    if (!teamId || !user) return;

    // Fetch team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name, created_by')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError || !team) {
      toast.error('Team not found');
      navigate('/teams');
      return;
    }

    setTeamName(team.name);

    // Fetch team members
    const { data: memberData, error: memberError } = await supabase
      .from('team_members')
      .select('id, user_id, role, is_leader')
      .eq('team_id', teamId);

    if (memberError) {
      toast.error('Failed to load team members');
      setLoading(false);
      return;
    }

    // Check if current user is leader
    const currentUserMember = memberData?.find(m => m.user_id === user.id);
    const userIsLeader = currentUserMember?.role === 'leader' || currentUserMember?.is_leader || team.created_by === user.id;
    setIsLeader(userIsLeader);

    if (!userIsLeader) {
      toast.error('Only team leaders can manage the team');
      navigate('/teams');
      return;
    }

    // Fetch profiles for members
    if (memberData && memberData.length > 0) {
      const userIds = memberData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', userIds);

      const membersWithProfiles = memberData.map(m => ({
        ...m,
        profile: profiles?.find(p => p.user_id === m.user_id) || { username: 'Unknown', userid: 'unknown' }
      }));

      setMembers(membersWithProfiles);
    }

    setLoading(false);
  };

  // Sanitize ILIKE query
  const sanitizeILikeQuery = (query: string): string => {
    return query.replace(/[%_\\]/g, '\\$&');
  };

  const searchUsers = async () => {
    if (searchQuery.length < 2 || !user) return;
    if (searchQuery.length > 50) {
      toast.error('Search query too long');
      return;
    }
    setSearching(true);

    const sanitized = sanitizeILikeQuery(searchQuery);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, username, userid')
      .or(`userid.ilike.%${sanitized}%,username.ilike.%${sanitized}%`)
      .limit(10);

    if (error) {
      toast.error('Error searching users');
    } else {
      // Filter out existing members
      const existingUserIds = members.map(m => m.user_id);
      const filtered = data?.filter(u => !existingUserIds.includes(u.user_id)) || [];
      setSearchResults(filtered);
    }
    setSearching(false);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, members]);

  const inviteMember = async (member: SearchResult) => {
    if (!user || !teamId) return;

    try {
      // Check if request already exists for this user and team
      const { data: existingRequest } = await supabase
        .from('team_requests')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('to_user_id', member.user_id)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast.error(`Invitation already pending for @${member.userid}`);
          return;
        }
        // Update existing request back to pending
        const { error } = await supabase
          .from('team_requests')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', existingRequest.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_requests')
          .insert({
            team_id: teamId,
            from_user_id: user.id,
            to_user_id: member.user_id,
            status: 'pending',
          });

        if (error) throw error;
      }

      toast.success(`Invitation sent to @${member.userid}`);
      setSearchResults(prev => prev.filter(r => r.user_id !== member.user_id));
      setSearchQuery('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    }
  };

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (!user || memberUserId === user.id) {
      toast.error("You can't remove yourself");
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed from team');
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/teams')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Button>

        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Manage Team</h1>
              <p className="text-muted-foreground text-sm">{teamName}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Current Members */}
            <div className="space-y-2">
              <Label>Team Members ({members.length})</Label>
              <div className="space-y-2">
                {members.map((member) => {
                  const isMemberLeader = member.role === 'leader' || member.is_leader;
                  const isCurrentUser = member.user_id === user?.id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {member.profile.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.profile.username}</p>
                            {isMemberLeader && (
                              <Badge variant="outline" className="gap-1">
                                <Crown className="h-3 w-3" />
                                Leader
                              </Badge>
                            )}
                            {isCurrentUser && (
                              <Badge variant="secondary">You</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">@{member.profile.userid}</p>
                        </div>
                      </div>

                      {!isMemberLeader && !isCurrentUser && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMember(member.id, member.user_id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invite New Members */}
            <div className="space-y-2">
              <Label>Invite New Members</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by user ID or username..."
                  className="pl-9 input-dark"
                />
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border border-border rounded-lg divide-y divide-border bg-card">
                  {searchResults.map((result) => (
                    <div
                      key={result.user_id}
                      className="flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {result.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{result.username}</p>
                          <p className="text-xs text-muted-foreground">@{result.userid}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => inviteMember(result)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {searching && (
                <p className="text-sm text-muted-foreground">Searching...</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeamManage;