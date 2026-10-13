import { ErrorFactory } from '@praha/error-factory';

export type SoleOwnedOrganization = { id: string; name: string };

function describeSoleOwnership(organizations: SoleOwnedOrganization[]): string {
  const names = organizations.map((organization) => `"${organization.name}"`).join(', ');
  return `This account is the only owner of ${names}. Make another member an owner, or delete the organization, first.`;
}

export class SoleOwnerError extends ErrorFactory({
  name: 'SoleOwnerError',
  message: ({ organizations }) => describeSoleOwnership(organizations),
  fields: ErrorFactory.fields<{ organizations: SoleOwnedOrganization[] }>(),
}) {}
