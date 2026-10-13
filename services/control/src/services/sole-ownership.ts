import { Result } from '@praha/byethrow';
import { isOwnerRole } from '@peretyn/org-roles';
import {
  getMembersOfUserOrganizations,
  OrganizationMember,
} from '../repositories/member.repository.js';
import { DatabaseError } from '../db/database.error.js';
import { SoleOwnedOrganization, SoleOwnerError } from '../errors/sole-owner.error.js';

export function findSoleOwnedOrganizations(
  userId: string,
  members: OrganizationMember[],
): SoleOwnedOrganization[] {
  const hasOtherOwner = (organizationId: string) =>
    members.some(
      (m) => m.organizationId === organizationId && m.userId !== userId && isOwnerRole(m.role),
    );
  return members
    .filter((m) => m.userId === userId && isOwnerRole(m.role))
    .filter((m) => !hasOtherOwner(m.organizationId))
    .map((m) => ({ id: m.organizationId, name: m.organizationName }));
}

function failIfAnySoleOwned(organizations: SoleOwnedOrganization[]) {
  return organizations.length === 0
    ? Result.succeed()
    : Result.fail(new SoleOwnerError({ organizations }));
}

export function ensureNotSoleOwner(
  userId: string,
): Result.ResultAsync<void, DatabaseError | SoleOwnerError> {
  return Result.pipe(
    getMembersOfUserOrganizations(userId),
    Result.map((members) => findSoleOwnedOrganizations(userId, members)),
    Result.andThen(failIfAnySoleOwned),
  );
}
