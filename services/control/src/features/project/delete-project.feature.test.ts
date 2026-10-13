import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import { deleteProject } from './delete-project.feature.js';
import * as runtime from '../../lib/runtime-client.js';
import * as projectRepository from '../../repositories/project.repository.js';
import * as environmentRepository from '../../repositories/environment.repository.js';
import * as memberRepository from '../../repositories/member.repository.js';
import { NotFoundError } from '../../errors/not-found.error.js';
import { ForbiddenError } from '../../errors/forbidden.error.js';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { DatabaseError } from '../../db/database.error.js';

const organizationId = 'org_1';
const projectId = randomUUID();
const environments = ['production', 'development'].map((name) => ({
  id: randomUUID(),
  name,
  projectId,
  externalUuid: randomUUID(),
  openfgaStoreId: `store_${name}`,
  status: 'active',
  isProduction: name === 'production',
  createdAt: new Date(),
}));

let deleteKey: ReturnType<typeof vi.fn>;
let deleteStore: ReturnType<typeof vi.fn>;
let deleteRow: ReturnType<typeof vi.spyOn>;

function givenRole(role: string | null) {
  vi.spyOn(memberRepository, 'getMembership').mockResolvedValue(
    Result.succeed(role ? { organizationId, userId: 'u_1', role } : null),
  );
}

describe('deleteProject', () => {
  beforeEach(() => {
    vi.spyOn(projectRepository, 'getProjectById').mockResolvedValue(
      Result.succeed({
        id: projectId,
        name: 'p',
        slug: 'p',
        organizationId,
        createdAt: new Date(),
      }),
    );
    vi.spyOn(environmentRepository, 'getEnvironmentsByProjectId').mockResolvedValue(
      Result.succeed(environments),
    );
    deleteRow = vi.spyOn(projectRepository, 'deleteProject').mockResolvedValue(Result.succeed());
    deleteKey = vi.fn().mockResolvedValue(null);
    deleteStore = vi.fn().mockResolvedValue(null);
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      deleteKey,
      deleteStore,
    } as unknown as ReturnType<typeof runtime.runtimeClient>);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('hides the project from a non-member', async () => {
    givenRole(null);
    const result = await deleteProject({ projectId, userId: 'intruder' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(deleteKey).not.toHaveBeenCalled();
  });

  it('forbids a member who is not an owner', async () => {
    givenRole('member');
    const result = await deleteProject({ projectId, userId: 'u_1' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(deleteKey).not.toHaveBeenCalled();
  });

  it('revokes every key, deletes the rows, then the stores', async () => {
    givenRole('owner');
    const result = await deleteProject({ projectId, userId: 'u_1' });
    assert(Result.isSuccess(result));
    expect(deleteKey.mock.calls.flat()).toEqual(environments.map((e) => e.externalUuid));
    expect(deleteStore.mock.calls.flat()).toEqual(environments.map((e) => e.openfgaStoreId));
    expect(deleteRow).toHaveBeenCalledWith(projectId);
  });

  it('keeps the project when a key cannot be revoked', async () => {
    givenRole('owner');
    deleteKey.mockRejectedValueOnce(new TypeError('fetch failed'));
    const result = await deleteProject({ projectId, userId: 'u_1' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(RuntimeError);
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('keeps the stores when the rows cannot be deleted', async () => {
    givenRole('owner');
    deleteRow.mockResolvedValueOnce(
      Result.fail(new DatabaseError({ entity: 'project', operation: 'write' })),
    );
    const result = await deleteProject({ projectId, userId: 'u_1' });
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(DatabaseError);
    expect(deleteKey).toHaveBeenCalledTimes(2);
    expect(deleteStore).not.toHaveBeenCalled();
  });

  it('still deletes the project when a store cannot be deleted', async () => {
    givenRole('owner');
    deleteStore.mockRejectedValueOnce(new TypeError('fetch failed'));
    const result = await deleteProject({ projectId, userId: 'u_1' });
    assert(Result.isSuccess(result));
    expect(deleteKey).toHaveBeenCalledTimes(2);
    expect(deleteRow).toHaveBeenCalledWith(projectId);
  });
});
