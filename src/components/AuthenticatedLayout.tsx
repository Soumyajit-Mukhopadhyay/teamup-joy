import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import AppSidebar from '@/components/AppSidebar';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  className?: string;
  containerClassName?: string;
}

const AuthenticatedLayout = ({
  children,
  showFooter = true,
  className,
  containerClassName,
}: AuthenticatedLayoutProps) => {
  const { user } = useAuth();

  return (
    <div className={cn('min-h-screen flex flex-col bg-background', className)}>
      <Header />
      {user && <AppSidebar />}
      
      <main
        className={cn(
          'flex-1 transition-all duration-300',
          // Always reserve space for collapsed sidebar (w-16 = 4rem) when logged in
          // This ensures content doesn't go under the sidebar
          user && 'md:ml-16',
          containerClassName
        )}
      >
        {children}
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
};

export default AuthenticatedLayout;
