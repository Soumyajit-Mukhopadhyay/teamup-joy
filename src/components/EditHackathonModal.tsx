import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditHackathonModalProps {
  hackathon: {
    id: string;
    name: string;
    organizer: string;
    region: string;
    tags: string[];
    startDate: string;
    endDate: string;
    location: string;
    description: string;
    url: string;
    isGlobal: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const EditHackathonModal = ({ hackathon, isOpen, onClose, onUpdated }: EditHackathonModalProps) => {
  const [name, setName] = useState(hackathon.name);
  const [organizer, setOrganizer] = useState(hackathon.organizer);
  const [region, setRegion] = useState(hackathon.region);
  const [location, setLocation] = useState(hackathon.location);
  const [description, setDescription] = useState(hackathon.description);
  const [url, setUrl] = useState(hackathon.url);
  const [startDate, setStartDate] = useState(hackathon.startDate.split('T')[0]);
  const [endDate, setEndDate] = useState(hackathon.endDate.split('T')[0]);
  const [isGlobal, setIsGlobal] = useState(hackathon.isGlobal);
  const [tags, setTags] = useState(hackathon.tags.join(', '));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setLoading(true);
    
    const { error } = await supabase
      .from('hackathons')
      .update({
        name: name.trim(),
        organizer: organizer.trim() || null,
        region: region,
        location: location.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        start_date: startDate,
        end_date: endDate,
        is_global: isGlobal,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq('id', hackathon.id);

    setLoading(false);

    if (error) {
      toast.error('Failed to update hackathon: ' + error.message);
      return;
    }

    toast.success('Hackathon updated successfully!');
    onUpdated();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Hackathon</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hackathon name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="organizer">Organizer</Label>
              <Input
                id="organizer"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="Organization name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="region">Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                  <SelectItem value="North America">North America</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="Asia">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country or Online"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="AI/ML, Web3, Blockchain"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hackathon description"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isGlobal"
              checked={isGlobal}
              onCheckedChange={setIsGlobal}
            />
            <Label htmlFor="isGlobal">Global Event</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditHackathonModal;
