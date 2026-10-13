import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import * as runtime from './lib/runtime-client.js';
import * as environmentRepository from './repositories/environment.repository.js';
import * as memberRepository from './repositories/member.repository.js';
import { DatabaseError } from './db/database.error.js';

vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
vi.stubEnv('DATABASE_URL', 'postgres://nobody@127.0.0.1:1/none');
const { auth } = await import('./auth.js');

type OrganizationHooks = {
  beforeDeleteOrganization?: (
    data: { organization: { id: string }; user: unknown },
    ctx?: unknown,
  ) => Promise<void>;
};
const organizationPlugin = auth.options.plugins.find((p) => p.id === 'organization') as unknown as {
  options: { organizationHooks?: OrganizationHooks };
};
const updateSession = vi.fn().mockResolvedValue(null);
const deleteContext = (activeOrganizationId: string | null) => ({
  context: {
    session: { session: { token: 'session_token', activeOrganizationId }, user: {} },
    internalAdapter: { updateSession },
  },
});
const beforeDeleteOrganization = async (organizationId: string, activeOrganizationId = 'org_1') =>
  organizationPlugin.options.organizationHooks!.beforeDeleteOrganization!(
    { organization: { id: organizationId }, user: {} },
    deleteContext(activeOrganizationId),
  );

describe('deleting an organization', () => {
  const environment = {
    id: randomUUID(),
    name: 'development',
    projectId: randomUUID(),
    externalUuid: randomUUID(),
    openfgaStoreId: 'store_1',
    status: 'active',
    isProduction: false,
    createdAt: new Date(),
  };
  let deleteKey: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(environmentRepository, 'getEnvironmentsByOrganizationId').mockResolvedValue(
      Result.succeed([environment]),
    );
    deleteKey = vi.fn().mockResolvedValue(null);
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      deleteKey,
      deleteStore: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof runtime.runtimeClient>);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    updateSession.mockReset().mockResolvedValue(null);
  });

  it('revokes the runtime keys of its projects first', async () => {
    await beforeDeleteOrganization('org_1');
    expect(environmentRepository.getEnvironmentsByOrganizationId).toHaveBeenCalledWith('org_1');
    expect(deleteKey).toHaveBeenCalledWith(environment.externalUuid);
  });

  it('is aborted when a key cannot be revoked, saying keys may be gone and to retry', async () => {
    deleteKey.mockRejectedValue(new TypeError('fetch failed'));
    const error = await beforeDeleteOrganization('org_1').catch((e: unknown) => e);
    expect(error).toMatchObject({ statusCode: 502 });
    expect((error as Error).message).toMatch(/may already be revoked/);
    expect((error as Error).message).toMatch(/retry/i);
  });

  it('is aborted with an internal error when its environments cannot be read', async () => {
    vi.mocked(environmentRepository.getEnvironmentsByOrganizationId).mockResolvedValue(
      Result.fail(new DatabaseError({ entity: 'environment', operation: 'read' })),
    );
    await expect(beforeDeleteOrganization('org_1')).rejects.toMatchObject({ statusCode: 500 });
    expect(deleteKey).not.toHaveBeenCalled();
  });

  it('gives the organization back as active when its delete is aborted', async () => {
    deleteKey.mockRejectedValue(new TypeError('fetch failed'));
    await beforeDeleteOrganization('org_1', 'org_1').catch(() => undefined);
    expect(updateSession).toHaveBeenCalledWith('session_token', { activeOrganizationId: 'org_1' });
  });

  it.each([
    ['another organization', 'org_2'],
    ['no organization', null],
  ])('leaves the session alone when %s was active', async (_, activeOrganizationId) => {
    deleteKey.mockRejectedValue(new TypeError('fetch failed'));
    await beforeDeleteOrganization('org_1', activeOrganizationId as string).catch(() => undefined);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('still reports the revoke failure when the active organization cannot be restored', async () => {
    deleteKey.mockRejectedValue(new TypeError('fetch failed'));
    updateSession.mockRejectedValueOnce(new Error('database down'));
    await expect(beforeDeleteOrganization('org_1', 'org_1')).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('does not touch the session when the keys are revoked', async () => {
    await beforeDeleteOrganization('org_1', 'org_1');
    expect(updateSession).not.toHaveBeenCalled();
  });
});

describe('deleting a user account', () => {
  const beforeDelete = auth.options.user?.deleteUser?.beforeDelete;

  afterEach(() => vi.restoreAllMocks());

  it('is refused while the user is the sole owner of an organization', async () => {
    vi.spyOn(memberRepository, 'getMembersOfUserOrganizations').mockResolvedValue(
      Result.succeed([
        { organizationId: 'a', organizationName: 'Acme', userId: 'u_1', role: 'owner' },
      ]),
    );
    await expect(beforeDelete?.({ id: 'u_1' } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('goes ahead for a user who owns nothing alone', async () => {
    vi.spyOn(memberRepository, 'getMembersOfUserOrganizations').mockResolvedValue(
      Result.succeed([]),
    );
    await expect(beforeDelete?.({ id: 'u_1' } as never)).resolves.toBeUndefined();
  });
});

describe('the admin user removal guard', () => {
  it('is registered as a before hook', () => {
    expect(auth.options.hooks?.before).toBeTypeOf('function');
  });
});
