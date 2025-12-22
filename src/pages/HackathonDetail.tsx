import { useParams, useNavigate, Link } from 'react-router-dom';
import { useHackathon } from '@/hooks/useHackathons';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, ExternalLink, CalendarPlus, Share2, Globe, Users, ArrowLeft, Tag, Building, Clock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserTeamsForHackathon } from '@/hooks/useUserTeamsForHackathon';
import LookingForTeammatesSection from '@/components/LookingForTeammatesSection';

const HackathonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch hackathon from database
  const { hackathon, loading } = useHackathon(id);
  const { teams, loading: teamsLoading, canCreateMoreTeams, teamCount } = useUserTeamsForHackathon(hackathon?.slug || hackathon?.id);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Hackathon not found</h1>
          <Button onClick={() => navigate('/')}>Go Back</Button>
        </main>
      </div>
    );
  }

  const isLinkUpdatingSoon = hackathon.linkStatus === 'updating-soon' || !hackathon.url;

  const handleShare = async () => {
    const shareUrl = isLinkUpdatingSoon 
      ? window.location.href
      : hackathon.url;
    
    const shareData = {
      title: hackathon.name,
      text: hackathon.description,
      url: shareUrl,
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleAddToCalendar = () => {
    const startDate = parseISO(hackathon.startDate);
    const endDate = parseISO(hackathon.endDate);
    
    const formatGoogleDate = (date: Date) => format(date, "yyyyMMdd");
    const websiteInfo = isLinkUpdatingSoon ? 'Registration link updating soon' : hackathon.url;
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(hackathon.name)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(hackathon.description + '\n\nWebsite: ' + websiteInfo)}&location=${encodeURIComponent(hackathon.location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    toast.success('Opening Google Calendar...');
  };

  const handleCreateTeam = () => {
    if (!user) {
      toast.error('Please sign in to create a team');
      navigate('/auth');
      return;
    }
    if (!canCreateMoreTeams) {
      toast.error('Maximum 5 teams per hackathon reached');
      return;
    }
    navigate(`/hackathon/${hackathon.slug}/team`);
  };

  const handleVisitWebsite = () => {
    if (isLinkUpdatingSoon) {
      toast.info('Registration link will be updated soon!');
      return;
    }
    window.open(hackathon.url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="container py-8 flex-1">
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Hackathons
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="glass-card p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${isLinkUpdatingSoon ? 'bg-warning' : 'bg-success'} animate-pulse`} />
                  <span className="text-sm text-muted-foreground uppercase tracking-wider">
                    {hackathon.organizer} • {hackathon.region}
                  </span>
                </div>
                {hackathon.isGlobal ? (
                  <Globe className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <span className="text-sm font-bold bg-muted px-3 py-1 rounded">IN</span>
                )}
              </div>

              <h1 className="text-3xl font-bold mb-4 text-primary">{hackathon.name}</h1>

              {isLinkUpdatingSoon && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <Clock className="h-5 w-5 text-warning" />
                  <span className="text-warning font-medium">Registration link will be updated soon</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-6">
                {hackathon.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="badge-tag">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="text-foreground">{format(parseISO(hackathon.startDate), 'MMM d, yyyy')} - {format(parseISO(hackathon.endDate), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="text-foreground">{hackathon.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Organizer</p>
                      <p className="text-foreground">{hackathon.organizer}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Region</p>
                      <p className="text-foreground">{hackathon.region}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Tag className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Domain</p>
                      <p className="text-foreground">{hackathon.tags.join(', ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Team Size</p>
                      <p className="text-foreground">1-4 members (typical)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground">{hackathon.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {isLinkUpdatingSoon ? (
                  <Button 
                    variant="outline"
                    className="gap-2 border-warning/50 text-warning"
                    onClick={handleVisitWebsite}
                  >
                    <Clock className="h-4 w-4" />
                    Link Updating Soon
                  </Button>
                ) : (
                  <Button 
                    className="gap-2 btn-gradient"
                    onClick={handleVisitWebsite}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Official Website
                  </Button>
                )}
                
                <Button 
                  variant="secondary"
                  className="gap-2"
                  onClick={handleCreateTeam}
                  disabled={!canCreateMoreTeams && user !== null}
                >
                  <Users className="h-4 w-4" />
                  Create Team {teamCount > 0 && `(${teamCount}/5)`}
                </Button>
                
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={handleAddToCalendar}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add to Calendar
                </Button>
                
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar - User's Teams + Looking for Teammates */}
          <div className="lg:col-span-1 space-y-6">
            {/* Looking for Teammates Section */}
            {user && hackathon?.slug && (
              <LookingForTeammatesSection hackathonSlug={hackathon.slug} />
            )}

            {user && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Your Teams
                </h3>
                
                {teamsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading...</p>
                ) : teams.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-4">You haven't joined any teams for this hackathon yet.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCreateTeam}
                      disabled={!canCreateMoreTeams}
                      className="w-full"
                    >
                      Create Your First Team
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div key={team.id} className="p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{team.name}</p>
                            {team.is_leader && (
                              <Badge variant="outline" className="text-xs mt-1">Leader</Badge>
                            )}
                          </div>
                        </div>
                        <Link to={`/team/${team.id}/chat`} className="mt-2 block">
                          <Button variant="ghost" size="sm" className="w-full gap-2">
                            <MessageCircle className="h-4 w-4" />
                            Team Chat
                          </Button>
                        </Link>
                      </div>
                    ))}
                    
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {teamCount}/5 teams
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HackathonDetail;
