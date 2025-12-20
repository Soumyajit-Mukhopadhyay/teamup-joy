import { useParams, useNavigate } from 'react-router-dom';
import { hackathons } from '@/data/hackathons';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, ExternalLink, CalendarPlus, Share2, Globe, Users, ArrowLeft, Tag, Building } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const HackathonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const hackathon = hackathons.find(h => h.id === id);
  
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

  const handleShare = async () => {
    const shareData = {
      title: hackathon.name,
      text: hackathon.description,
      url: hackathon.url,
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(hackathon.url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleAddToCalendar = () => {
    const startDate = parseISO(hackathon.startDate);
    const endDate = parseISO(hackathon.endDate);
    
    const formatGoogleDate = (date: Date) => format(date, "yyyyMMdd");
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(hackathon.name)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(hackathon.description + '\n\nWebsite: ' + hackathon.url)}&location=${encodeURIComponent(hackathon.location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    toast.success('Opening Google Calendar...');
  };

  const handleCreateTeam = () => {
    if (!user) {
      toast.error('Please sign in to create a team');
      navigate('/auth');
      return;
    }
    navigate(`/hackathon/${hackathon.id}/team`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Hackathons
        </Button>

        <div className="glass-card p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-success animate-pulse" />
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
            <Button 
              className="gap-2 btn-gradient"
              onClick={() => window.open(hackathon.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Visit Official Website
            </Button>
            
            <Button 
              variant="secondary"
              className="gap-2"
              onClick={handleCreateTeam}
            >
              <Users className="h-4 w-4" />
              Create Team
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
      </main>
    </div>
  );
};

export default HackathonDetail;