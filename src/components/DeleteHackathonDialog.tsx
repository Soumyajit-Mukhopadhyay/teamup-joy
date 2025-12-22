import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteHackathonDialogProps {
  hackathonId: string;
  hackathonName: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteHackathonDialog = ({
  hackathonId,
  hackathonName,
  isOpen,
  onClose,
  onDeleted,
}: DeleteHackathonDialogProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    const { error } = await supabase
      .from('hackathons')
      .delete()
      .eq('id', hackathonId);

    setDeleting(false);

    if (error) {
      toast.error('Failed to delete hackathon: ' + error.message);
      return;
    }

    toast.success('Hackathon deleted successfully!');
    onDeleted();
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Hackathon</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{hackathonName}"? This action cannot be undone.
            All teams created for this hackathon will remain in users' profiles.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteHackathonDialog;
