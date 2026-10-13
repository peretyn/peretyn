import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { Result } from '@praha/byethrow';
import { errorResponse, foldToResponse } from '../lib/respond.js';
import { createNewProject } from '../features/project/create-new-project.feature.js';
import { deleteProject } from '../features/project/delete-project.feature.js';
import { requireMembership, assertOrgOwner, assertProjectMembership } from '../services/authz.js';
import { getProjectsByOrganizationId } from '../repositories/project.repository.js';
import { getEnvironmentsByProjectId } from '../repositories/environment.repository.js';
import { projectParam } from './params.js';
import type { AuthVariables } from '../middleware/protect-route.js';

export const projectsRoute = new Hono<{ Variables: AuthVariables }>();

const MAX_PROJECT_NAME_LENGTH = 120;

const createProjectInput = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
});

type CreatedProject = Result.InferSuccess<ReturnType<typeof createNewProject>>;

const toCreatedProjectBody = ({ project, production, development }: CreatedProject) => ({
  project,
  environments: [
    { ...production.env, plaintext: production.plaintext },
    { ...development.env, plaintext: development.plaintext },
  ],
});

projectsRoute.get('/', async (c) => {
  const user = c.get('user');
  const organizationId = c.get('session').activeOrganizationId;
  if (!organizationId)
    return c.json({ message: 'no active organization' }, StatusCodes.BAD_REQUEST);
  return Result.pipe(
    requireMembership(organizationId, user.id),
    Result.andThen(() => getProjectsByOrganizationId(organizationId)),
    Result.map((projects) => c.json(projects, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

projectsRoute.post('/', zValidator('json', createProjectInput), async (c) => {
  const user = c.get('user');
  const organizationId = c.get('session').activeOrganizationId;
  if (!organizationId)
    return c.json({ message: 'no active organization' }, StatusCodes.BAD_REQUEST);
  const input = c.req.valid('json');
  return Result.pipe(
    assertOrgOwner(organizationId, user.id),
    Result.andThen(() => createNewProject({ organizationId, ...input })),
    Result.map((created) => c.json(toCreatedProjectBody(created), StatusCodes.CREATED)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

projectsRoute.get('/:projectId', projectParam, async (c) => {
  const user = c.get('user');
  const { projectId } = c.req.valid('param');
  return Result.pipe(
    assertProjectMembership(projectId, user.id),
    Result.map((project) => c.json({ project }, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

projectsRoute.get('/:projectId/environments', projectParam, async (c) => {
  const user = c.get('user');
  const { projectId } = c.req.valid('param');
  return Result.pipe(
    assertProjectMembership(projectId, user.id),
    Result.andThen(() => getEnvironmentsByProjectId(projectId)),
    Result.map((environments) => c.json({ environments }, StatusCodes.OK)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});

projectsRoute.delete('/:projectId', projectParam, async (c) => {
  const user = c.get('user');
  const { projectId } = c.req.valid('param');
  return Result.pipe(
    deleteProject({ projectId, userId: user.id }),
    Result.map(() => c.body(null, StatusCodes.NO_CONTENT)),
    Result.mapError((error) => errorResponse(c, error)),
    foldToResponse,
    Result.unwrap(),
  );
});
