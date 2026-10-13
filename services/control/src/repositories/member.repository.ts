import { Result } from '@praha/byethrow';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { DatabaseError } from '../db/database.error.js';

export type Membership = { organizationId: string; userId: string; role: string };

export type OrganizationMember = Membership & { organizationName: string };

const toReadError = (error: unknown) =>
  new DatabaseError({ entity: 'member', operation: 'read', error: error as Error });

export async function getMembership(
  organizationId: string,
  userId: string,
): Result.ResultAsync<Membership | null, DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () =>
        db()
          .select()
          .from(schema.member)
          .where(
            and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, userId)),
          ),
      catch: toReadError,
    }),
    Result.map(([row]) =>
      row ? { organizationId: row.organizationId, userId: row.userId, role: row.role } : null,
    ),
  );
}

const organizationMemberColumns = {
  organizationId: schema.member.organizationId,
  organizationName: schema.organization.name,
  userId: schema.member.userId,
  role: schema.member.role,
};

export async function getMembersOfUserOrganizations(
  userId: string,
): Result.ResultAsync<OrganizationMember[], DatabaseError> {
  const userOrganizationIds = db()
    .select({ id: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  return Result.try({
    try: () =>
      db()
        .select(organizationMemberColumns)
        .from(schema.member)
        .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
        .where(inArray(schema.member.organizationId, userOrganizationIds)),
    catch: toReadError,
  });
}
