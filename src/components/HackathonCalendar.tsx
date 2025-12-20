import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hackathon } from '@/data/hackathons';
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

interface HackathonCalendarProps {
  hackathons: Hackathon[];
}

const HackathonCalendar = ({ hackathons }: HackathonCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const selectedDayHackathons = selectedDate 
    ? getHackathonsForDay(selectedDate)
    : [];

  const today = new Date();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      {/* Calendar */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
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
            const hasEvents = dayHackathons.length > 0;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-lg
                  text-sm transition-all duration-200
                  ${!isCurrentMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                  ${isToday ? 'ring-2 ring-destructive' : ''}
                  ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}
                  ${hasEvents && !isSelected ? 'bg-primary/20' : ''}
                `}
              >
                <span>{format(day, 'd')}</span>
                {hasEvents && (
                  <span className="text-[10px] text-primary truncate max-w-full px-1">
                    {dayHackathons[0].name.split(' ')[0]}...
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
              <span className="h-3 w-3 rounded bg-primary/20" />
              <span className="text-muted-foreground">Has events</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded ring-2 ring-destructive" />
              <span className="text-muted-foreground">Today</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected day events */}
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {selectedDate ? `Select a date` : 'Select a date'}
        </h2>
        <Badge variant="outline" className="mb-6">
          {selectedDayHackathons.length} Events
        </Badge>

        <div className="glass-card p-8 min-h-[300px] flex items-center justify-center">
          {selectedDayHackathons.length > 0 ? (
            <div className="w-full space-y-4">
              {selectedDayHackathons.map(h => (
                <div key={h.id} className="p-4 rounded-lg bg-secondary border border-border">
                  <h3 className="font-medium mb-1">{h.name}</h3>
                  <p className="text-sm text-muted-foreground">{h.location}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No hackathons on this day</p>
              <p className="text-sm">Click on a day with a green border to see events</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HackathonCalendar;
