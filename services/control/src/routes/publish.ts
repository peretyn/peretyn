import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { errorResponse, foldToResponse } from '../lib/respond.js';
import { resolveEnvironmentByKey } from '../features/schema/resolve-environment-by-key.feature.js';
import { publishSchema } from '../features/schema/publish-schema.feature.js';
import { getLatestSchemaVersionByEnvironmentId } from '../repositories/schema-version.repository.js';
import { diffModels, openFGAModel } from '../lib/openfga-model.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { Environment } from '../domain/environment.entity.js';

const MAX_LABEL_LENGTH = 80;
const MAX_DSL_LENGTH = 50_000;

type KeyVariables = { environment: Environment };

const authenticateEnvKey = createMiddleware<{ Variables: KeyVariables }>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const key = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!key) return c.json({ message: 'missing bearer env key' }, StatusCodes.UNAUTHORIZED);
  const resolved = await resolveEnvironmentByKey(key);
  if (Result.isFailure(resolved)) {
    return resolved.error instanceof ForbiddenError
      ? c.json({ message: resolved.error.message }, StatusCodes.UNAUTHORIZED)
      : errorResponse(c, resolved.error);
  }
  c.set('environment', resolved.value);
  await next();
});

export const publishRoute = new Hono<{ Variables: KeyVariables }>();
publishRoute.use('*', authenticateEnvKey);

const publishInput = z.object({
  label: z.string().min(1).max(MAX_LABEL_LENGTH),
  model: openFGAModel,
  dsl: z.string().min(1).max(MAX_DSL_LENGTH),
});

publishRoute.post('/schema', zValidator('json', publishInput), async (c) => {
  const { label, model, dsl } = c.req.valid('json');
  return Result.pipe(
    publishSchema({
      environment: c.get('environment'),
      label,
      model,
      dsl,
      publishedBy: 'peretyn-cli',
    }),
    Result.map((schemaVersion) => c.json({ schemaVersion }, StatusCodes.CREATED)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

const planInput = z.object({ model: openFGAModel });

publishRoute.post('/schema/plan', zValidator('json', planInput), async (c) => {
  const { model } = c.req.valid('json');
  return Result.pipe(
    getLatestSchemaVersionByEnvironmentId(c.get('environment').id),
    Result.map((latest) => c.json(diffModels(latest?.modelJson ?? null, model), StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});
