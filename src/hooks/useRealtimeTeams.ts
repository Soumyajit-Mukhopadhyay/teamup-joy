import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseRealtimeTeamsOptions {
  teamIds?: string[];
  onTeamUpdate?: (team: any) => void;
  onMemberJoin?: (member: any) => void;
  onMemberLeave?: (member: any) => void;
  onRequestUpdate?: (request: any) => void;
}

export const useRealtimeTeams = (options: UseRealtimeTeamsOptions = {}) => {
  const { user } = useAuth();
  const { teamIds = [], onTeamUpdate, onMemberJoin, onMemberLeave, onRequestUpdate } = options;

  useEffect(() => {
    if (!user || teamIds.length === 0) return;

    const channels = teamIds.map((teamId) => {
      return supabase
        .channel(`team-${teamId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'teams',
            filter: `id=eq.${teamId}`,
          },
          (payload) => {
            console.log('Team updated:', payload);
            onTeamUpdate?.(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'team_members',
            filter: `team_id=eq.${teamId}`,
          },
          (payload) => {
            console.log('Member joined:', payload);
            onMemberJoin?.(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'team_members',
            filter: `team_id=eq.${teamId}`,
          },
          (payload) => {
            console.log('Member left:', payload);
            onMemberLeave?.(payload.old);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_requests',
            filter: `team_id=eq.${teamId}`,
          },
          (payload) => {
            console.log('Team request update:', payload);
            onRequestUpdate?.(payload);
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user, teamIds.join(','), onTeamUpdate, onMemberJoin, onMemberLeave, onRequestUpdate]);
};

export default useRealtimeTeams;
