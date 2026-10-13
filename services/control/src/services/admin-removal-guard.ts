import type { AdminOptions } from 'better-auth/plugins/admin';
import { defaultRoles } from 'better-auth/plugins/admin/access';
import { Result } from '@praha/byethrow';
import { ensureNotSoleOwner } from './sole-ownership.js';
import { DatabaseError } from '../db/database.error.js';
import { SoleOwnerError } from '../errors/sole-owner.error.js';

const REMOVE_USER_PATH = '/admin/remove-user';
const DEFAULT_USER_ROLE = 'user';
const ROLE_SEPARATOR = ',';
const REMOVE_USERS_PERMISSION = { user: ['delete'] };

type CallerSession = { user: { id: string; role?: string | null } } | null;

export type AdminUserRemoval = {
  path: string;
  body: unknown;
  getSession: () => Promise<CallerSession>;
  adminOptions?: AdminOptions;
};

type GuardError = DatabaseError | SoleOwnerError;

const toSessionReadError = (error: unknown) =>
  new DatabaseError({ entity: 'session', operation: 'read', error: error as Error });

export async function guardAdminUserRemoval(
  request: AdminUserRemoval,
): Result.ResultAsync<void, GuardError> {
  if (request.path !== REMOVE_USER_PATH) return Result.succeed();
  const targetUserId = readTargetUserId(request.body);
  if (!targetUserId) return Result.succeed();
  return Result.pipe(
    Result.try({ try: request.getSession, catch: toSessionReadError }),
    Result.andThen((session) =>
      session && canRemoveUsers(session.user, request.adminOptions)
        ? ensureNotSoleOwner(targetUserId)
        : Result.succeed(),
    ),
  );
}

function readTargetUserId(body: unknown): string | undefined {
  const userId = (body as { userId?: unknown } | undefined)?.userId;
  return typeof userId === 'string' && userId !== '' ? userId : undefined;
}

function canRemoveUsers(user: NonNullable<CallerSession>['user'], options?: AdminOptions): boolean {
  if (options?.adminUserIds?.includes(user.id)) return true;
  const roles = options?.roles ?? defaultRoles;
  const roleNames = (user.role || options?.defaultRole || DEFAULT_USER_ROLE).split(ROLE_SEPARATOR);
  return roleNames.some(
    (name) => (roles as AdminOptions['roles'])?.[name]?.authorize(REMOVE_USERS_PERMISSION).success,
  );
}
