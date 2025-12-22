import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Users, Clock, Bell, UserPlus, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TeamRequest {
  id: string;
  team_id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  team: {
    id: string;
    name: string;
    hackathon_id: string;
  };
  from_profile: {
    username: string;
    userid: string;
  };
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_profile?: {
    username: string;
    userid: string;
  };
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchAllNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAllNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const fetchAllNotifications = async () => {
    if (!user) return;

    // Fetch team requests
    const { data: teamData } = await supabase
      .from('team_requests')
      .select(`*, team:teams(id, name, hackathon_id)`)
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (teamData && teamData.length > 0) {
      const fromUserIds = teamData.map(r => r.from_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', fromUserIds);

      const requestsWithProfiles = teamData.map(req => ({
        ...req,
        from_profile: profiles?.find(p => p.user_id === req.from_user_id) || { username: 'Unknown', userid: 'unknown' }
      }));

      setTeamRequests(requestsWithProfiles as TeamRequest[]);
    } else {
      setTeamRequests([]);
    }

    // Fetch friend requests
    const { data: friendData } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (friendData && friendData.length > 0) {
      const fromUserIds = friendData.map(r => r.from_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', fromUserIds);

      const requestsWithProfiles = friendData.map(req => ({
        ...req,
        from_profile: profiles?.find(p => p.user_id === req.from_user_id)
      }));

      setFriendRequests(requestsWithProfiles);
    } else {
      setFriendRequests([]);
    }

    // Fetch general notifications
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications(notifData || []);
    setLoading(false);
  };

  const handleAcceptTeam = async (request: TeamRequest) => {
    try {
      await supabase.from('team_requests').update({ status: 'accepted' }).eq('id', request.id);
      await supabase.from('team_members').insert({
        team_id: request.team_id,
        user_id: user!.id,
        role: 'member',
      });

      if (request.team?.hackathon_id) {
        const { data: existing } = await supabase
          .from('hackathon_participations')
          .select('id')
          .eq('user_id', user!.id)
          .eq('hackathon_id', request.team.hackathon_id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('hackathon_participations').insert({
            user_id: user!.id,
            hackathon_id: request.team.hackathon_id,
            status: 'current',
          });
        }
      }

      toast.success('You joined the team!');
      setTeamRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleDeclineTeam = async (requestId: string) => {
    try {
      await supabase.from('team_requests').update({ status: 'declined' }).eq('id', requestId);
      toast.success('Request declined');
      setTeamRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline request');
    }
  };

  const handleAcceptFriend = async (request: FriendRequest) => {
    try {
      await supabase.from('friends').insert({ user_id: user!.id, friend_id: request.from_user_id });
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id);
      toast.success('Friend added!');
      setFriendRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleDeclineFriend = async (requestId: string) => {
    try {
      await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
      toast.success('Request declined');
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline request');
    }
  };

  const markNotificationRead = async (notifId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
  };

  const deleteNotification = async (notifId: string) => {
    await supabase.from('notifications').delete().eq('id', notifId);
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const totalPending = teamRequests.length + friendRequests.length + notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground text-sm">
              {totalPending > 0 ? `${totalPending} pending` : 'All caught up!'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading...</div>
        ) : (
          <Tabs defaultValue="team" className="w-full">
            <TabsList className="w-full justify-start mb-6">
              <TabsTrigger value="team" className="relative">
                Team Invites
                {teamRequests.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {teamRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="friend" className="relative">
                Friend Requests
                {friendRequests.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {friendRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="general" className="relative">
                Updates
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team">
              {teamRequests.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No pending team invitations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamRequests.map((request) => (
                    <div key={request.id} className="glass-card p-4 animate-fade-in">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {request.from_profile.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              <span className="text-primary">@{request.from_profile.userid}</span>
                              {' invited you to join'}
                            </p>
                            <p className="text-lg font-semibold">{request.team?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineTeam(request.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleAcceptTeam(request)} className="btn-gradient">
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friend">
              {friendRequests.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {friendRequests.map((request) => (
                    <div key={request.id} className="glass-card p-4 animate-fade-in">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {request.from_profile?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              <span className="text-primary">@{request.from_profile?.userid}</span>
                              {' wants to be your friend'}
                            </p>
                            <p className="text-sm">{request.from_profile?.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineFriend(request.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleAcceptFriend(request)} className="btn-gradient">
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="general">
              {notifications.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`glass-card p-4 animate-fade-in ${!notif.is_read ? 'border-l-4 border-l-primary' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0" onClick={() => markNotificationRead(notif.id)}>
                          <p className="font-medium truncate">{notif.title}</p>
                          {notif.message && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notif.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNotification(notif.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Notifications;
