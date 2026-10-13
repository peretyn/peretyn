'use client';

import { type SyntheticEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@peretyn/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@peretyn/ui/components/dialog';
import { useCreateProject } from '@/lib/control/projects';
import type { CreatedEnvironment } from '@/lib/control/types';
import { ControlError } from '@/lib/control/client';
import { Callout } from '@/components/callout';
import { CreateProjectForm, sanitizeSlug, trimHyphens } from './create-project-form';
import { KeyReveal } from './key-reveal';

type CreatedProject = {
  projectId: string;
  environments: CreatedEnvironment[];
};

type CreateProjectDialogProps = {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function toCreatedProject(result: {
  project: { id: string };
  environments: CreatedEnvironment[];
}): CreatedProject {
  return { projectId: result.project.id, environments: result.environments };
}

function describeCreateError(error: Error): string {
  return error instanceof ControlError ? error.message : 'Failed to create project.';
}

function useProjectDraft() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const changeName = (value: string) => {
    setName(value);
    setSlug(trimHyphens(sanitizeSlug(value)));
  };
  const resetDraft = () => {
    setName('');
    setSlug('');
  };

  return { name, slug, finalSlug: trimHyphens(slug), setSlug, changeName, resetDraft };
}

function useCreateProjectDialog({
  organizationId,
  onOpenChange,
}: Pick<CreateProjectDialogProps, 'organizationId' | 'onOpenChange'>) {
  const { name, slug, finalSlug, setSlug, changeName, resetDraft } = useProjectDraft();
  const [created, setCreated] = useState<CreatedProject | null>(null);
  const [error, setError] = useState<string>();

  const { mutate: createProject, isPending } = useCreateProject(organizationId);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetDraft();
      setCreated(null);
      setError(undefined);
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(undefined);
    createProject(
      { slug: finalSlug, name },
      {
        onSuccess: (result) => setCreated(toCreatedProject(result)),
        onError: (err) => setError(describeCreateError(err)),
      },
    );
  };

  const formProps = {
    name,
    slug,
    error,
    isPending,
    isSubmittable: Boolean(name) && Boolean(finalSlug),
    onNameChange: changeName,
    onSlugChange: setSlug,
    onSubmit: handleSubmit,
    onCancel: () => handleOpenChange(false),
  };

  return { created, formProps, handleOpenChange };
}

export function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const { created, formProps, handleOpenChange } = useCreateProjectDialog({
    organizationId,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {created ? (
          <CreatedView
            environments={created.environments}
            onDone={() => {
              handleOpenChange(false);
              router.push(`/projects/${created.projectId}/overview`);
            }}
          />
        ) : (
          <CreateProjectForm {...formProps} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatedView({
  environments,
  onDone,
}: {
  environments: CreatedEnvironment[];
  onDone: () => void;
}) {
  const ordered = [...environments].sort((a, b) => Number(b.isProduction) - Number(a.isProduction));

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Project created</DialogTitle>
        <DialogDescription>Your project and its environments are ready.</DialogDescription>
      </DialogHeader>

      <Callout>
        <p className="font-medium">Copy these keys now.</p>
        <p>They are shown once and can&apos;t be retrieved later.</p>
      </Callout>

      <div className="flex flex-col gap-4">
        {ordered.map((environment) => (
          <KeyReveal
            key={environment.id}
            label={environment.isProduction ? 'Production key' : 'Development key'}
            value={environment.plaintext}
          />
        ))}
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Go to project</Button>
      </DialogFooter>
    </div>
  );
}
