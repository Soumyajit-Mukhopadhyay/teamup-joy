import { Calendar, MapPin, ExternalLink, Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hackathon } from '@/data/hackathons';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface HackathonCardProps {
  hackathon: Hackathon;
  delay?: number;
}

const HackathonCard = ({ hackathon, delay = 0 }: HackathonCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  };

  const handleCreateTeam = () => {
    if (!user) {
      toast.error('Please sign in to create a team');
      navigate('/auth');
      return;
    }
    navigate(`/hackathon/${hackathon.id}/team`);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + `/hackathon/${hackathon.id}`);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div 
      className="group glass-card p-5 card-hover animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {hackathon.organizer} • {hackathon.region}
          </span>
        </div>
        {hackathon.isGlobal ? (
          <span className="text-lg">🌐</span>
        ) : (
          <span className="text-lg">🇮🇳</span>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors">
        {hackathon.name}
      </h3>

      <div className="flex flex-wrap gap-2 mb-4">
        {hackathon.tags.slice(0, 4).map((tag) => (
          <Badge key={tag} variant="secondary" className="badge-tag">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="space-y-2 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{formatDate(hackathon.startDate)} - {formatDate(hackathon.endDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span>{hackathon.location}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-5 line-clamp-2">
        {hackathon.description}
      </p>

      <div className="flex items-center gap-2">
        <Button 
          variant="secondary" 
          className="flex-1 gap-2"
          onClick={() => window.open(hackathon.url, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Visit
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleCreateTeam}
          title="Create Team"
        >
          <Users className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleShare}
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default HackathonCard;
