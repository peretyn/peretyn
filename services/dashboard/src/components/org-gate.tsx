'use client';

import { useState } from 'react';
import { Briefcase } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import { CreateOrganizationDialog } from './auth/organization/create-organization-dialog';
import { UserInvitations } from './auth/organization/user-invitations';

export function OrgGate() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Briefcase className="size-5" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Set up your workspace</h2>
          <p className="text-sm text-muted-foreground">
            Create an organization, or accept an invitation from your admin to get started.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>Create organization</Button>
      </div>

      <UserInvitations />

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
