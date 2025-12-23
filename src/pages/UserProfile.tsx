import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, Clock, UserPlus, MessageCircle, Search, Check, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isValidUUID } from '@/lib/validation';
import ProfileLookingForTeammatesSection from '@/components/ProfileLookingForTeammatesSection';

interface Profile {
  user_id: string;
  username: string;
  userid: string;
  avatar_url: string | null;
}

interface Participation {
  id: string;
  hackathon_id: string;
  status: string;
  created_at: string;
}

interface HackathonInfo {
  slug: string;
  name: string;
  location: string;
}

const UserProfile = () => {
  const { userid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [hackathonMap, setHackathonMap] = useState<Record<string, HackathonInfo>>({});
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestPending, setRequestPending] = useState(false);

  // Fetch hackathon info for a list of hackathon IDs
  const fetchHackathonInfo = useCallback(async (hackathonIds: string[]) => {
    if (hackathonIds.length === 0) return {};

    const uniqueIds = [...new Set(hackathonIds)];
    const infoMap: Record<string, HackathonInfo> = {};

    // Try to fetch by slug first
    const { data: bySlug } = await supabase
      .from('hackathons')
      .select('id, slug, name, location')
      .in('slug', uniqueIds);

    if (bySlug) {
      bySlug.forEach(h => {
        infoMap[h.slug] = {
          slug: h.slug,
          name: h.name,
          location: h.location,
        };
      });
    }

    // For any not found by slug, try by id
    const foundSlugs = new Set(Object.keys(infoMap));
    const notFoundIds = uniqueIds.filter(id => !foundSlugs.has(id));

    if (notFoundIds.length > 0) {
      const { data: byId } = await supabase
        .from('hackathons')
        .select('id, slug, name, location')
        .in('id', notFoundIds);

      if (byId) {
        byId.forEach(h => {
          infoMap[h.id] = {
            slug: h.slug || h.id,
            name: h.name,
            location: h.location,
          };
        });
      }
    }

    return infoMap;
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [userid]);

  const fetchProfile = async () => {
    if (!userid) return;

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('user_id, username, userid, avatar_url')
      .eq('userid', userid)
      .single();

    if (error || !profileData) {
      toast.error('User not found');
      navigate('/');
      return;
    }

    setProfile(profileData);

    // Fetch participations
    const { data: participationData } = await supabase
      .from('hackathon_participations')
      .select('*')
      .eq('user_id', profileData.user_id)
      .order('created_at', { ascending: false });

    setParticipations(participationData || []);

    // Fetch hackathon info
    if (participationData && participationData.length > 0) {
      const hackathonIds = participationData.map(p => p.hackathon_id);
      const infoMap = await fetchHackathonInfo(hackathonIds);
      setHackathonMap(infoMap);
    }

    // Check friend status
    if (user && user.id !== profileData.user_id) {
      // Validate UUIDs to prevent injection
      if (!isValidUUID(user.id) || !isValidUUID(profileData.user_id)) {
        toast.error('Invalid user ID');
        return;
      }
      
      const { data: friendData } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${profileData.user_id}),and(user_id.eq.${profileData.user_id},friend_id.eq.${user.id})`)
        .single();

      setIsFriend(!!friendData);

      if (!friendData) {
        // Check if request sent
        const { data: sentRequest } = await supabase
          .from('friend_requests')
          .select('*')
          .eq('from_user_id', user.id)
          .eq('to_user_id', profileData.user_id)
          .eq('status', 'pending')
          .single();

        setRequestSent(!!sentRequest);

        // Check if request pending from them
        const { data: pendingRequest } = await supabase
          .from('friend_requests')
          .select('*')
          .eq('from_user_id', profileData.user_id)
          .eq('to_user_id', user.id)
          .eq('status', 'pending')
          .single();

        setRequestPending(!!pendingRequest);
      }
    }

    setLoading(false);
  };

  const sendFriendRequest = async () => {
    if (!user || !profile) return;

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: user.id,
        to_user_id: profile.user_id,
      });

    if (error) {
      toast.error('Failed to send friend request');
    } else {
      toast.success('Friend request sent!');
      setRequestSent(true);
    }
  };

  const getHackathonInfo = (hackathonId: string) => {
    return hackathonMap[hackathonId];
  };

  const currentParticipations = participations.filter(p => p.status === 'current' || p.status === 'looking_for_team');
  const pastParticipations = participations.filter(p => p.status === 'past');
  const lookingForTeam = participations.filter(p => p.status === 'looking_for_team');

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="container py-16 text-center text-muted-foreground">Loading...</div>
      </AuthenticatedLayout>
    );
  }

  if (!profile) {
    return (
      <AuthenticatedLayout>
        <div className="container py-16 text-center text-muted-foreground">User not found</div>
      </AuthenticatedLayout>
    );
  }

  const isOwnProfile = user?.id === profile.user_id;

  return (
    <AuthenticatedLayout>
      <div className="container py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="glass-card p-6 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              <p className="text-muted-foreground">@{profile.userid}</p>
              
              {lookingForTeam.length > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  <Search className="h-3 w-3" />
                  Looking for teammates
                </div>
              )}
            </div>

            {!isOwnProfile && user && (
              <div className="flex gap-2">
                {isFriend ? (
                  <>
                    <Button variant="secondary" onClick={() => navigate(`/chat/${profile.user_id}`)}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                    <span className="flex items-center gap-1 text-sm text-success">
                      <Check className="h-4 w-4" />
                      Friends
                    </span>
                  </>
                ) : requestSent ? (
                  <Button variant="secondary" disabled>
                    Request Sent
                  </Button>
                ) : requestPending ? (
                  <Button onClick={() => navigate('/friends')}>
                    Accept Request
                  </Button>
                ) : (
                  <Button onClick={sendFriendRequest}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Friend
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Looking for Teammates Section - Only show on own profile */}
        {isOwnProfile && (
          <div className="mb-8">
            <ProfileLookingForTeammatesSection 
              targetUserId={profile.user_id} 
              isOwnProfile={isOwnProfile} 
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="current" className="animate-fade-in">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="current" className="gap-2">
              <Calendar className="h-4 w-4" />
              Current ({currentParticipations.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <Clock className="h-4 w-4" />
              Past ({pastParticipations.length})
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="looking" className="gap-2">
                <Search className="h-4 w-4" />
                Looking for Team ({lookingForTeam.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="current">
            {currentParticipations.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No current hackathon participations</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {currentParticipations.map((p) => {
                  const info = getHackathonInfo(p.hackathon_id);
                  return (
                    <div key={p.id} className="glass-card p-5 card-hover cursor-pointer" onClick={() => navigate(`/hackathon/${info?.slug || p.hackathon_id}`)}>
                      <h3 className="font-semibold">{info?.name || p.hackathon_id}</h3>
                      <p className="text-sm text-muted-foreground">{info?.location}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastParticipations.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No past hackathon participations</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pastParticipations.map((p) => {
                  const info = getHackathonInfo(p.hackathon_id);
                  return (
                    <div key={p.id} className="glass-card p-5">
                      <h3 className="font-semibold">{info?.name || p.hackathon_id}</h3>
                      <p className="text-sm text-muted-foreground">{info?.location}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="looking">
              {lookingForTeam.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Not looking for any teams currently</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {lookingForTeam.map((p) => {
                    const info = getHackathonInfo(p.hackathon_id);
                    return (
                      <div key={p.id} className="glass-card p-5 card-hover cursor-pointer" onClick={() => navigate(`/hackathon/${info?.slug || p.hackathon_id}`)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{info?.name || p.hackathon_id}</h3>
                            <p className="text-sm text-muted-foreground">{info?.location}</p>
                          </div>
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            Looking for team
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
};

export default UserProfile;
