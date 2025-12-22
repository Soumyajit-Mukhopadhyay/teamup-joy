import { Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full py-4 mt-auto border-t border-border bg-card/50">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Mail className="h-4 w-4" />
          If you want to collaborate or have any queries, email to{' '}
          <a 
            href="mailto:soumyajitmukhopadhyay7@gmail.com" 
            className="text-primary hover:underline"
          >
            soumyajitmukhopadhyay7@gmail.com
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
