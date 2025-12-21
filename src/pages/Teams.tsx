import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, MessageCircle, Calendar, Settings } from 'lucide-react';
import { hackathons } from '@/data/hackathons';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  is_leader?: boolean;
}

const Teams = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Get teams where user is a member
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

    // Get team details
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

    // Get member counts for each team
    const teamsWithCounts = await Promise.all(
      (teamsData || []).map(async (team) => {
        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        const memberInfo = memberData.find(m => m.team_id === team.id);
        const isLeader = memberInfo?.role === 'leader' || memberInfo?.is_leader || team.created_by === user.id;
        
        return { ...team, member_count: count || 0, is_leader: isLeader };
      })
    );

    setTeams(teamsWithCounts);
    setLoading(false);
  };

  const getHackathonName = (hackathonId: string) => {
    const hackathon = hackathons.find(h => h.id === hackathonId);
    return hackathon?.name || 'Unknown Hackathon';
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-4xl">
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
            {teams.map((team) => (
              <div key={team.id} className="glass-card p-5 card-hover animate-fade-in">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{team.name}</h3>
                      {team.is_leader && (
                        <Badge variant="outline" className="text-xs">Leader</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getHackathonName(team.hackathon_id)}
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Teams;
