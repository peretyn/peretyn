import { Result } from '@praha/byethrow';
import { getSessionFromCtx } from 'better-auth/api';
import { DatabaseError } from '../db/database.error.js';
import { logError } from './log.js';

type AuthContext = Parameters<typeof getSessionFromCtx>[0];
type ActiveOrganizationUpdate = { ctx: AuthContext; token: string; organizationId: string };

const toSessionError = (operation: 'read' | 'write') => (error: unknown) =>
  new DatabaseError({ entity: 'session', operation, error: error as Error });

function readSession(ctx: AuthContext) {
  return Result.try({ try: () => getSessionFromCtx(ctx), catch: toSessionError('read') });
}

function writeActiveOrganization({ ctx, token, organizationId }: ActiveOrganizationUpdate) {
  return Result.pipe(
    Result.try({
      try: () =>
        ctx.context.internalAdapter.updateSession(token, { activeOrganizationId: organizationId }),
      catch: toSessionError('write'),
    }),
    Result.map(() => undefined),
  );
}

async function restoreActiveOrganization(
  organizationId: string,
  ctx: AuthContext,
): Result.ResultAsync<void, DatabaseError> {
  return Result.pipe(
    readSession(ctx),
    Result.andThen((session) =>
      session?.session.activeOrganizationId === organizationId
        ? writeActiveOrganization({ ctx, token: session.session.token, organizationId })
        : Result.succeed(),
    ),
  );
}

export async function keepActiveOrganization(
  organizationId: string,
  ctx?: AuthContext,
): Result.ResultAsync<void, never> {
  if (!ctx) return Result.succeed();
  return Result.pipe(
    restoreActiveOrganization(organizationId, ctx),
    Result.inspectError((error) =>
      logError('could not restore the active organization', { organizationId, error }),
    ),
    Result.orElse(() => Result.succeed()),
  );
}
