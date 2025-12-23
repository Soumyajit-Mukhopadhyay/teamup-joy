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
          'flex-1',
          user && 'md:ml-64 transition-all duration-300',
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
