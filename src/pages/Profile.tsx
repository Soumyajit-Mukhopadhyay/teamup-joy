import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Users, Calendar, MessageCircle, Clock, Search as SearchIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { hackathons } from '@/data/hackathons';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  created_by: string;
  created_at: string;
  member_count?: number;
}

interface Participation {
  id: string;
  hackathon_id: string;
  status: string;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
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

    // Fetch teams
    const { data: memberData } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (memberData && memberData.length > 0) {
      const teamIds = memberData.map(m => m.team_id);
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false });

      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);
          return { ...team, member_count: count || 0 };
        })
      );
      setTeams(teamsWithCounts);
    }

    // Fetch participations
    const { data: participationData } = await supabase
      .from('hackathon_participations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setParticipations(participationData || []);
    setLoading(false);
  };

  const getHackathonName = (hackathonId: string) => {
    const hackathon = hackathons.find(h => h.id === hackathonId);
    return hackathon?.name || 'Unknown Hackathon';
  };

  const getHackathon = (hackathonId: string) => {
    return hackathons.find(h => h.id === hackathonId);
  };

  const currentParticipations = participations.filter(p => p.status === 'current' || p.status === 'looking_for_team');
  const pastParticipations = participations.filter(p => p.status === 'past');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-4xl">
        {/* Profile Header */}
        <div className="glass-card p-6 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile?.username}</h1>
              <p className="text-muted-foreground">@{profile?.userid}</p>
              <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="teams" className="animate-fade-in">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              My Teams
            </TabsTrigger>
            <TabsTrigger value="current" className="gap-2">
              <Calendar className="h-4 w-4" />
              Current Hackathons
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <Clock className="h-4 w-4" />
              Past Hackathons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">Loading...</div>
            ) : teams.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-2">You haven't joined any teams yet</p>
                <Button onClick={() => navigate('/')} className="btn-gradient mt-4">
                  Browse Hackathons
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {teams.map((team) => (
                  <div key={team.id} className="glass-card p-5 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{team.name}</h3>
                        <p className="text-sm text-muted-foreground">{getHackathonName(team.hackathon_id)}</p>
                      </div>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {team.member_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <Calendar className="h-3 w-3" />
                      <span>Created {format(new Date(team.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <Link to={`/team/${team.id}/chat`}>
                      <Button variant="secondary" className="w-full gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Team Chat
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="current">
            {currentParticipations.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No current hackathon participations</p>
                <Button onClick={() => navigate('/')} className="btn-gradient mt-4">
                  Find Hackathons
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {currentParticipations.map((p) => {
                  const hackathon = getHackathon(p.hackathon_id);
                  return (
                    <div key={p.id} className="glass-card p-5 card-hover" onClick={() => navigate(`/hackathon/${p.hackathon_id}`)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{hackathon?.name || p.hackathon_id}</h3>
                          <p className="text-sm text-muted-foreground">{hackathon?.location}</p>
                        </div>
                        {p.status === 'looking_for_team' && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                            <SearchIcon className="h-3 w-3" />
                            Looking for team
                          </span>
                        )}
                      </div>
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
                  const hackathon = getHackathon(p.hackathon_id);
                  return (
                    <div key={p.id} className="glass-card p-5 card-hover">
                      <h3 className="font-semibold">{hackathon?.name || p.hackathon_id}</h3>
                      <p className="text-sm text-muted-foreground">{hackathon?.location}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;
