import { useState } from 'react';
import { Calendar, MapPin, ExternalLink, Share2, CalendarPlus, Globe, Clock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hackathon } from '@/data/hackathons';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import EditHackathonModal from './EditHackathonModal';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface HackathonCardProps {
  hackathon: Hackathon;
  delay?: number;
  onClick?: () => void;
  onUpdated?: () => void;
  isDbHackathon?: boolean;
}

const HackathonCard = ({ hackathon, delay = 0, onClick, onUpdated, isDbHackathon = false }: HackathonCardProps) => {
  const { isAdmin } = useIsAdmin();
  const [showEditModal, setShowEditModal] = useState(false);

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };

  const isLinkUpdatingSoon = hackathon.linkStatus === 'updating-soon' || !hackathon.url;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = isLinkUpdatingSoon 
      ? window.location.origin + '/hackathon/' + hackathon.id
      : hackathon.url;
    
    const shareData = {
      title: hackathon.name,
      text: hackathon.description,
      url: shareUrl,
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startDate = parseISO(hackathon.startDate);
    const endDate = parseISO(hackathon.endDate);
    
    const formatGoogleDate = (date: Date) => {
      return format(date, "yyyyMMdd");
    };
    
    const websiteInfo = isLinkUpdatingSoon ? 'Link updating soon' : hackathon.url;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(hackathon.name)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(hackathon.description + '\n\nWebsite: ' + websiteInfo)}&location=${encodeURIComponent(hackathon.location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    toast.success('Opening Google Calendar...');
  };

  const handleVisit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLinkUpdatingSoon) {
      toast.info('Registration link will be updated soon!');
      return;
    }
    window.open(hackathon.url, '_blank');
  };

  return (
    <div 
      className="group glass-card p-5 card-hover animate-fade-in cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isLinkUpdatingSoon ? 'bg-warning' : 'bg-success'} animate-pulse`} />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {hackathon.organizer} • {hackathon.region}
          </span>
        </div>
        {hackathon.isGlobal ? (
          <Globe className="h-5 w-5 text-muted-foreground" />
        ) : (
          <span className="text-xs font-bold bg-muted px-2 py-1 rounded">IN</span>
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
        {isLinkUpdatingSoon ? (
          <Button 
            variant="outline" 
            className="flex-1 gap-2 text-warning border-warning/50"
            onClick={handleVisit}
          >
            <Clock className="h-4 w-4" />
            Link Updating Soon
          </Button>
        ) : (
          <Button 
            variant="secondary" 
            className="flex-1 gap-2"
            onClick={handleVisit}
          >
            <ExternalLink className="h-4 w-4" />
            Visit
          </Button>
        )}
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleAddToCalendar}
          title="Add to Google Calendar"
        >
          <CalendarPlus className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleShare}
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        {isAdmin && isDbHackathon && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleEdit}
            title="Edit Hackathon"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showEditModal && (
        <EditHackathonModal
          hackathon={hackathon}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => onUpdated?.()}
        />
      )}
    </div>
  );
};

export default HackathonCard;