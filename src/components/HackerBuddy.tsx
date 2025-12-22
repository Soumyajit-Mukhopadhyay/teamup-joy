import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  MessageCircle,
  Check,
  XCircle,
  Trash2
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

const HackerBuddy = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<Message['pendingConfirmation'] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages from database on mount
  useEffect(() => {
    if (user && isOpen) {
      loadMessages();
    }
  }, [user, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
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
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      await saveMessage('user', messageText);
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('hackerbuddy-chat', {
        body: {
          message: messageText,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          pendingConfirmation: confirmAction && pendingAction ? true : false,
          confirmedAction: confirmAction ? pendingAction : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      // Handle pending confirmation
      if (data.pendingConfirmation) {
        setPendingAction(data.pendingConfirmation);
      } else {
        setPendingAction(null);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `temp-${Date.now()}-response`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        pendingConfirmation: data.pendingConfirmation,
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage('assistant', data.response);

    } catch (error) {
      console.error('HackerBuddy error:', error);
      const errorMessage: Message = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant',
        content: "I'm having trouble right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
    setMessages(prev => [...prev, rejectMessage]);
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
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-8 w-8"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              <Button
                onClick={handleConfirm}
                size="sm"
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                Yes, proceed
              </Button>
              <Button
                onClick={handleReject}
                variant="outline"
                size="sm"
                className="flex-1"
              >
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
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !input.trim() || !!pendingAction}
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
