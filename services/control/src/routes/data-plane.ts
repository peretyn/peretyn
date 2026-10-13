import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { errorResponse, foldToResponse } from '../lib/respond.js';
import { resolveEnvironmentStore } from '../services/authz.js';
import { RuntimeError } from '../lib/errors/runtime.error.js';
import { runtimeClient, type RuntimeClient } from '../lib/runtime-client.js';
import { environmentParam } from './params.js';
import type { AuthVariables } from '../middleware/protect-route.js';

export const dataPlaneRoute = new Hono<{ Variables: AuthVariables }>();

const MAX_PAGE_SIZE = 100;

type ReadQuery = {
  object?: string;
  user?: string;
  relation?: string;
  pageSize?: number;
  continuationToken?: string;
};

function buildTupleKey(q: ReadQuery) {
  const tupleKey: { user?: string; relation?: string; object?: string } = {};
  if (q.object) tupleKey.object = q.object;
  if (q.user) tupleKey.user = q.user;
  if (q.relation && (q.object || q.user)) tupleKey.relation = q.relation;
  return tupleKey;
}

function buildReadBody(q: ReadQuery) {
  const tupleKey = buildTupleKey(q);
  const body: {
    tuple_key?: typeof tupleKey;
    page_size?: number;
    continuation_token?: string;
  } = {};
  if (Object.keys(tupleKey).length > 0) body.tuple_key = tupleKey;
  if (q.pageSize) body.page_size = q.pageSize;
  if (q.continuationToken) body.continuation_token = q.continuationToken;
  return body;
}

type ReadTuplesResponse = Awaited<ReturnType<RuntimeClient['readTuples']>>;

const toTupleListBody = (res: ReadTuplesResponse) => ({
  tuples: (res.tuples ?? []).map((t) => ({
    user: t.key?.user ?? '',
    relation: t.key?.relation ?? '',
    object: t.key?.object ?? '',
    timestamp: t.timestamp,
  })),
  continuationToken: res.continuation_token || undefined,
});

const tupleInput = z.object({
  user: z.string().min(1),
  relation: z.string().min(1),
  object: z.string().min(1),
});

dataPlaneRoute.post(
  '/:projectId/environments/:envId/check',
  environmentParam,
  zValidator('json', tupleInput),
  async (c) => {
    const user = c.get('user');
    const { projectId, envId } = c.req.valid('param');
    const tuple = c.req.valid('json');
    return Result.pipe(
      resolveEnvironmentStore({ projectId, envId, userId: user.id }),
      Result.andThen(({ openfgaStoreId: storeId }) =>
        Result.try({
          try: () => runtimeClient().checkTuple(storeId, { tuple_key: tuple }),
          catch: (error) => new RuntimeError({ operation: 'checkTuple', error: error as Error }),
        }),
      ),
      Result.map((res) =>
        c.json({ allowed: Boolean(res.allowed), resolution: res.resolution }, StatusCodes.OK),
      ),
      Result.mapError((error) => errorResponse(c, error)),
      foldToResponse,
      Result.unwrap(),
    );
  },
);

const expandInput = z.object({
  relation: z.string().min(1),
  object: z.string().min(1),
});

dataPlaneRoute.post(
  '/:projectId/environments/:envId/expand',
  environmentParam,
  zValidator('json', expandInput),
  async (c) => {
    const user = c.get('user');
    const { projectId, envId } = c.req.valid('param');
    const { relation, object } = c.req.valid('json');
    return Result.pipe(
      resolveEnvironmentStore({ projectId, envId, userId: user.id }),
      Result.andThen(({ openfgaStoreId: storeId }) =>
        Result.try({
          try: () => runtimeClient().expandTuple(storeId, { tuple_key: { relation, object } }),
          catch: (error) => new RuntimeError({ operation: 'expandTuple', error: error as Error }),
        }),
      ),
      Result.map((res) => c.json({ tree: res.tree?.root ?? null }, StatusCodes.OK)),
      Result.mapError((error) => errorResponse(c, error)),
      foldToResponse,
      Result.unwrap(),
    );
  },
);

dataPlaneRoute.get(
  '/:projectId/environments/:envId/tuples',
  environmentParam,
  zValidator(
    'query',
    z.object({
      object: z.string().optional(),
      user: z.string().optional(),
      relation: z.string().optional(),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
      continuationToken: z.string().optional(),
    }),
  ),
  async (c) => {
    const user = c.get('user');
    const { projectId, envId } = c.req.valid('param');
    const query = c.req.valid('query');
    return Result.pipe(
      resolveEnvironmentStore({ projectId, envId, userId: user.id }),
      Result.andThen(({ openfgaStoreId: storeId }) =>
        Result.try({
          try: () => runtimeClient().readTuples(storeId, buildReadBody(query)),
          catch: (error) => new RuntimeError({ operation: 'readTuples', error: error as Error }),
        }),
      ),
      Result.map((res) => c.json(toTupleListBody(res), StatusCodes.OK)),
      Result.mapError((error) => errorResponse(c, error)),
      foldToResponse,
      Result.unwrap(),
    );
  },
);

dataPlaneRoute.post(
  '/:projectId/environments/:envId/tuples',
  environmentParam,
  zValidator('json', tupleInput),
  async (c) => {
    const user = c.get('user');
    const { projectId, envId } = c.req.valid('param');
    const tuple = c.req.valid('json');
    return Result.pipe(
      resolveEnvironmentStore({ projectId, envId, userId: user.id }),
      Result.andThen(({ openfgaStoreId: storeId }) =>
        Result.try({
          try: () => runtimeClient().writeTuples(storeId, { writes: { tuple_keys: [tuple] } }),
          catch: (error) => new RuntimeError({ operation: 'writeTuples', error: error as Error }),
        }),
      ),
      Result.map(() => c.json({ ok: true }, StatusCodes.CREATED)),
      Result.mapError((error) => errorResponse(c, error)),
      foldToResponse,
      Result.unwrap(),
    );
  },
);

dataPlaneRoute.delete(
  '/:projectId/environments/:envId/tuples',
  environmentParam,
  zValidator('json', tupleInput),
  async (c) => {
    const user = c.get('user');
    const { projectId, envId } = c.req.valid('param');
    const tuple = c.req.valid('json');
    return Result.pipe(
      resolveEnvironmentStore({ projectId, envId, userId: user.id }),
      Result.andThen(({ openfgaStoreId: storeId }) =>
        Result.try({
          try: () => runtimeClient().writeTuples(storeId, { deletes: { tuple_keys: [tuple] } }),
          catch: (error) => new RuntimeError({ operation: 'writeTuples', error: error as Error }),
        }),
      ),
      Result.map(() => c.json({ ok: true }, StatusCodes.OK)),
      Result.mapError((error) => errorResponse(c, error)),
      foldToResponse,
      Result.unwrap(),
    );
  },
);
