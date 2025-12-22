import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Paperclip, ArrowLeft, Download, File, Image as ImageIcon, FileText, Users, UserPlus, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  signedUrl?: string; // For displaying files with signed URLs
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
  const [friendStatuses, setFriendStatuses] = useState<Record<string, 'none' | 'friend' | 'pending'>>({});

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

          // Generate signed URL if file exists
          let signedUrl: string | undefined;
          if (newMsg.file_url) {
            const { data: signedData } = await supabase.storage
              .from('team-files')
              .createSignedUrl(newMsg.file_url, 3600);
            signedUrl = signedData?.signedUrl;
          }

          setMessages(prev => [...prev, { ...newMsg, profile: profile || undefined, signedUrl }]);
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

    if (memberData && user) {
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

      // Fetch friend statuses for all members (except current user)
      const otherUserIds = userIds.filter(id => id !== user.id);
      if (otherUserIds.length > 0) {
        const statuses: Record<string, 'none' | 'friend' | 'pending'> = {};
        
        // Check existing friends
        const { data: friends } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
        
        // Check pending requests
        const { data: sentRequests } = await supabase
          .from('friend_requests')
          .select('to_user_id')
          .eq('from_user_id', user.id)
          .eq('status', 'pending');
        
        const { data: receivedRequests } = await supabase
          .from('friend_requests')
          .select('from_user_id')
          .eq('to_user_id', user.id)
          .eq('status', 'pending');

        otherUserIds.forEach(id => {
          const isFriend = friends?.some(f => 
            (f.user_id === user.id && f.friend_id === id) || 
            (f.friend_id === user.id && f.user_id === id)
          );
          const isPending = sentRequests?.some(r => r.to_user_id === id) || 
                           receivedRequests?.some(r => r.from_user_id === id);
          
          if (isFriend) {
            statuses[id] = 'friend';
          } else if (isPending) {
            statuses[id] = 'pending';
          } else {
            statuses[id] = 'none';
          }
        });

        setFriendStatuses(statuses);
      }
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

      // Generate signed URLs for messages with files
      const messagesWithProfiles = await Promise.all(
        data.map(async (msg) => {
          let signedUrl: string | undefined;
          if (msg.file_url) {
            // file_url now stores the path, not the public URL
            const { data: signedData } = await supabase.storage
              .from('team-files')
              .createSignedUrl(msg.file_url, 3600);
            signedUrl = signedData?.signedUrl;
          }
          return {
            ...msg,
            profile: profiles?.find(p => p.user_id === msg.user_id),
            signedUrl,
          };
        })
      );

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
      // Organize files by team_id for RLS policy compliance
      const filePath = `${teamId}/${Date.now()}_${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('team-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path (not public URL) for signed URL generation
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          team_id: teamId,
          user_id: user.id,
          file_url: filePath, // Store path, not public URL
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

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: toUserId,
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      setFriendStatuses(prev => ({ ...prev, [toUserId]: 'pending' }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to send friend request');
    }
  };

  // Helper to get signed URL for file access
  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('team-files')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Failed to get signed URL:', error);
      return null;
    }
    return data.signedUrl;
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
                      {msg.file_url && msg.signedUrl && (
                        <div className={`rounded-lg p-3 mt-1 ${isOwn ? 'bg-primary/20' : 'bg-secondary'}`}>
                          {msg.file_type?.startsWith('image/') ? (
                            <a href={msg.signedUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.signedUrl}
                                alt={msg.file_name || 'Image'}
                                className="max-w-full max-h-48 rounded"
                              />
                            </a>
                          ) : (
                            <a
                              href={msg.signedUrl}
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
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const friendStatus = friendStatuses[member.user_id];
                
                return (
                  <div key={member.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {member.profile.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.profile.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.role === 'leader' ? '👑 Leader' : 'Member'}
                          {isCurrentUser && ' (You)'}
                        </p>
                      </div>
                    </div>
                    
                    {!isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Users className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => navigate(`/user/${member.profile.userid}`)}
                            className="gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          {friendStatus === 'none' && (
                            <DropdownMenuItem 
                              onClick={() => sendFriendRequest(member.user_id)}
                              className="gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              Add Friend
                            </DropdownMenuItem>
                          )}
                          {friendStatus === 'pending' && (
                            <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                              <UserPlus className="h-4 w-4" />
                              Request Pending
                            </DropdownMenuItem>
                          )}
                          {friendStatus === 'friend' && (
                            <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                              <Users className="h-4 w-4" />
                              Already Friends
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamChat;
