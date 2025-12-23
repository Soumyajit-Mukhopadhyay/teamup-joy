import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import HeroSection from '@/components/HeroSection';
import FilterBar from '@/components/FilterBar';
import HackathonCard from '@/components/HackathonCard';
import HackathonCalendar from '@/components/HackathonCalendar';
import { useHackathons } from '@/hooks/useHackathons';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useIsAdmin();
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');

  // Fetch hackathons from database (excludes expired by default)
  const { hackathons, loading, refetch } = useHackathons({ includeExpired: false });

  // Listen for ?view=calendar query param to auto-switch to calendar view
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'calendar') {
      setView('calendar');
    }
  }, [location.search]);

  const filteredHackathons = useMemo(() => {
    return hackathons.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.description.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegion === 'All Regions' || h.region === selectedRegion;
      const matchesTopic = selectedTopic === 'All Topics' || h.tags.includes(selectedTopic);
      return matchesSearch && matchesRegion && matchesTopic;
    });
  }, [hackathons, search, selectedRegion, selectedTopic]);

  return (
    <AuthenticatedLayout>
      <HeroSection />
      
      <div className="container pb-16 max-w-6xl mx-auto">
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

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Loading hackathons...</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredHackathons.map((hackathon, idx) => (
              <HackathonCard 
                key={hackathon.id} 
                hackathon={hackathon} 
                delay={idx * 50}
                onClick={() => navigate(`/hackathon/${hackathon.slug}`)}
                onUpdated={refetch}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        ) : (
          <HackathonCalendar hackathons={filteredHackathons} />
        )}

        {!loading && filteredHackathons.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No hackathons found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default Index;
