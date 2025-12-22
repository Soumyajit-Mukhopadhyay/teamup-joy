import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AddHackathonModalProps {
  onAdd?: (hackathon: any) => void;
}

const AddHackathonModal = ({ onAdd }: AddHackathonModalProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    region: 'Global',
    platform: 'Official Site',
    location: '',
    url: '',
    tags: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in required fields');
      return;
    }

    if (!user) {
      toast.error('Please sign in to submit a hackathon');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.from('hackathons').insert({
        name: formData.name,
        description: formData.description || null,
        start_date: new Date(formData.startDate).toISOString(),
        end_date: new Date(formData.endDate).toISOString(),
        region: formData.region,
        location: formData.location || 'Online',
        url: formData.url || null,
        organizer: formData.platform,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        is_global: formData.region === 'Global',
        status: 'pending',
        submitted_by: user.id,
      }).select().single();

      if (error) throw error;

      // Send email notification to admins
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('userid')
          .eq('user_id', user.id)
          .maybeSingle();

        await supabase.functions.invoke('notify-hackathon-submission', {
          body: {
            hackathon_id: data.id,
            hackathon_name: formData.name,
            submitter_username: profile?.userid || 'unknown',
          },
        });
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
        // Don't fail the submission if email fails
      }

      toast.success('Hackathon submitted for admin approval!');
      setOpen(false);
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        region: 'Global',
        platform: 'Official Site',
        location: '',
        url: '',
        tags: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit hackathon');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-gradient gap-2">
          <Plus className="h-4 w-4" />
          Add Hackathon
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Hackathon</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Hackathon Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. HackOn 2026"
              className="input-dark border-primary/50 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief details about the event..."
              className="input-dark min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="input-dark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="input-dark"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={formData.region} onValueChange={(v) => handleChange('region', v)}>
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={formData.platform} onValueChange={(v) => handleChange('platform', v)}>
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Official Site">Official Site</SelectItem>
                  <SelectItem value="Devpost">Devpost</SelectItem>
                  <SelectItem value="Unstop">Unstop</SelectItem>
                  <SelectItem value="MLH">MLH</SelectItem>
                  <SelectItem value="Kaggle">Kaggle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Online / City, Country"
              className="input-dark"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="https://..."
              className="input-dark"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="AI, Blockchain, Web Dev"
              className="input-dark"
            />
          </div>

          <Button type="submit" className="w-full btn-gradient" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your submission will be reviewed by an admin before appearing publicly.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddHackathonModal;
