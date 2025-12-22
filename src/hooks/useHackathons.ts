import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Hackathon {
  id: string;
  slug: string;
  name: string;
  organizer: string;
  region: string;
  tags: string[];
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  url: string;
  isGlobal: boolean;
  linkStatus?: 'active' | 'updating-soon';
}

interface UseHackathonsOptions {
  includeExpired?: boolean;
  onlyApproved?: boolean;
}

export const useHackathons = (options: UseHackathonsOptions = {}) => {
  const { includeExpired = false, onlyApproved = true } = options;
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHackathons = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('hackathons')
      .select('*')
      .order('start_date', { ascending: true });

    if (onlyApproved) {
      query = query.eq('status', 'approved');
    }

    // Filter out expired hackathons (end_date < today) unless includeExpired is true
    if (!includeExpired) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('end_date', today);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setHackathons([]);
    } else if (data) {
      const formatted: Hackathon[] = data.map(h => ({
        id: h.id,
        slug: h.slug || h.id,
        name: h.name,
        description: h.description || '',
        startDate: h.start_date,
        endDate: h.end_date,
        region: h.region,
        location: h.location,
        url: h.url || '',
        organizer: h.organizer || 'Community',
        tags: h.tags || [],
        isGlobal: h.is_global,
        linkStatus: h.url ? 'active' : 'updating-soon',
      }));
      setHackathons(formatted);
    }

    setLoading(false);
  }, [includeExpired, onlyApproved]);

  useEffect(() => {
    fetchHackathons();
  }, [fetchHackathons]);

  return { hackathons, loading, error, refetch: fetchHackathons };
};

export const useHackathon = (idOrSlug: string | undefined) => {
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idOrSlug) {
      setLoading(false);
      return;
    }

    const fetchHackathon = async () => {
      setLoading(true);
      setError(null);

      // Try to find by slug first, then by id
      let { data, error: fetchError } = await supabase
        .from('hackathons')
        .select('*')
        .eq('slug', idOrSlug)
        .maybeSingle();

      // If not found by slug, try by id
      if (!data && !fetchError) {
        const result = await supabase
          .from('hackathons')
          .select('*')
          .eq('id', idOrSlug)
          .maybeSingle();
        data = result.data;
        fetchError = result.error;
      }

      if (fetchError) {
        setError(fetchError.message);
        setHackathon(null);
      } else if (data) {
        setHackathon({
          id: data.id,
          slug: data.slug || data.id,
          name: data.name,
          description: data.description || '',
          startDate: data.start_date,
          endDate: data.end_date,
          region: data.region,
          location: data.location,
          url: data.url || '',
          organizer: data.organizer || 'Community',
          tags: data.tags || [],
          isGlobal: data.is_global,
          linkStatus: data.url ? 'active' : 'updating-soon',
        });
      } else {
        setHackathon(null);
      }

      setLoading(false);
    };

    fetchHackathon();
  }, [idOrSlug]);

  return { hackathon, loading, error };
};

// Helper to get hackathon name by id (for profiles/teams display)
export const getHackathonById = async (hackathonId: string): Promise<Hackathon | null> => {
  // Try slug first
  let { data } = await supabase
    .from('hackathons')
    .select('*')
    .eq('slug', hackathonId)
    .maybeSingle();

  // Try id if not found
  if (!data) {
    const result = await supabase
      .from('hackathons')
      .select('*')
      .eq('id', hackathonId)
      .maybeSingle();
    data = result.data;
  }

  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug || data.id,
    name: data.name,
    description: data.description || '',
    startDate: data.start_date,
    endDate: data.end_date,
    region: data.region,
    location: data.location,
    url: data.url || '',
    organizer: data.organizer || 'Community',
    tags: data.tags || [],
    isGlobal: data.is_global,
    linkStatus: data.url ? 'active' : 'updating-soon',
  };
};
