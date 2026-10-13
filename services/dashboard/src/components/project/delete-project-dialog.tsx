'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@peretyn/ui/components/alert-dialog';
import { Spinner } from '@peretyn/ui/components/spinner';
import { useDeleteProject } from '@/lib/control/projects';
import { ControlError } from '@/lib/control/client';
import type { Project } from '@/lib/control/types';

type DeleteProjectDialogProps = {
  organizationId: string;
  project: Project | null;
  onOpenChange: (open: boolean) => void;
};

function useConfirmDeleteProject({
  organizationId,
  project,
  onOpenChange,
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate: deleteProject, isPending } = useDeleteProject(organizationId);

  const confirmDelete = () => {
    if (!project) return;
    deleteProject(project.id, {
      onSuccess: () => {
        toast.success(`Deleted ${project.name}`);
        onOpenChange(false);
        if (pathname.startsWith(`/projects/${project.id}`)) router.push('/');
      },
      onError: (error) =>
        toast.error(error instanceof ControlError ? error.message : 'Failed to delete project'),
    });
  };

  return { confirmDelete, isPending };
}

export function DeleteProjectDialog(props: DeleteProjectDialogProps) {
  const { project, onOpenChange } = props;
  const { confirmDelete, isPending } = useConfirmDeleteProject(props);

  return (
    <AlertDialog open={Boolean(project)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {project?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project, both environments, their stores, tuples, and API
            keys. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              confirmDelete();
            }}
          >
            {isPending && <Spinner />}
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
