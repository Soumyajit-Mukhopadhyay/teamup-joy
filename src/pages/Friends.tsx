import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, UserPlus, MessageCircle, X, Check, User, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isValidUUID } from '@/lib/validation';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  userid: string;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_profile?: Profile;
  to_profile?: Profile;
}

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  profile?: Profile;
}

const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;
    
    // Validate UUID to prevent injection
    if (!isValidUUID(user.id)) {
      toast.error('Invalid user session');
      return;
    }

    // Fetch friends where user is either user_id or friend_id
    const { data: friendsData } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    // Get friend profiles
    if (friendsData && friendsData.length > 0) {
      const friendUserIds = friendsData.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', friendUserIds);

      const friendsWithProfiles = friendsData.map(f => ({
        ...f,
        profile: profiles?.find(p => p.user_id === (f.user_id === user.id ? f.friend_id : f.user_id))
      }));
      setFriends(friendsWithProfiles);
    }

    // Fetch incoming friend requests
    const { data: incomingRequests } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    if (incomingRequests && incomingRequests.length > 0) {
      const fromUserIds = incomingRequests.map(r => r.from_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', fromUserIds);

      const requestsWithProfiles = incomingRequests.map(r => ({
        ...r,
        from_profile: profiles?.find(p => p.user_id === r.from_user_id)
      }));
      setRequests(requestsWithProfiles);
    }

    // Fetch sent requests
    const { data: outgoingRequests } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('from_user_id', user.id)
      .eq('status', 'pending');

    if (outgoingRequests && outgoingRequests.length > 0) {
      const toUserIds = outgoingRequests.map(r => r.to_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', toUserIds);

      const sentWithProfiles = outgoingRequests.map(r => ({
        ...r,
        to_profile: profiles?.find(p => p.user_id === r.to_user_id)
      }));
      setSentRequests(sentWithProfiles);
    }

    setLoading(false);
  };

  // Sanitize ILIKE query to prevent wildcard injection
  const sanitizeILikeQuery = (query: string): string => {
    return query.replace(/[%_\\]/g, '\\$&');
  };

  const searchUsers = async () => {
    if (searchQuery.length < 2) return;
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
      .neq('user_id', user?.id)
      .limit(10);

    if (error) {
      toast.error('Error searching users');
    } else {
      // Filter out existing friends and pending requests
      const friendIds = friends.map(f => f.profile?.user_id);
      const pendingIds = [...requests.map(r => r.from_user_id), ...sentRequests.map(r => r.to_user_id)];
      const filtered = data?.filter(u => !friendIds.includes(u.user_id) && !pendingIds.includes(u.user_id)) || [];
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
  }, [searchQuery]);

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: user.id,
        to_user_id: toUserId,
      });

    if (error) {
      toast.error('Failed to send friend request');
    } else {
      toast.success('Friend request sent!');
      setSearchQuery('');
      setSearchResults([]);
      fetchData();
    }
  };

  const handleRequest = async (requestId: string, accept: boolean, fromUserId: string) => {
    if (!user) return;

    if (accept) {
      // Add to friends table
      const { error: friendError } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: fromUserId,
        });

      if (friendError) {
        toast.error('Failed to accept request');
        return;
      }
    }

    // Update request status
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(accept ? 'Friend added!' : 'Request declined');
      fetchData();
    }
  };

  const cancelRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to cancel request');
    } else {
      toast.success('Request cancelled');
      fetchData();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="container py-8 max-w-4xl flex-1">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Friends</h1>
            <p className="text-muted-foreground text-sm">Connect with other hackers</p>
          </div>
        </div>

        {/* Search Users */}
        <div className="glass-card p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or user ID..."
              className="pl-9 input-dark"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border bg-card mt-3">
              {searchResults.map((result) => (
                <div key={result.user_id} className="flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors">
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
                  <Button size="sm" variant="ghost" onClick={() => sendFriendRequest(result.user_id)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {searching && <p className="text-sm text-muted-foreground mt-2">Searching...</p>}
        </div>

        <Tabs defaultValue="friends">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="requests">
              Requests {requests.length > 0 && <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 rounded-full">{requests.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="sent">Sent ({sentRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            {friends.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No friends yet. Search for users to add!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {friend.profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{friend.profile?.username}</p>
                        <p className="text-xs text-muted-foreground">@{friend.profile?.userid}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => navigate(`/chat/${friend.profile?.user_id}`)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => navigate(`/user/${friend.profile?.userid}`)}
                      >
                        <User className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm(`Remove ${friend.profile?.username} from friends?`)) return;
                          await supabase.from('friends').delete().eq('id', friend.id);
                          // Also delete reciprocal friendship
                          await supabase.from('friends').delete()
                            .eq('user_id', friend.profile?.user_id)
                            .eq('friend_id', user?.id);
                          toast.success('Friend removed');
                          fetchData();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {requests.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No pending friend requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {request.from_profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.from_profile?.username}</p>
                        <p className="text-xs text-muted-foreground">@{request.from_profile?.userid}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" onClick={() => handleRequest(request.id, true, request.from_user_id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRequest(request.id, false, request.from_user_id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {sentRequests.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No sent requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentRequests.map((request) => (
                  <div key={request.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {request.to_profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.to_profile?.username}</p>
                        <p className="text-xs text-muted-foreground">@{request.to_profile?.userid}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => cancelRequest(request.id)}>
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Friends;
