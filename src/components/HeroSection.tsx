import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';

const HeroSection = () => {
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Hackathon submitted for review!');
    setOpen(false);
  };

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
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '200ms' }}>
          Discover the biggest hackathons in India and worldwide. Track dates, join teams, and build the future.
        </p>

        {/* CTA */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient gap-2 animate-slide-up" size="lg" style={{ animationDelay: '300ms' }}>
              <Plus className="h-5 w-5" />
              Add Hackathon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit a Hackathon</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Hackathon Name</Label>
                <Input id="name" placeholder="e.g. ETHGlobal Mumbai" className="input-dark" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input id="url" type="url" placeholder="https://..." className="input-dark" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" className="input-dark" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" className="input-dark" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Brief description..." className="input-dark" rows={3} />
              </div>
              <Button type="submit" className="w-full btn-gradient">
                Submit Hackathon
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default HeroSection;
