'use client';

import type { SyntheticEvent } from 'react';

import { Button } from '@peretyn/ui/components/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@peretyn/ui/components/dialog';
import { Input } from '@peretyn/ui/components/input';
import { Label } from '@peretyn/ui/components/label';
import { Spinner } from '@peretyn/ui/components/spinner';

const MAX_SLUG_LENGTH = 63;

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH);
}

export function trimHyphens(value: string): string {
  return value.replace(/^-+|-+$/g, '');
}

type CreateProjectFormProps = {
  name: string;
  slug: string;
  error: string | undefined;
  isPending: boolean;
  isSubmittable: boolean;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

function NameField({
  name,
  isPending,
  onNameChange,
}: Pick<CreateProjectFormProps, 'name' | 'isPending' | 'onNameChange'>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="create-project-name">Name</Label>
      <Input
        id="create-project-name"
        autoFocus
        required
        placeholder="docs-service"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        disabled={isPending}
      />
    </div>
  );
}

function SlugField({
  slug,
  error,
  isPending,
  onSlugChange,
}: Pick<CreateProjectFormProps, 'slug' | 'error' | 'isPending' | 'onSlugChange'>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="create-project-slug">Slug</Label>
      <Input
        id="create-project-slug"
        required
        className="font-mono"
        placeholder="docs-service"
        value={slug}
        onChange={(e) => onSlugChange(sanitizeSlug(e.target.value))}
        disabled={isPending}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function CreateProjectFields(
  props: Pick<
    CreateProjectFormProps,
    'name' | 'slug' | 'error' | 'isPending' | 'onNameChange' | 'onSlugChange'
  >,
) {
  return (
    <div className="flex flex-col gap-4">
      <NameField {...props} />
      <SlugField {...props} />
    </div>
  );
}

export function CreateProjectForm({
  isSubmittable,
  onSubmit,
  onCancel,
  ...fieldProps
}: CreateProjectFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Create project</DialogTitle>
        <DialogDescription>
          A project gets a production and a development environment, each with its own store and API
          key.
        </DialogDescription>
      </DialogHeader>

      <CreateProjectFields {...fieldProps} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={fieldProps.isPending || !isSubmittable}>
          {fieldProps.isPending && <Spinner />}
          Create project
        </Button>
      </DialogFooter>
    </form>
  );
}
