import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FilterBar from '@/components/FilterBar';
import HackathonCard from '@/components/HackathonCard';
import HackathonCalendar from '@/components/HackathonCalendar';
import Footer from '@/components/Footer';
import { useHackathons } from '@/hooks/useHackathons';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const Index = () => {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');

  // Fetch hackathons from database (excludes expired by default)
  const { hackathons, loading, refetch } = useHackathons({ includeExpired: false });

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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <HeroSection />
      
      <main className="container pb-16 flex-1">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </main>
      <Footer />
    </div>
  );
};

export default Index;
