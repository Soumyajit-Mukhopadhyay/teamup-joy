import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Paperclip, ArrowLeft, Download, File, Image as ImageIcon, FileText, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface Message {
  id: string;
  team_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  profile?: {
    username: string;
    userid: string;
  };
}

interface TeamMember {
  user_id: string;
  role: string;
  profile: {
    username: string;
    userid: string;
  };
}

const TeamChat = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchTeamData();
    fetchMessages();

    // Subscribe to realtime messages
    const channel = supabase
      .channel(`team-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, userid')
            .eq('user_id', newMsg.user_id)
            .maybeSingle();

          setMessages(prev => [...prev, { ...newMsg, profile: profile || undefined }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, teamId, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTeamData = async () => {
    if (!teamId) return;

    // Fetch team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .maybeSingle();

    if (team) {
      setTeamName(team.name);
    }

    // Fetch team members
    const { data: memberData } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (memberData) {
      const userIds = memberData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', userIds);

      const membersWithProfiles = memberData.map(m => ({
        ...m,
        profile: profiles?.find(p => p.user_id === m.user_id) || { username: 'Unknown', userid: 'unknown' }
      }));

      setMembers(membersWithProfiles);
    }
  };

  const fetchMessages = async () => {
    if (!teamId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load messages');
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch profiles for all messages
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', userIds);

      const messagesWithProfiles = data.map(msg => ({
        ...msg,
        profile: profiles?.find(p => p.user_id === msg.user_id)
      }));

      setMessages(messagesWithProfiles);
    }

    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !teamId) return;

    setSending(true);

    const { error } = await supabase
      .from('messages')
      .insert({
        team_id: teamId,
        user_id: user.id,
        content: newMessage.trim(),
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
    }

    setSending(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !teamId) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only images, PDFs, and documents are allowed');
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('team-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('team-files')
        .getPublicUrl(fileName);

      // Send message with file
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          team_id: teamId,
          user_id: user.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        });

      if (msgError) throw msgError;

      toast.success('File uploaded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5" />;
    if (fileType === 'application/pdf') return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Chat Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-16 z-40">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/teams')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{teamName}</h1>
              <p className="text-xs text-muted-foreground">{members.length} members</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMembers(!showMembers)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Members
          </Button>
        </div>
      </div>

      <div className="flex-1 container flex gap-4 py-4 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col glass-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.user_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={`text-xs ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {msg.profile?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-medium">{msg.profile?.username || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </span>
                      </div>
                      {msg.content && (
                        <div className={`rounded-lg px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                      {msg.file_url && (
                        <div className={`rounded-lg p-3 mt-1 ${isOwn ? 'bg-primary/20' : 'bg-secondary'}`}>
                          {msg.file_type?.startsWith('image/') ? (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.file_url}
                                alt={msg.file_name || 'Image'}
                                className="max-w-full max-h-48 rounded"
                              />
                            </a>
                          ) : (
                            <a
                              href={msg.file_url}
                              download={msg.file_name}
                              className="flex items-center gap-2 text-sm hover:underline"
                            >
                              {getFileIcon(msg.file_type || '')}
                              <span className="truncate max-w-[150px]">{msg.file_name}</span>
                              <Download className="h-4 w-4 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 input-dark"
                disabled={sending}
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="btn-gradient"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {uploading && (
              <p className="text-xs text-muted-foreground mt-2">Uploading file...</p>
            )}
          </div>
        </div>

        {/* Members Sidebar */}
        {showMembers && (
          <div className="w-64 glass-card p-4 hidden lg:block">
            <h3 className="font-semibold mb-4">Team Members</h3>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {member.profile.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.profile.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role === 'leader' ? '👑 Leader' : 'Member'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamChat;
