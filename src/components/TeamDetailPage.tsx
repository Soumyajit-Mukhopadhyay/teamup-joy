import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, UserPlus, ArrowLeft, MessageCircle, Check, Clock, Crown } from 'lucide-react';

interface TeamMember {
  user_id: string;
  username: string;
  userid: string;
  is_leader: boolean;
  isFriend: boolean;
  requestSent: boolean;
}

interface TeamDetails {
  id: string;
  name: string;
  hackathon_id: string;
  hackathon_name: string;
  looking_for_teammates: boolean;
  looking_visibility: string;
  created_at: string;
  leader_id: string;
}

const TeamDetailPage = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [hasRequestedJoin, setHasRequestedJoin] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails();
    }
  }, [teamId, user]);

  const fetchTeamDetails = async () => {
    if (!teamId) return;

    try {
      // Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError || !teamData) {
        toast.error('Team not found');
        navigate(-1);
        return;
      }

      // Fetch hackathon name
      let hackathonName = teamData.hackathon_id;
      const { data: hackathonData } = await supabase
        .from('hackathons')
        .select('name')
        .or(`slug.eq.${teamData.hackathon_id},id.eq.${teamData.hackathon_id}`)
        .single();
      
      if (hackathonData) {
        hackathonName = hackathonData.name;
      }

      // Fetch team members
      const { data: membersData } = await supabase
        .from('team_members')
        .select('user_id, is_leader, role')
        .eq('team_id', teamId);

      if (!membersData) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Check if current user is a member
      const currentUserIsMember = user ? membersData.some(m => m.user_id === user.id) : false;
      setIsMember(currentUserIsMember);

      // Fetch profiles for members
      const memberIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', memberIds);

      // Check friend status for each member
      let friendIds = new Set<string>();
      let sentRequestIds = new Set<string>();

      if (user) {
        const { data: friendsData } = await supabase
          .from('friends')
          .select('friend_id, user_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (friendsData) {
          friendsData.forEach(f => {
            friendIds.add(f.user_id === user.id ? f.friend_id : f.user_id);
          });
        }

        // Check pending friend requests sent by user
        const { data: pendingRequests } = await supabase
          .from('friend_requests')
          .select('to_user_id')
          .eq('from_user_id', user.id)
          .eq('status', 'pending');

        if (pendingRequests) {
          pendingRequests.forEach(r => sentRequestIds.add(r.to_user_id));
        }

        // Check if user has already requested to join
        const { data: joinRequest } = await supabase
          .from('team_requests')
          .select('id')
          .eq('team_id', teamId)
          .eq('from_user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        setHasRequestedJoin(!!joinRequest);
      }

      const enrichedMembers: TeamMember[] = membersData.map(m => {
        const profile = profiles?.find(p => p.user_id === m.user_id);
        const isLeader = m.is_leader || m.role === 'leader';
        
        return {
          user_id: m.user_id,
          username: profile?.username || 'Unknown',
          userid: profile?.userid || '',
          is_leader: isLeader,
          isFriend: friendIds.has(m.user_id),
          requestSent: sentRequestIds.has(m.user_id),
        };
      });

      // Sort: leader first
      enrichedMembers.sort((a, b) => {
        if (a.is_leader && !b.is_leader) return -1;
        if (!a.is_leader && b.is_leader) return 1;
        return 0;
      });

      const leader = enrichedMembers.find(m => m.is_leader);

      setTeam({
        id: teamData.id,
        name: teamData.name,
        hackathon_id: teamData.hackathon_id,
        hackathon_name: hackathonName,
        looking_for_teammates: teamData.looking_for_teammates,
        looking_visibility: teamData.looking_visibility,
        created_at: teamData.created_at,
        leader_id: leader?.user_id || teamData.created_by,
      });
      setMembers(enrichedMembers);
    } catch (error) {
      console.error('Error fetching team details:', error);
      toast.error('Failed to load team details');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    setSendingRequest(targetUserId);

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: targetUserId,
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      setMembers(prev => prev.map(m =>
        m.user_id === targetUserId ? { ...m, requestSent: true } : m
      ));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const handleRequestToJoin = async () => {
    if (!user || !team) {
      toast.error('Please sign in first');
      return;
    }

    setJoiningTeam(true);

    try {
      const { error } = await supabase
        .from('team_requests')
        .insert({
          team_id: team.id,
          from_user_id: user.id,
          to_user_id: team.leader_id,
          status: 'pending',
        });

      if (error) throw error;

      toast.success(`Request sent to join "${team.name}"`);
      setHasRequestedJoin(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setJoiningTeam(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center text-muted-foreground">Loading...</div>
        <Footer />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center text-muted-foreground">Team not found</div>
        <Footer />
      </div>
    );
  }

  const canJoin = team.looking_for_teammates && !isMember && user && user.id !== team.leader_id;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="container py-8 max-w-2xl flex-1">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Team Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{team.name}</h1>
              <p className="text-muted-foreground">{team.hackathon_name}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Badge>
                {team.looking_for_teammates && (
                  <Badge className="gap-1 bg-primary/20 text-primary">
                    <UserPlus className="h-3 w-3" />
                    Looking for teammates
                  </Badge>
                )}
              </div>
            </div>

            {canJoin && (
              <Button
                onClick={handleRequestToJoin}
                disabled={joiningTeam || hasRequestedJoin}
                className="gap-2"
              >
                {hasRequestedJoin ? (
                  <>
                    <Clock className="h-4 w-4" />
                    Requested
                  </>
                ) : joiningTeam ? (
                  'Sending...'
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Request to Join
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members
          </h2>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {members.map((member) => {
                const isCurrentUser = user?.id === member.user_id;
                const showFriendButton = !isCurrentUser && user && !member.isFriend && !member.requestSent;

                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg"
                  >
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/user/${member.userid}`)}
                    >
                      <Avatar>
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {member.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.username}</p>
                          {member.is_leader && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">@{member.userid}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.isFriend && !isCurrentUser && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/chat/${member.user_id}`)}
                          className="gap-1"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Message
                        </Button>
                      )}
                      
                      {member.requestSent && !isCurrentUser && (
                        <Button size="sm" variant="outline" disabled>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Button>
                      )}
                      
                      {showFriendButton && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendFriendRequest(member.user_id)}
                          disabled={sendingRequest === member.user_id}
                          className="gap-1"
                        >
                          <UserPlus className="h-3 w-3" />
                          {sendingRequest === member.user_id ? 'Sending...' : 'Add Friend'}
                        </Button>
                      )}

                      {member.isFriend && !isCurrentUser && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" />
                          Friend
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TeamDetailPage;
