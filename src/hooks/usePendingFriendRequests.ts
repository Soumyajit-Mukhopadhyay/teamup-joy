import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingFriendRequests = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasViewed, setHasViewed] = useState(false);

  const fetchPendingCount = async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', user.id)
      .eq('status', 'pending');

    if (!error) {
      setPendingCount(count || 0);
    }
  };

  useEffect(() => {
    fetchPendingCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('friend-requests-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
        },
        () => {
          fetchPendingCount();
          setHasViewed(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsViewed = () => {
    setHasViewed(true);
  };

  return {
    pendingCount,
    hasNotification: pendingCount > 0 && !hasViewed,
    markAsViewed,
    refetch: fetchPendingCount,
  };
};
