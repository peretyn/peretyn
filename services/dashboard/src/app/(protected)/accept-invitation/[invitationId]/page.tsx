'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  type OrganizationAuthClient,
  useAcceptInvitation,
  useAuth,
  useRejectInvitation,
} from '@better-auth-ui/react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@peretyn/ui/components/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@peretyn/ui/components/card';
import { Skeleton } from '@peretyn/ui/components/skeleton';
import { Spinner } from '@peretyn/ui/components/spinner';
import { AppHeader } from '@/components/app-header';
import { QueryError } from '@/components/query-error';

type Invitation = {
  organizationName: string;
  inviterEmail: string;
  role: string;
};

type InvitationMutation = {
  isPending: boolean;
  mutate: (variables: { invitationId: string }) => void;
};

function InvitationCard({
  invitation,
  invitationId,
  accept,
  reject,
}: {
  invitation: Invitation;
  invitationId: string;
  accept: InvitationMutation;
  reject: InvitationMutation;
}) {
  const busy = accept.isPending || reject.isPending;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invitation.organizationName}</CardTitle>
        <CardDescription>
          {invitation.inviterEmail} invited you as {invitation.role}.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => reject.mutate({ invitationId })}>
          {reject.isPending && <Spinner />}
          Decline
        </Button>
        <Button disabled={busy} onClick={() => accept.mutate({ invitationId })}>
          {accept.isPending && <Spinner />}
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
}

function InvitationContent({
  error,
  invitation,
  ...cardProps
}: {
  error: Error | null;
  invitation: Invitation | null | undefined;
  invitationId: string;
  accept: InvitationMutation;
  reject: InvitationMutation;
}) {
  if (error) return <QueryError error={error} />;
  if (invitation) return <InvitationCard invitation={invitation} {...cardProps} />;
  return <Skeleton className="h-36 w-full" />;
}

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = use(params);
  const router = useRouter();
  const { authClient } = useAuth();
  const organizationClient = authClient as OrganizationAuthClient;

  const { data: invitation, error } = useQuery({
    queryKey: ['invitation', invitationId],
    queryFn: () =>
      organizationClient.organization.getInvitation({
        query: { id: invitationId },
        fetchOptions: { throw: true },
      }),
    retry: false,
  });
  const goHome = { onSuccess: () => router.push('/') };
  const accept = useAcceptInvitation(organizationClient, goHome);
  const reject = useRejectInvitation(organizationClient, goHome);

  return (
    <>
      <AppHeader crumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Invitation' }]} />
      <div className="mx-auto w-full max-w-md p-4 md:p-6">
        <InvitationContent
          error={error}
          invitation={invitation}
          invitationId={invitationId}
          accept={accept}
          reject={reject}
        />
      </div>
    </>
  );
}
