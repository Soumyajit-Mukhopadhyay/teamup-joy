import { Grid, Calendar, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { regions, topics } from '@/data/hackathons';
import AddHackathonModal from './AddHackathonModal';

interface FilterBarProps {
  view: 'grid' | 'calendar';
  setView: (view: 'grid' | 'calendar') => void;
  search: string;
  setSearch: (search: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
}

const FilterBar = ({
  view,
  setView,
  search,
  setSearch,
  selectedRegion,
  setSelectedRegion,
  selectedTopic,
  setSelectedTopic,
}: FilterBarProps) => {
  return (
    <div className="flex flex-col gap-4 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* View Toggle */}
        <div className="flex rounded-lg border border-border p-1 bg-secondary/50">
          <Button
            variant={view === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('grid')}
            className={`gap-2 ${view === 'grid' ? 'btn-gradient' : ''}`}
          >
            <Grid className="h-4 w-4" />
            Grid View
          </Button>
          <Button
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('calendar')}
            className={`gap-2 ${view === 'calendar' ? 'btn-gradient' : ''}`}
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </Button>
        </div>

        {/* Add Hackathon Button */}
        <AddHackathonModal />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hackathons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full input-dark"
          />
        </div>

        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-full sm:w-40 input-dark">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
          <SelectTrigger className="w-full sm:w-40 input-dark">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Topics" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic} value={topic}>
                {topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default FilterBar;
