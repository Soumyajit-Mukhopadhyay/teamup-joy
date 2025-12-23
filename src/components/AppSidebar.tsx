import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Home,
  Users,
  UserPlus,
  Bell,
  User,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import useIsAdmin from '@/hooks/useIsAdmin';
import { useNotifications } from '@/hooks/useNotifications';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { unreadCount, hasNotification } = useNotifications();
  
  // Initialize from localStorage to persist across navigations
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  if (!user) return null;

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'My Teams', icon: Users, path: '/teams' },
    { label: 'Find Teammates', icon: UserPlus, path: '/looking-for-teammates' },
    { label: 'Friends', icon: MessageCircle, path: '/friends' },
    { label: 'Notifications', icon: Bell, path: '/notifications', badge: hasNotification ? unreadCount : undefined },
    { label: 'Profile', icon: User, path: '/profile' },
  ];

  if (isAdmin) {
    navItems.push({ label: 'Admin', icon: Shield, path: '/admin' });
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-20 left-4 z-40 md:hidden bg-background/80 backdrop-blur-sm border border-border shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] bg-background border-r border-border transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Mobile Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-2 right-2 md:hidden"
        >
          <X className="h-4 w-4" />
        </Button>

        <ScrollArea className="h-full py-4">
          <nav className="flex flex-col gap-2 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Button
                  key={item.path}
                  variant={active ? 'secondary' : 'ghost'}
                  onClick={() => handleNavClick(item.path)}
                  className={cn(
                    'justify-start gap-3 relative',
                    isCollapsed && 'justify-center px-2',
                    active && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                  {item.badge && item.badge > 0 && (
                    <span
                      className={cn(
                        'min-w-[1.25rem] h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center px-1',
                        isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 hidden md:flex h-6 w-6 rounded-full bg-background border border-border shadow-sm"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </aside>
    </>
  );
};

export default AppSidebar;
