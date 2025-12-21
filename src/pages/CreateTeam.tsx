import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { hackathons } from '@/data/hackathons';
import { toast } from 'sonner';
import { Users, Search, Plus, UserPlus, X, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface SearchResult {
  id: string;
  user_id: string;
  username: string;
  userid: string;
}

const CreateTeam = () => {
  const { hackathonId } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [teamName, setTeamName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const hackathon = hackathons.find(h => h.id === hackathonId);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
      // Filter out already selected members
      const filtered = data?.filter(
        u => !selectedMembers.find(m => m.user_id === u.user_id)
      ) || [];
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

  const addMember = (member: SearchResult) => {
    setSelectedMembers(prev => [...prev, member]);
    setSearchResults(prev => prev.filter(r => r.user_id !== member.user_id));
    setSearchQuery('');
  };

  const removeMember = (userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    if (!user || !hackathonId) return;

    setLoading(true);

    try {
      // Create the team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName,
          hackathon_id: hackathonId,
          created_by: user.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as team member (leader)
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'leader',
          is_leader: true,
        });

      if (memberError) throw memberError;

      // Send team requests to selected members
      if (selectedMembers.length > 0) {
        const requests = selectedMembers.map(member => ({
          team_id: team.id,
          from_user_id: user.id,
          to_user_id: member.user_id,
          status: 'pending',
        }));

        const { error: requestError } = await supabase
          .from('team_requests')
          .insert(requests);

        if (requestError) throw requestError;
      }

      toast.success('Team created successfully!');
      navigate('/teams');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Hackathon not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go back
          </Button>
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
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Team</h1>
              <p className="text-muted-foreground text-sm">{hackathon.name}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Team Name */}
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
                className="input-dark"
              />
            </div>

            {/* Search Users */}
            <div className="space-y-2">
              <Label>Invite Team Members</Label>
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
                        onClick={() => addMember(result)}
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

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Members ({selectedMembers.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-sm"
                    >
                      <span>@{member.userid}</span>
                      <button
                        onClick={() => removeMember(member.user_id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Button */}
            <Button
              onClick={handleCreateTeam}
              disabled={loading || !teamName.trim()}
              className="w-full btn-gradient"
            >
              {loading ? 'Creating...' : 'Create Team'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Selected members will receive an invitation to join your team
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateTeam;
