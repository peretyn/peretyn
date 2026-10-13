import { Hono } from 'hono';
import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { errorResponse, foldToResponse } from '../lib/respond.js';
import { rotateEnvironmentKey } from '../features/project/rotate-environment-key.feature.js';
import { assertEnvironmentAccess } from '../services/authz.js';
import { getApiTokenByEnvironmentId } from '../repositories/api-token.repository.js';
import { environmentParam } from './params.js';
import type { AuthVariables } from '../middleware/protect-route.js';

export const keysRoute = new Hono<{ Variables: AuthVariables }>();

keysRoute.get('/:projectId/environments/:envId/key', environmentParam, async (c) => {
  const user = c.get('user');
  const { projectId, envId } = c.req.valid('param');
  return Result.pipe(
    assertEnvironmentAccess({ projectId, envId, userId: user.id }),
    Result.andThen(() => getApiTokenByEnvironmentId(envId)),
    Result.map((key) => c.json(key, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

keysRoute.post('/:projectId/environments/:envId/key/rotate', environmentParam, async (c) => {
  const user = c.get('user');
  const { projectId, envId } = c.req.valid('param');
  return Result.pipe(
    assertEnvironmentAccess({ projectId, envId, userId: user.id }),
    Result.andThen(() => rotateEnvironmentKey({ projectId, envId })),
    Result.map((key) => c.json(key, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});
