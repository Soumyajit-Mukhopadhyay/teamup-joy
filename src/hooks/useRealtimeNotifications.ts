import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseRealtimeNotificationsOptions {
  onNotification?: (notification: any) => void;
  onTeamRequest?: (request: any) => void;
  onTeamMemberChange?: (change: any) => void;
}

export const useRealtimeNotifications = (options: UseRealtimeNotificationsOptions = {}) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New notification:', payload);
          options.onNotification?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_requests',
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Team request update:', payload);
          options.onTeamRequest?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_requests',
          filter: `from_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('My team request update:', payload);
          options.onTeamRequest?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Team member change:', payload);
          options.onTeamMemberChange?.(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, options.onNotification, options.onTeamRequest, options.onTeamMemberChange]);
};

export default useRealtimeNotifications;
