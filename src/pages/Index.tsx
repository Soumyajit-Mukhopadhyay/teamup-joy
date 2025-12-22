import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FilterBar from '@/components/FilterBar';
import HackathonCard from '@/components/HackathonCard';
import HackathonCalendar from '@/components/HackathonCalendar';
import { hackathons as initialHackathons, Hackathon } from '@/data/hackathons';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [dbHackathons, setDbHackathons] = useState<Hackathon[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch approved hackathons from database
  const fetchApprovedHackathons = async () => {
    const { data, error } = await supabase
      .from('hackathons')
      .select('*')
      .eq('status', 'approved')
      .order('start_date', { ascending: true });

    if (!error && data) {
      const formatted: Hackathon[] = data.map(h => ({
        id: h.id,
        name: h.name,
        description: h.description || '',
        startDate: h.start_date,
        endDate: h.end_date,
        region: h.region as 'India' | 'Global',
        location: h.location,
        url: h.url || '#',
        organizer: h.organizer || 'Community',
        tags: h.tags || [],
        isGlobal: h.is_global,
      }));
      setDbHackathons(formatted);
    }
  };

  useEffect(() => {
    fetchApprovedHackathons();
  }, [refreshKey]);

  const dbHackathonIds = useMemo(() => new Set(dbHackathons.map(h => h.id)), [dbHackathons]);

  const allHackathons = useMemo(() => {
    return [...initialHackathons, ...dbHackathons];
  }, [dbHackathons]);

  const filteredHackathons = useMemo(() => {
    return allHackathons.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.description.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegion === 'All Regions' || h.region === selectedRegion;
      const matchesTopic = selectedTopic === 'All Topics' || h.tags.includes(selectedTopic);
      return matchesSearch && matchesRegion && matchesTopic;
    });
  }, [allHackathons, search, selectedRegion, selectedTopic]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      
      <main className="container pb-16">
        <FilterBar
          view={view}
          setView={setView}
          search={search}
          setSearch={setSearch}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          selectedTopic={selectedTopic}
          setSelectedTopic={setSelectedTopic}
        />

        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHackathons.map((hackathon, idx) => (
              <HackathonCard 
                key={hackathon.id} 
                hackathon={hackathon} 
                delay={idx * 50}
                onClick={() => navigate(`/hackathon/${hackathon.id}`)}
                isDbHackathon={dbHackathonIds.has(hackathon.id)}
                onUpdated={() => setRefreshKey(k => k + 1)}
              />
            ))}
          </div>
        ) : (
          <HackathonCalendar hackathons={filteredHackathons} />
        )}

        {filteredHackathons.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No hackathons found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
