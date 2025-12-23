import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Users, Calendar, MessageCircle, Clock, Search as SearchIcon, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, parseISO, isAfter } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  hackathon_name?: string;
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
  endDate: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [hackathonMap, setHackathonMap] = useState<Record<string, HackathonInfo>>({});
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState<Participation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch hackathon info for a list of hackathon IDs
  const fetchHackathonInfo = useCallback(async (hackathonIds: string[]) => {
    if (hackathonIds.length === 0) return {};

    const uniqueIds = [...new Set(hackathonIds)];
    const infoMap: Record<string, HackathonInfo> = {};

    // Try to fetch by slug first
    const { data: bySlug } = await supabase
      .from('hackathons')
      .select('id, slug, name, location, end_date')
      .in('slug', uniqueIds);

    if (bySlug) {
      bySlug.forEach(h => {
        infoMap[h.slug] = {
          slug: h.slug,
          name: h.name,
          location: h.location,
          endDate: h.end_date,
        };
      });
    }

    // For any not found by slug, try by id
    const foundSlugs = new Set(Object.keys(infoMap));
    const notFoundIds = uniqueIds.filter(id => !foundSlugs.has(id));

    if (notFoundIds.length > 0) {
      const { data: byId } = await supabase
        .from('hackathons')
        .select('id, slug, name, location, end_date')
        .in('id', notFoundIds);

      if (byId) {
        byId.forEach(h => {
          infoMap[h.id] = {
            slug: h.slug || h.id,
            name: h.name,
            location: h.location,
            endDate: h.end_date,
          };
        });
      }
    }

    return infoMap;
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;

    const hackathonIds: string[] = [];

    // Fetch teams
    const { data: memberData } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    let teamsData: Team[] = [];
    if (memberData && memberData.length > 0) {
      const teamIds = memberData.map(m => m.team_id);
      const { data: fetchedTeams } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false });

      if (fetchedTeams) {
        teamsData = await Promise.all(
          fetchedTeams.map(async (team) => {
            const { count } = await supabase
              .from('team_members')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id);
            hackathonIds.push(team.hackathon_id);
            return { ...team, member_count: count || 0 };
          })
        );
      }
    }

    // Fetch participations
    const { data: participationData } = await supabase
      .from('hackathon_participations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (participationData) {
      participationData.forEach(p => hackathonIds.push(p.hackathon_id));
    }

    // Fetch hackathon info
    const infoMap = await fetchHackathonInfo(hackathonIds);
    setHackathonMap(infoMap);

    // Add hackathon names to teams
    const teamsWithNames = teamsData.map(team => ({
      ...team,
      hackathon_name: infoMap[team.hackathon_id]?.name || team.hackathon_id,
    }));

    setTeams(teamsWithNames);
    setParticipations(participationData || []);
    setLoading(false);
  };

  const getHackathonName = (hackathonId: string) => {
    return hackathonMap[hackathonId]?.name || hackathonId;
  };

  const getHackathonInfo = (hackathonId: string) => {
    return hackathonMap[hackathonId];
  };

  const isHackathonOngoing = (hackathonId: string) => {
    const info = getHackathonInfo(hackathonId);
    if (!info) return false;
    const endDate = parseISO(info.endDate);
    return isAfter(endDate, new Date());
  };

  const hasTeamsForHackathon = (hackathonId: string) => {
    return teams.some(t => t.hackathon_id === hackathonId);
  };

  const handleDeleteClick = (participation: Participation) => {
    const ongoing = isHackathonOngoing(participation.hackathon_id);
    const hasTeams = hasTeamsForHackathon(participation.hackathon_id);

    if (ongoing && hasTeams) {
      toast.error('For ongoing hackathons, you must leave all teams first before removing it from your profile.');
      return;
    }

    setSelectedParticipation(participation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteParticipation = async () => {
    if (!selectedParticipation || !user) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from('hackathon_participations')
        .delete()
        .eq('id', selectedParticipation.id);

      if (error) throw error;

      toast.success('Hackathon removed from your profile');
      setParticipations(prev => prev.filter(p => p.id !== selectedParticipation.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove hackathon');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedParticipation(null);
    }
  };

  const currentParticipations = participations.filter(p => p.status === 'current' || p.status === 'looking_for_team');
  const pastParticipations = participations.filter(p => p.status === 'past');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <AppSidebar />

      <main className="container py-8 max-w-4xl flex-1 md:ml-64">
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
                        <p className="text-sm text-muted-foreground">{team.hackathon_name}</p>
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
                  const info = getHackathonInfo(p.hackathon_id);
                  const ongoing = isHackathonOngoing(p.hackathon_id);
                  const hasTeams = hasTeamsForHackathon(p.hackathon_id);
                  
                  return (
                    <div key={p.id} className="glass-card p-5 card-hover relative">
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(p);
                        }}
                        className="absolute top-3 right-3 p-1 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title={ongoing && hasTeams ? "Leave teams first" : "Remove from profile"}
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div 
                        className="flex items-center justify-between cursor-pointer pr-6" 
                        onClick={() => navigate(`/hackathon/${info?.slug || p.hackathon_id}`)}
                      >
                        <div>
                          <h3 className="font-semibold">{info?.name || p.hackathon_id}</h3>
                          <p className="text-sm text-muted-foreground">{info?.location}</p>
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
                  const info = getHackathonInfo(p.hackathon_id);
                  return (
                    <div key={p.id} className="glass-card p-5 card-hover relative">
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(p);
                        }}
                        className="absolute top-3 right-3 p-1 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove from profile"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="pr-6">
                        <h3 className="font-semibold">{info?.name || p.hackathon_id}</h3>
                        <p className="text-sm text-muted-foreground">{info?.location}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Participation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Hackathon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this hackathon from your profile? 
              This will remove it from your participation list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteParticipation} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Footer />
    </div>
  );
};

export default Profile;
