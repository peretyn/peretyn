import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import { assertEnvironmentAccess, assertOrgOwner, assertProjectMembership } from './authz.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as memberRepository from '../repositories/member.repository.js';
import * as environmentRepository from '../repositories/environment.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';

const fakeProject = (organizationId: string) => ({
  id: randomUUID(),
  name: 'docs',
  slug: 'docs',
  organizationId,
  createdAt: new Date(),
});

describe('assertProjectMembership', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns the project when the caller is a member of its organization', async () => {
    const organizationId = randomUUID();
    const project = fakeProject(organizationId);
    vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(Result.succeed(project));
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
      Result.succeed({ organizationId, userId: 'u_1', role: 'owner' }),
    );

    const result = await assertProjectMembership(project.id, 'u_1');

    assert(Result.isSuccess(result));
    expect(result.value).toEqual(project);
  });

  it('hides the project as NotFound when the caller is not a member', async () => {
    const organizationId = randomUUID();
    const project = fakeProject(organizationId);
    vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(Result.succeed(project));
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(Result.succeed(null));

    const result = await assertProjectMembership(project.id, 'intruder');

    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('assertEnvironmentAccess', () => {
  const organizationId = randomUUID();
  const projectId = randomUUID();

  function mockProject() {
    vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(
      Result.succeed({
        id: projectId,
        name: 'docs',
        slug: 'docs',
        organizationId,
        createdAt: new Date(),
      }),
    );
  }

  function mockEnvironment(isProduction: boolean) {
    vi.spyOn(environmentRepository, 'getEnvironmentByIdAndProjectId').mockResolvedValue(
      Result.succeed({
        id: randomUUID(),
        name: isProduction ? 'production' : 'development',
        projectId,
        externalUuid: randomUUID(),
        openfgaStoreId: randomUUID(),
        status: 'active',
        isProduction,
        createdAt: new Date(),
      }),
    );
  }

  function mockRole(role: string | null) {
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
      Result.succeed(role ? { organizationId, userId: 'u_1', role } : null),
    );
  }

  afterEach(() => vi.clearAllMocks());

  it('allows an owner into production', async () => {
    mockProject();
    mockRole('owner');
    mockEnvironment(true);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'u_1' });
    assert(Result.isSuccess(result));
    expect(result.value.role).toBe('owner');
  });

  it('allows a member holding owner among several roles into production', async () => {
    mockProject();
    mockRole('owner,admin');
    mockEnvironment(true);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'u_1' });
    assert(Result.isSuccess(result));
  });

  it('forbids an admin from production', async () => {
    mockProject();
    mockRole('admin');
    mockEnvironment(true);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'u_1' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('forbids a member from production', async () => {
    mockProject();
    mockRole('member');
    mockEnvironment(true);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'u_1' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('allows a member into development', async () => {
    mockProject();
    mockRole('member');
    mockEnvironment(false);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'u_1' });
    assert(Result.isSuccess(result));
  });

  it('hides the project from a non-member', async () => {
    mockProject();
    mockRole(null);
    mockEnvironment(false);
    const result = await assertEnvironmentAccess({ projectId, envId: 'e', userId: 'intruder' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('assertOrgOwner', () => {
  const organizationId = randomUUID();

  afterEach(() => vi.clearAllMocks());

  function mockRole(role: string) {
    vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
      Result.succeed({ organizationId, userId: 'u_1', role }),
    );
  }

  it.each(['owner', 'owner,admin'])('lets a %j member manage projects', async (role) => {
    mockRole(role);
    const result = await assertOrgOwner(organizationId, 'u_1');
    assert(Result.isSuccess(result));
  });

  it('forbids an admin from managing projects', async () => {
    mockRole('admin');
    const result = await assertOrgOwner(organizationId, 'u_1');
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ForbiddenError);
  });
});
