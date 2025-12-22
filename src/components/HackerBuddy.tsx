import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pendingConfirmation?: {
    name: string;
    arguments: Record<string, any>;
    message: string;
  };
}

// Custom event for AI actions that require UI refresh
export const AI_ACTION_EVENT = 'hackerbuddy-action-completed';

export function emitAIActionEvent(actionType: string) {
  window.dispatchEvent(new CustomEvent(AI_ACTION_EVENT, { detail: { actionType } }));
}

const HackerBuddy = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<Message['pendingConfirmation'] | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
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
      // Small delay to ensure DOM is updated
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

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at),
        }))
      );
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .insert({
        user_id: user.id,
        role,
        content,
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
    toast.success('Chat cleared');
  };

  const sendMessage = async (e?: React.FormEvent, confirmAction?: boolean) => {
    e?.preventDefault();

    if (!user) {
      toast.error('Please sign in to use HackerBuddy');
      return;
    }

    const messageText = confirmAction ? (pendingAction ? 'Yes, proceed' : '') : input.trim();
    if (!messageText && !confirmAction) return;

    // Add user message to UI
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    if (!confirmAction) {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      await saveMessage('user', messageText);
    }

    setIsLoading(true);
    
    // Scroll to show the user message and loading indicator
    setTimeout(scrollToBottom, 50);

    const pathname = window.location.pathname || '';
    const hackathonMatch = pathname.match(/^\/hackathon\/([^/]+)$/);
    const currentHackathonId = hackathonMatch?.[1];

    try {
      // Request streaming
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
            pendingConfirmation: confirmAction && pendingAction ? true : false,
            confirmedAction: confirmAction ? pendingAction : undefined,
            currentHackathonId,
            stream: true,
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
                // Scroll as content streams in
                scrollToBottom();
              }
            } catch {
              // Incomplete JSON, put it back
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
        } else {
          setPendingAction(null);
        }

        // If an action was completed, emit event for UI refresh
        if (data.actionCompleted) {
          emitAIActionEvent(data.actionCompleted);
          toast.success('Action completed');
        }

        const responseText: string = data.response || "I'm not sure how to help with that.";

        const assistantMessage: Message = {
          id: `temp-${Date.now()}-response`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
          pendingConfirmation: data.pendingConfirmation,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await saveMessage('assistant', responseText);
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
      // Final scroll after everything is done
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleConfirm = () => {
    sendMessage(undefined, true);
  };

  const handleReject = () => {
    setPendingAction(null);
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
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
          {pendingAction && !isLoading && (
            <div className="p-3 border-t border-border bg-muted/30 flex gap-2">
              <Button onClick={handleConfirm} size="sm" className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                Yes, proceed
              </Button>
              <Button onClick={handleReject} variant="outline" size="sm" className="flex-1">
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading || !!pendingAction}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim() || !!pendingAction}>
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
