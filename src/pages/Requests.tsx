import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Users, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';

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

const Requests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchRequests();
  }, [user, authLoading]);

  const fetchRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('team_requests')
      .select(`
        *,
        team:teams(id, name, hackathon_id)
      `)
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load requests');
      setLoading(false);
      return;
    }

    // Fetch from_profile separately
    if (data && data.length > 0) {
      const fromUserIds = data.map(r => r.from_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', fromUserIds);

      const requestsWithProfiles = data.map(req => ({
        ...req,
        from_profile: profiles?.find(p => p.user_id === req.from_user_id) || { username: 'Unknown', userid: 'unknown' }
      }));

      setRequests(requestsWithProfiles as TeamRequest[]);
    } else {
      setRequests([]);
    }

    setLoading(false);
  };

  const handleAccept = async (request: TeamRequest) => {
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('team_requests')
        .update({ status: 'accepted' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Add user to team members
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: request.team_id,
          user_id: user!.id,
          role: 'member',
        });

      if (memberError) throw memberError;

      toast.success('You joined the team!');
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('team_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request declined');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline request');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Team Requests</h1>
            <p className="text-muted-foreground text-sm">Pending invitations to join teams</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No pending requests</p>
            <p className="text-sm text-muted-foreground/70">
              When someone invites you to join their team, it will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
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
                      onClick={() => handleDecline(request.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(request)}
                      className="btn-gradient"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Requests;
