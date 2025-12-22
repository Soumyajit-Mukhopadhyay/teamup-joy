import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  X,
  Send,
  Loader2,
  Check,
  XCircle,
  Trash2,
  ExternalLink,
  Copy,
  Calendar,
  Navigation,
} from 'lucide-react';

interface PendingAction {
  name: string;
  arguments: Record<string, any>;
  message: string;
}

type ChatAction =
  | { type: 'open_link'; label: string; url: string }
  | { type: 'copy_to_clipboard'; label: string; text: string }
  | { type: 'navigate'; label: string; path: string; url: string };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pendingConfirmation?: PendingAction;
  actions?: ChatAction[];
  actionsSummary?: string;
}

// Custom event for AI actions that require UI refresh
export const AI_ACTION_EVENT = 'hackerbuddy-action-completed';

export function emitAIActionEvent(actionType: string) {
  window.dispatchEvent(new CustomEvent(AI_ACTION_EVENT, { detail: { actionType } }));
}

const HackerBuddy = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [taskQueue, setTaskQueue] = useState<PendingAction[]>([]);
  const [isExecutingQueue, setIsExecutingQueue] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Execute browser actions (open links, copy to clipboard, navigate, etc.)
  const executeAction = useCallback(
    (action: { type: string; url?: string; text?: string; path?: string }) => {
      switch (action.type) {
        case 'open_link':
          if (action.url) {
            const opened = window.open(action.url, '_blank', 'noopener,noreferrer');
            if (!opened) {
              toast.info('Popup blocked — use the Open button in chat');
            }
          }
          break;
        case 'copy_to_clipboard':
          if (action.text) {
            navigator.clipboard
              .writeText(action.text)
              .then(() => {
                toast.success('Link copied to clipboard!');
              })
              .catch((err) => {
                console.error('Failed to copy:', err);
                toast.info('Copy blocked — use the Copy button in chat');
              });
          }
          break;
        case 'navigate':
          if (action.path) {
            navigate(action.path);
            toast.success(`Navigated to ${action.path}`);
          }
          break;
      }
    },
    [navigate]
  );

  const extractChatActions = useCallback((toolResults: any[] | undefined): ChatAction[] => {
    if (!toolResults?.length) return [];

    const actions: ChatAction[] = [];
    for (const tr of toolResults) {
      const action = tr?.action ?? tr?.result?.action;
      if (!action?.type) continue;

      if (action.type === 'open_link' && typeof action.url === 'string') {
        const isCalendar = action.url.includes('calendar.google.com');
        actions.push({
          type: 'open_link',
          label: isCalendar ? 'Open calendar' : 'Open link',
          url: action.url,
        });
        // Also offer copy for any generated link (especially calendar URLs)
        actions.push({
          type: 'copy_to_clipboard',
          label: isCalendar ? 'Copy calendar link' : 'Copy link',
          text: action.url,
        });
      }

      if (action.type === 'copy_to_clipboard' && typeof action.text === 'string') {
        actions.push({ type: 'copy_to_clipboard', label: 'Copy link', text: action.text });
      }

      if (action.type === 'navigate' && typeof action.path === 'string') {
        actions.push({
          type: 'navigate',
          label: 'Go to page',
          path: action.path,
          url: action.url || action.path,
        });
      }
    }

    // Dedupe
    const seen = new Set<string>();
    return actions.filter((a) => {
      let key: string;
      if (a.type === 'open_link') {
        key = `open:${a.url}`;
      } else if (a.type === 'copy_to_clipboard') {
        key = `copy:${a.text}`;
      } else {
        key = `navigate:${a.path}`;
      }
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // Load messages from database on mount
  useEffect(() => {
    if (user && isOpen) {
      loadMessages();
    }
  }, [user, isOpen]);

  // Scroll to bottom on new messages or when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, scrollToBottom]);

  // Also scroll when loading finishes
  useEffect(() => {
    if (!isLoading && isOpen) {
      setTimeout(scrollToBottom, 50);
    }
  }, [isLoading, isOpen, scrollToBottom]);

  const loadMessages = async () => {
    if (!user) return;

    // Load the 100 most recent messages, ordered descending so we get newest first
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      // Reverse to show oldest first (chronological order for display)
      setMessages(
        data
          .reverse()
          .map((m) => {
            const toolResults = (m as any).tool_results as any[] | null | undefined;
            const normalizedToolResults = Array.isArray(toolResults)
              ? toolResults
              : toolResults
                ? [toolResults]
                : undefined;

            return {
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at),
              actions: m.role === 'assistant' ? extractChatActions(normalizedToolResults) : undefined,
            } as Message;
          })
      );
    }
  };

  const saveMessage = async (
    role: 'user' | 'assistant',
    content: string,
    options?: { toolCalls?: any[] | null; toolResults?: any[] | null }
  ) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .insert({
        user_id: user.id,
        role,
        content,
        tool_calls: options?.toolCalls ?? null,
        tool_results: options?.toolResults ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
    }

    return data;
  };

  const clearChat = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('ai_chat_messages')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to clear chat');
      return;
    }

    // Also clear conversation summary
    await supabase
      .from('ai_conversation_summaries')
      .delete()
      .eq('user_id', user.id);

    setMessages([]);
    setPendingAction(null);
    setTaskQueue([]);
    setIsExecutingQueue(false);
    toast.success('Chat cleared');
  };

  // Execute a single task and return the result
  const executeTask = async (
    action: PendingAction,
    remainingTasks: PendingAction[] = []
  ): Promise<{
    success: boolean;
    response: string;
    toolResults?: any[];
    nextPendingAction?: PendingAction;
    nextRemainingTasks?: PendingAction[];
    actionCompleted?: string;
  }> => {
    const pathname = window.location.pathname || '';
    const hackathonMatch = pathname.match(/^\/hackathon\/([^/]+)$/);
    const currentHackathonId = hackathonMatch?.[1];

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hackerbuddy-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: 'Yes, proceed',
          conversationHistory: messages.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          pendingConfirmation: true,
          confirmedAction: action,
          remainingTasks,
          currentHackathonId,
          stream: false,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return { success: false, response: `❌ ${data.error}` };
    }

    return {
      success: true,
      response: data.response,
      toolResults: data.toolResults,
      nextPendingAction: data.pendingConfirmation,
      nextRemainingTasks: data.remainingTasks,
      actionCompleted: data.actionCompleted,
    };
  };

  // Process all tasks in queue sequentially (after initial confirmation)
  const processTaskQueue = async (initialAction: PendingAction, queue: PendingAction[]) => {
    setIsExecutingQueue(true);
    setIsLoading(true);
    
    const results: { action: string; success: boolean; message: string }[] = [];
    let currentAction: PendingAction | undefined = initialAction;
    let remainingQueue = [...queue];

    while (currentAction) {
      try {
        const result = await executeTask(currentAction, remainingQueue);
        
        results.push({
          action: currentAction.name.replace(/_/g, ' '),
          success: result.success,
          message: result.response,
        });

        // Add response to messages
        const assistantActions = extractChatActions(result.toolResults);
        const assistantMessage: Message = {
          id: `temp-${Date.now()}-${Math.random()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          actions: assistantActions,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await saveMessage('assistant', result.response, { toolResults: result.toolResults || null });

        // Emit event for UI refresh
        if (result.actionCompleted) {
          emitAIActionEvent(result.actionCompleted);
        }

        // Execute any browser actions for this task
        if (result.toolResults) {
          for (const tr of result.toolResults) {
            const action = tr?.action ?? tr?.result?.action;
            if (action) executeAction(action);
          }
        }

        // Check if next action needs confirmation (shouldn't happen in auto-queue mode)
        if (result.nextPendingAction) {
          // If we have more tasks but this one needs confirmation, just continue
          // The confirmation was already given for the batch
          currentAction = result.nextPendingAction;
          remainingQueue = result.nextRemainingTasks || [];
        } else if (remainingQueue.length > 0) {
          // Move to next task in queue
          currentAction = remainingQueue[0];
          remainingQueue = remainingQueue.slice(1);
          
          // Small delay between tasks
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // All done
          currentAction = undefined;
        }
      } catch (error) {
        console.error('Task execution error:', error);
        results.push({
          action: currentAction.name.replace(/_/g, ' '),
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        
        // Continue to next task on error
        if (remainingQueue.length > 0) {
          currentAction = remainingQueue[0];
          remainingQueue = remainingQueue.slice(1);
        } else {
          currentAction = undefined;
        }
      }
    }

    setIsExecutingQueue(false);
    setIsLoading(false);
    setPendingAction(null);
    setTaskQueue([]);
    
    setTimeout(scrollToBottom, 100);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!user) {
      toast.error('Please sign in to use HackerBuddy');
      return;
    }

    const messageText = input.trim();
    if (!messageText) return;

    // Add user message to UI
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    await saveMessage('user', messageText);

    setIsLoading(true);
    setTimeout(scrollToBottom, 50);

    const pathname = window.location.pathname || '';
    const hackathonMatch = pathname.match(/^\/hackathon\/([^/]+)$/);
    const currentHackathonId = hackathonMatch?.[1];

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hackerbuddy-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            message: messageText,
            conversationHistory: messages.slice(-20).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            pendingConfirmation: false,
            currentHackathonId,
            // Reliability > token streaming: ensure we always get toolResults back
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || '';

      // Handle SSE streaming
      if (contentType.includes('text/event-stream') && response.body) {
        const assistantId = `temp-${Date.now()}-response`;
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullContent += content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                );
                scrollToBottom();
              }
            } catch {
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split('\n')) {
            if (!raw) continue;
            if (raw.endsWith('\r')) raw = raw.slice(0, -1);
            if (raw.startsWith(':') || raw.trim() === '') continue;
            if (!raw.startsWith('data: ')) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullContent += content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {
              /* ignore */
            }
          }
        }

        setPendingAction(null);
        setTaskQueue([]);
        if (fullContent) {
          await saveMessage('assistant', fullContent);
        }
      } else {
        // Non-streaming JSON response (e.g. pending confirmation)
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        if (data.pendingConfirmation) {
          setPendingAction(data.pendingConfirmation);
          // Store remaining tasks for batch execution
          setTaskQueue(data.remainingTasks || []);
        } else {
          setPendingAction(null);
          setTaskQueue([]);
        }

        // If an action was completed, emit event for UI refresh
        if (data.actionCompleted) {
          emitAIActionEvent(data.actionCompleted);
        }

        // Execute any browser actions from tool results
        const assistantActions = extractChatActions(data.toolResults);
        if (data.toolResults) {
          for (const tr of data.toolResults) {
            const action = tr?.action ?? tr?.result?.action;
            if (action) executeAction(action);
          }
        }

        const responseText: string = data.response || "I'm not sure how to help with that.";

        const assistantMessage: Message = {
          id: `temp-${Date.now()}-response`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
          pendingConfirmation: data.pendingConfirmation,
          actions: assistantActions,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await saveMessage('assistant', responseText, { toolResults: data.toolResults || null });
      }
    } catch (error) {
      console.error('HackerBuddy error:', error);
      const errorMessage: Message = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant',
        content: "I'm having trouble right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleConfirm = async () => {
    if (!pendingAction || isExecutingQueue) return;
    
    // Process the initial action and all queued tasks
    await processTaskQueue(pendingAction, taskQueue);
  };

  const handleReject = () => {
    setPendingAction(null);
    setTaskQueue([]);
    const rejectMessage: Message = {
      id: `temp-${Date.now()}-reject`,
      role: 'assistant',
      content: "No problem! Let me know if there's anything else I can help you with.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, rejectMessage]);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        aria-label="Open HackerBuddy"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold">HackerBuddy</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Clear chat">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your messages with HackerBuddy. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearChat}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Hi! I'm HackerBuddy 👋</p>
                <p className="text-xs mt-2">
                  I can help you find hackathons, create teams, connect with hackers, and more!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 overflow-hidden ${
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                      {message.role === 'assistant' && message.actions?.length ? (
                        <div className="mt-3 p-2 bg-background/50 rounded-lg border border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            ⚡ Actions ({message.actions.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {message.actions.map((a, idx) => {
                              if (a.type === 'open_link') {
                                const isCalendar = a.url.includes('calendar.google.com');
                                return (
                                  <Button key={`${a.type}-${idx}`} size="sm" variant="secondary" className="gap-1" asChild>
                                    <a href={a.url} target="_blank" rel="noreferrer">
                                      {isCalendar ? <Calendar className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                                      {a.label}
                                    </a>
                                  </Button>
                                );
                              }

                              if (a.type === 'copy_to_clipboard') {
                                return (
                                  <Button
                                    key={`${a.type}-${idx}`}
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => executeAction({ type: 'copy_to_clipboard', text: a.text })}
                                  >
                                    <Copy className="h-3 w-3" />
                                    {a.label}
                                  </Button>
                                );
                              }

                              if (a.type === 'navigate') {
                                return (
                                  <Button
                                    key={`${a.type}-${idx}`}
                                    size="sm"
                                    variant="default"
                                    className="gap-1"
                                    onClick={() => executeAction({ type: 'navigate', path: a.path })}
                                  >
                                    <Navigation className="h-3 w-3" />
                                    {a.label}
                                  </Button>
                                );
                              }

                              return null;
                            })}
                          </div>
                        </div>
                      ) : null}

                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Confirmation buttons */}
          {pendingAction && !isLoading && !isExecutingQueue && (
            <div className="p-3 border-t border-border bg-muted/30 flex gap-2">
              <Button onClick={handleConfirm} size="sm" className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                Yes, proceed{taskQueue.length > 0 ? ` (${taskQueue.length + 1} tasks)` : ''}
              </Button>
              <Button onClick={handleReject} variant="outline" size="sm" className="flex-1">
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-border">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask me anything..."
                disabled={isLoading || !!pendingAction || isExecutingQueue}
                className="flex-1 min-h-[44px] max-h-32 resize-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim() || !!pendingAction || isExecutingQueue}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default HackerBuddy;
