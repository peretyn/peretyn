import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { errorResponse, foldToResponse } from '../lib/respond.js';
import { assertEnvironmentAccess } from '../services/authz.js';
import { getSchemaVersionsByEnvironmentId } from '../repositories/schema-version.repository.js';
import { environmentParam } from './params.js';
import type { AuthVariables } from '../middleware/protect-route.js';

export const schemasRoute = new Hono<{ Variables: AuthVariables }>();

schemasRoute.get('/:projectId/environments/:envId/schemas', environmentParam, async (c) => {
  const user = c.get('user');
  const { projectId, envId } = c.req.valid('param');
  return Result.pipe(
    assertEnvironmentAccess({ projectId, envId, userId: user.id }),
    Result.andThen(() => getSchemaVersionsByEnvironmentId(envId)),
    Result.map((schemas) => c.json({ schemas }, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});
