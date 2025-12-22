import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Calendar, MapPin, ExternalLink, CalendarPlus, Share2, Globe, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hackathon } from '@/hooks/useHackathons';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { toast } from 'sonner';

interface HackathonCalendarProps {
  hackathons: Hackathon[];
}

const HackathonCalendar = ({ hackathons }: HackathonCalendarProps) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Fetch user's participated hackathons via team membership
  const { data: userParticipations = [] } = useQuery({
    queryKey: ['user-participations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all teams the user is a member of
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);
      
      if (teamError || !teamMembers?.length) return [];
      
      const teamIds = teamMembers.map(tm => tm.team_id);
      
      // Get hackathon IDs from those teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('hackathon_id')
        .in('id', teamIds);
      
      if (teamsError || !teams?.length) return [];
      
      // Get unique hackathon slugs
      const hackathonSlugs = [...new Set(teams.map(t => t.hackathon_id))];
      
      // Get hackathon details
      const { data: participatedHackathons, error: hackError } = await supabase
        .from('hackathons')
        .select('*')
        .in('slug', hackathonSlugs)
        .eq('status', 'approved');
      
      if (hackError) return [];
      
      return (participatedHackathons || []).map(h => ({
        id: h.id,
        slug: h.slug,
        name: h.name,
        organizer: h.organizer || '',
        region: h.region,
        location: h.location,
        description: h.description || '',
        url: h.url || '',
        startDate: h.start_date,
        endDate: h.end_date,
        isGlobal: h.is_global,
        tags: h.tags || [],
        linkStatus: h.url ? 'active' : 'updating-soon',
      })) as Hackathon[];
    },
    enabled: !!user,
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getHackathonsForDay = (day: Date) => {
    return hackathons.filter(h => {
      const start = parseISO(h.startDate);
      const end = parseISO(h.endDate);
      return isWithinInterval(day, { start, end });
    });
  };

  const getParticipationsForDay = (day: Date) => {
    return userParticipations.filter(h => {
      const start = parseISO(h.startDate);
      const end = parseISO(h.endDate);
      return isWithinInterval(day, { start, end });
    });
  };

  const selectedDayHackathons = selectedDate 
    ? getHackathonsForDay(selectedDate)
    : [];

  const selectedDayParticipations = selectedDate
    ? getParticipationsForDay(selectedDate)
    : [];

  const today = new Date();

  const isLinkUpdatingSoon = (hackathon: Hackathon) => 
    hackathon.linkStatus === 'updating-soon' || !hackathon.url;

  const handleShare = async (hackathon: Hackathon) => {
    const updatingSoon = isLinkUpdatingSoon(hackathon);
    const shareUrl = updatingSoon 
      ? window.location.origin + '/hackathon/' + hackathon.slug
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

  const handleAddToCalendar = (hackathon: Hackathon) => {
    const startDate = parseISO(hackathon.startDate);
    const endDate = parseISO(hackathon.endDate);
    const updatingSoon = isLinkUpdatingSoon(hackathon);
    
    const formatGoogleDate = (date: Date) => format(date, "yyyyMMdd");
    const websiteInfo = updatingSoon ? 'Registration link updating soon' : hackathon.url;
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(hackathon.name)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(hackathon.description + '\n\nWebsite: ' + websiteInfo)}&location=${encodeURIComponent(hackathon.location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    toast.success('Opening Google Calendar...');
  };

  const handleVisit = (hackathon: Hackathon) => {
    if (isLinkUpdatingSoon(hackathon)) {
      toast.info('Registration link will be updated soon!');
      return;
    }
    window.open(hackathon.url, '_blank');
  };

  const renderHackathonCard = (h: Hackathon, isParticipation: boolean = false) => {
    const updatingSoon = isLinkUpdatingSoon(h);
    return (
      <div key={h.id} className={`glass-card p-5 ${isParticipation ? 'border-l-4 border-l-success' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${updatingSoon ? 'bg-warning' : 'bg-success'}`} />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {h.organizer} • {h.region}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isParticipation && (
              <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                <Users className="h-3 w-3 mr-1" />
                Participating
              </Badge>
            )}
            {h.isGlobal ? (
              <Globe className="h-5 w-5 text-muted-foreground" />
            ) : (
              <span className="text-xs font-bold bg-muted px-2 py-1 rounded">IN</span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-primary mb-3">{h.name}</h3>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {h.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="badge-tag">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="space-y-2 mb-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{format(parseISO(h.startDate), 'MMM d, yyyy')} - {format(parseISO(h.endDate), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{h.location}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{h.description}</p>

        <div className="flex items-center gap-2">
          {updatingSoon ? (
            <Button 
              variant="outline" 
              className="flex-1 gap-2 border-warning/50 text-warning"
              onClick={() => handleVisit(h)}
            >
              <Clock className="h-4 w-4" />
              Link Updating Soon
            </Button>
          ) : (
            <Button 
              variant="secondary" 
              className="flex-1 gap-2"
              onClick={() => handleVisit(h)}
            >
              <ExternalLink className="h-4 w-4" />
              Visit
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => handleAddToCalendar(h)}
            title="Add to Google Calendar"
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => handleShare(h)}
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 animate-fade-in">
      {/* Calendar */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-1">
            <Button 
              variant="secondary" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const dayHackathons = getHackathonsForDay(day);
            const dayParticipations = getParticipationsForDay(day);
            const hasEvents = dayHackathons.length > 0;
            const hasParticipations = dayParticipations.length > 0;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-lg
                  text-sm transition-all duration-200 border
                  ${!isCurrentMonth ? 'text-muted-foreground/40 border-transparent' : 'border-border'}
                  ${isToday ? 'ring-2 ring-destructive' : ''}
                  ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-secondary'}
                  ${hasEvents && !isSelected ? 'bg-primary/20 border-primary/50' : ''}
                  ${hasParticipations && !isSelected ? 'ring-2 ring-success ring-inset' : ''}
                `}
              >
                <span>{format(day, 'd')}</span>
                {hasEvents && (
                  <span className="text-[8px] truncate max-w-full px-0.5 mt-0.5">
                    {dayHackathons[0].name.split(' ')[0].substring(0, 5)}...
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Legend</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-primary/20 border border-primary/50" />
              <span className="text-muted-foreground">Has events</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded ring-2 ring-destructive" />
              <span className="text-muted-foreground">Today</span>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded ring-2 ring-success ring-inset bg-muted" />
                <span className="text-muted-foreground">Your participation</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected day events - sidebar */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
          </h2>
          <Badge variant="secondary" className="mb-4">
            {selectedDayHackathons.length} Event{selectedDayHackathons.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Your Participations Section */}
        {user && selectedDayParticipations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-success" />
              <h3 className="text-lg font-semibold text-success">Your Participations</h3>
              <Badge variant="secondary" className="bg-success/20 text-success">
                {selectedDayParticipations.length}
              </Badge>
            </div>
            <div className="space-y-4">
              {selectedDayParticipations.map(h => renderHackathonCard(h, true))}
            </div>
          </div>
        )}

        {/* All Events Section */}
        <div>
          {selectedDayParticipations.length > 0 && selectedDayHackathons.length > 0 && (
            <h3 className="text-lg font-semibold text-muted-foreground mb-3">All Events</h3>
          )}
          {selectedDayHackathons.length > 0 ? (
            <div className="space-y-4">
              {selectedDayHackathons.map(h => renderHackathonCard(h))}
            </div>
          ) : (
            <div className="glass-card p-8 flex items-center justify-center min-h-[200px]">
              <div className="text-center text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No hackathons on this day</p>
                <p className="text-sm">Click on a highlighted day to see events</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HackathonCalendar;
