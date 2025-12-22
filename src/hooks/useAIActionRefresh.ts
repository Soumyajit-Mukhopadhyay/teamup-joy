import { useEffect, useCallback } from 'react';
import { AI_ACTION_EVENT } from '@/components/HackerBuddy';

type ActionType = 
  | 'leave_team'
  | 'delete_team'
  | 'create_team'
  | 'remove_friend'
  | 'send_friend_request'
  | 'accept_friend_request'
  | 'accept_team_request'
  | 'invite_to_team'
  | 'set_looking_for_teammates'
  | 'remove_team_member'
  | 'submit_hackathon'
  | string;

interface UseAIActionRefreshOptions {
  onAction?: (actionType: ActionType) => void;
  actions?: ActionType[];
}

/**
 * Hook to listen for AI action completion events and trigger refreshes
 * @param options.onAction - Callback when an action is completed
 * @param options.actions - Filter to only trigger on specific action types
 */
export function useAIActionRefresh({ onAction, actions }: UseAIActionRefreshOptions = {}) {
  const handleAction = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ actionType: string }>;
    const actionType = customEvent.detail?.actionType;
    
    if (!actionType) return;
    
    // If actions filter is provided, only trigger for matching actions
    if (actions && !actions.includes(actionType)) return;
    
    onAction?.(actionType);
  }, [onAction, actions]);

  useEffect(() => {
    window.addEventListener(AI_ACTION_EVENT, handleAction);
    return () => {
      window.removeEventListener(AI_ACTION_EVENT, handleAction);
    };
  }, [handleAction]);
}
