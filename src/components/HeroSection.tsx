import { Sparkles } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      
      {/* Content */}
      <div className="relative container text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8 animate-slide-up">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">2026 Season Live</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          Hackathon<br />
          <span className="gradient-text">Calendar 2026</span>
        </h1>

        {/* Description */}
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '200ms' }}>
          Discover the biggest hackathons in India and worldwide. Track dates, join teams, and build the future.
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
