import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNotification, setHasNotification] = useState(false);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setHasNotification(false);
      return;
    }

    const fetchCounts = async () => {
      // Count unread notifications
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      // Count pending team requests
      const { count: teamCount } = await supabase
        .from('team_requests')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      // Count pending friend requests
      const { count: friendCount } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      const total = (notifCount || 0) + (teamCount || 0) + (friendCount || 0);
      setUnreadCount(total);
      setHasNotification(total > 0);
    };

    fetchCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('notification-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, fetchCounts)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_requests',
        filter: `to_user_id=eq.${user.id}`
      }, fetchCounts)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `to_user_id=eq.${user.id}`
      }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { unreadCount, hasNotification };
};
