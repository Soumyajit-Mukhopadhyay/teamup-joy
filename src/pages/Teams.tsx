import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, MessageCircle, Calendar, Settings, X } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAIActionRefresh } from '@/hooks/useAIActionRefresh';
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
  is_leader?: boolean;
  hackathon_name?: string;
}

interface HackathonInfo {
  slug: string;
  name: string;
  endDate: string;
}

const Teams = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [hackathonMap, setHackathonMap] = useState<Record<string, HackathonInfo>>({});
  const [loading, setLoading] = useState(true);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);

  // Fetch hackathon info for a list of hackathon IDs
  const fetchHackathonInfo = useCallback(async (hackathonIds: string[]) => {
    if (hackathonIds.length === 0) return {};

    const uniqueIds = [...new Set(hackathonIds)];
    const infoMap: Record<string, HackathonInfo> = {};

    // Try to fetch by slug first
    const { data: bySlug } = await supabase
      .from('hackathons')
      .select('id, slug, name, end_date')
      .in('slug', uniqueIds);

    if (bySlug) {
      bySlug.forEach(h => {
        infoMap[h.slug] = {
          slug: h.slug,
          name: h.name,
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
        .select('id, slug, name, end_date')
        .in('id', notFoundIds);

      if (byId) {
        byId.forEach(h => {
          infoMap[h.id] = {
            slug: h.slug || h.id,
            name: h.name,
            endDate: h.end_date,
          };
        });
      }
    }

    return infoMap;
  }, []);

  // Listen for AI actions that affect teams
  useAIActionRefresh({
    actions: ['leave_team', 'delete_team', 'create_team', 'accept_team_request', 'set_looking_for_teammates'],
    onAction: () => {
      fetchTeams();
    },
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchTeams();
  }, [user, authLoading]);

  const fetchTeams = async () => {
    if (!user) return;

    const { data: memberData, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, role, is_leader')
      .eq('user_id', user.id);

    if (memberError) {
      toast.error('Failed to load teams');
      setLoading(false);
      return;
    }

    if (!memberData || memberData.length === 0) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const teamIds = memberData.map(m => m.team_id);

    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .order('created_at', { ascending: false });

    if (teamsError) {
      toast.error('Failed to load team details');
      setLoading(false);
      return;
    }

    // Collect hackathon IDs
    const hackathonIds = teamsData?.map(t => t.hackathon_id) || [];
    const infoMap = await fetchHackathonInfo(hackathonIds);
    setHackathonMap(infoMap);

    const teamsWithCounts = await Promise.all(
      (teamsData || []).map(async (team) => {
        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        const memberInfo = memberData.find(m => m.team_id === team.id);
        const isLeader = memberInfo?.role === 'leader' || memberInfo?.is_leader || team.created_by === user.id;
        
        return { 
          ...team, 
          member_count: count || 0, 
          is_leader: isLeader,
          hackathon_name: infoMap[team.hackathon_id]?.name || team.hackathon_id,
        };
      })
    );

    setTeams(teamsWithCounts);
    setLoading(false);
  };

  const getHackathonName = (hackathonId: string) => {
    return hackathonMap[hackathonId]?.name || hackathonId;
  };

  const isHackathonOngoing = (hackathonId: string) => {
    const info = hackathonMap[hackathonId];
    if (!info) return false;
    const endDate = parseISO(info.endDate);
    return isAfter(endDate, new Date());
  };

  const handleLeaveClick = (team: Team) => {
    setSelectedTeam(team);
    setLeaveDialogOpen(true);
  };

  const handleLeaveTeam = async () => {
    if (!selectedTeam || !user) return;

    setLeavingTeam(true);

    try {
      // Remove from team_members
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', selectedTeam.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Also remove hackathon participation if no more teams in that hackathon
      const remainingTeams = teams.filter(
        t => t.id !== selectedTeam.id && t.hackathon_id === selectedTeam.hackathon_id
      );

      if (remainingTeams.length === 0) {
        await supabase
          .from('hackathon_participations')
          .delete()
          .eq('user_id', user.id)
          .eq('hackathon_id', selectedTeam.hackathon_id);
      }

      toast.success('Left the team successfully');
      setTeams(prev => prev.filter(t => t.id !== selectedTeam.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave team');
    } finally {
      setLeavingTeam(false);
      setLeaveDialogOpen(false);
      setSelectedTeam(null);
    }
  };

  if (authLoading) {
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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="container py-8 max-w-4xl flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Teams</h1>
              <p className="text-muted-foreground text-sm">Manage your hackathon teams</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            Loading...
          </div>
        ) : teams.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-2">You haven't joined any teams yet</p>
            <p className="text-sm text-muted-foreground/70 mb-6">
              Browse hackathons and create or join a team to get started
            </p>
            <Button onClick={() => navigate('/')} className="btn-gradient">
              Browse Hackathons
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => {
              const hackathonOngoing = isHackathonOngoing(team.hackathon_id);
              
              return (
                <div key={team.id} className="glass-card p-5 card-hover animate-fade-in relative">
                  {/* Leave button */}
                  <button
                    onClick={() => handleLeaveClick(team)}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Leave team"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex items-start justify-between mb-4 pr-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{team.name}</h3>
                        {team.is_leader && (
                          <Badge variant="outline" className="text-xs">Leader</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {team.hackathon_name}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {team.member_count}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Calendar className="h-3 w-3" />
                    <span>Created {format(new Date(team.created_at), 'MMM d, yyyy')}</span>
                    {hackathonOngoing && (
                      <Badge variant="secondary" className="ml-2 text-xs">Ongoing</Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/team/${team.id}/chat`} className="flex-1">
                      <Button variant="secondary" className="w-full gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Team Chat
                      </Button>
                    </Link>
                    {team.is_leader && (
                      <Link to={`/team/${team.id}/manage`}>
                        <Button variant="outline" size="icon">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Leave Team Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{selectedTeam?.name}"? 
              You will no longer receive team updates or messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leavingTeam}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLeaveTeam} 
              disabled={leavingTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leavingTeam ? 'Leaving...' : 'Leave Team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Footer />
    </div>
  );
};

export default Teams;
