import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, ArrowLeft, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  signedFileUrl?: string | null;
}

interface Profile {
  user_id: string;
  username: string;
  userid: string;
}

const FriendChat = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchFriendProfile();
    fetchMessages();
    subscribeToMessages();
  }, [user, friendId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchFriendProfile = async () => {
    if (!friendId) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, userid')
      .eq('user_id', friendId)
      .single();
    if (data) setFriendProfile(data);
  };

  const fetchMessages = async () => {
    if (!user || !friendId) return;

    const { data, error } = await supabase
      .from('friend_messages')
      .select('*')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load messages');
    } else {
      // Generate signed URLs for file attachments
      const messagesWithSignedUrls = await Promise.all(
        (data || []).map(async (msg) => {
          if (msg.file_url) {
            const { data: signedData } = await supabase.storage
              .from('team-files')
              .createSignedUrl(msg.file_url, 3600);
            return { ...msg, signedFileUrl: signedData?.signedUrl || null };
          }
          return { ...msg, signedFileUrl: null };
        })
      );
      setMessages(messagesWithSignedUrls);
    }
  };

  const subscribeToMessages = () => {
    if (!user || !friendId) return;

    const channel = supabase
      .channel('friend-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_messages',
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.from_user_id === user.id && newMsg.to_user_id === friendId) ||
            (newMsg.from_user_id === friendId && newMsg.to_user_id === user.id)
          ) {
            // Generate signed URL for file attachments
            if (newMsg.file_url) {
              const { data: signedData } = await supabase.storage
                .from('team-files')
                .createSignedUrl(newMsg.file_url, 3600);
              newMsg.signedFileUrl = signedData?.signedUrl || null;
            }
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || !friendId) return;

    setSending(true);

    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `friends/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('team-files')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        // Store the file path (not public URL) for signed URL generation later
        fileUrl = filePath;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }

      const { error } = await supabase
        .from('friend_messages')
        .insert({
          from_user_id: user.id,
          to_user_id: friendId,
          content: newMessage.trim() || null,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
        });

      if (error) throw error;

      setNewMessage('');
      setSelectedFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const renderMessage = (message: Message) => {
    const isOwn = message.from_user_id === user?.id;
    const isImage = message.file_type?.startsWith('image/');

    const displayUrl = message.signedFileUrl || null;

    return (
      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
          <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
            {message.file_url && displayUrl && (
              <div className="mb-2">
                {isImage ? (
                  <img src={displayUrl} alt={message.file_name || 'Image'} className="max-w-full rounded-lg" />
                ) : (
                  <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline">
                    <FileText className="h-4 w-4" />
                    {message.file_name}
                  </a>
                )}
              </div>
            )}
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
            {format(new Date(message.created_at), 'h:mm a')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Chat Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-lg sticky top-16 z-40">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/friends')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/20 text-primary">
              {friendProfile?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{friendProfile?.username}</h2>
            <p className="text-xs text-muted-foreground">@{friendProfile?.userid}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 container py-4 overflow-y-auto">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-lg sticky bottom-0">
        <div className="container py-4">
          {selectedFile && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-secondary rounded-lg">
              {selectedFile.type.startsWith('image/') ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 input-dark"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || (!newMessage.trim() && !selectedFile)} className="btn-gradient">
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FriendChat;
