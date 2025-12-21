import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Shield, Bell, Clock, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface PendingHackathon {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  region: string;
  location: string;
  url: string | null;
  organizer: string | null;
  tags: string[] | null;
  status: string;
  submitted_by: string | null;
  created_at: string;
  submitter_profile?: {
    username: string;
    userid: string;
  };
}

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [pendingHackathons, setPendingHackathons] = useState<PendingHackathon[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hackathons' | 'notifications'>('hackathons');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }

    checkAdminRole();
  }, [user, authLoading, navigate]);

  const checkAdminRole = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (error || !data) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/');
      return;
    }

    setIsAdmin(true);
    setCheckingRole(false);
    fetchData();
  };

  const fetchData = async () => {
    await Promise.all([fetchPendingHackathons(), fetchNotifications()]);
    setLoading(false);
  };

  const fetchPendingHackathons = async () => {
    const { data, error } = await supabase
      .from('hackathons')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load pending hackathons');
      return;
    }

    // Fetch submitter profiles
    if (data && data.length > 0) {
      const submitterIds = data.filter(h => h.submitted_by).map(h => h.submitted_by);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, userid')
        .in('user_id', submitterIds);

      const hackathonsWithProfiles = data.map(h => ({
        ...h,
        submitter_profile: profiles?.find(p => p.user_id === h.submitted_by)
      }));

      setPendingHackathons(hackathonsWithProfiles);
    } else {
      setPendingHackathons([]);
    }
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to load notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const handleApprove = async (hackathon: PendingHackathon) => {
    if (!user) return;

    const { error } = await supabase
      .from('hackathons')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', hackathon.id);

    if (error) {
      toast.error('Failed to approve hackathon');
      return;
    }

    toast.success(`"${hackathon.name}" has been approved!`);
    setPendingHackathons(prev => prev.filter(h => h.id !== hackathon.id));
  };

  const handleReject = async (hackathon: PendingHackathon) => {
    if (!user) return;

    const { error } = await supabase
      .from('hackathons')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', hackathon.id);

    if (error) {
      toast.error('Failed to reject hackathon');
      return;
    }

    toast.success(`"${hackathon.name}" has been rejected`);
    setPendingHackathons(prev => prev.filter(h => h.id !== hackathon.id));
  };

  const markNotificationRead = async (notificationId: string) => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center text-muted-foreground">
          Checking permissions...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Manage hackathon submissions and notifications</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'hackathons' ? 'default' : 'outline'}
            onClick={() => setActiveTab('hackathons')}
            className="gap-2"
          >
            <Clock className="h-4 w-4" />
            Pending Hackathons
            {pendingHackathons.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingHackathons.length}</Badge>
            )}
          </Button>
          <Button
            variant={activeTab === 'notifications' ? 'default' : 'outline'}
            onClick={() => setActiveTab('notifications')}
            className="gap-2"
          >
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">{unreadCount}</Badge>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading...</div>
        ) : activeTab === 'hackathons' ? (
          pendingHackathons.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No pending hackathon submissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingHackathons.map((hackathon) => (
                <div key={hackathon.id} className="glass-card p-5 animate-fade-in">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{hackathon.name}</h3>
                      {hackathon.description && (
                        <p className="text-sm text-muted-foreground mt-1">{hackathon.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary">{hackathon.region}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(hackathon.start_date), 'MMM d')} - {format(new Date(hackathon.end_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{hackathon.location}</span>
                    </div>
                  </div>

                  {hackathon.tags && hackathon.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {hackathon.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      Submitted by{' '}
                      <span className="text-primary">
                        @{hackathon.submitter_profile?.userid || 'unknown'}
                      </span>
                      {' · '}
                      {format(new Date(hackathon.created_at), 'MMM d, yyyy')}
                    </div>

                    <div className="flex gap-2">
                      {hackathon.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(hackathon.url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(hackathon)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(hackathon)}
                        className="btn-gradient"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          notifications.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`glass-card p-4 cursor-pointer transition-opacity ${notification.is_read ? 'opacity-60' : ''}`}
                  onClick={() => markNotificationRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      {notification.message && (
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default AdminPanel;