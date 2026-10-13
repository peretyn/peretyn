import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewProject } from './create-new-project.feature.js';
import { randomUUID } from 'node:crypto';
import * as projectRepository from '../../repositories/project.repository.js';
import * as environmentRepository from '../../repositories/environment.repository.js';
import * as apiTokenRepository from '../../repositories/api-token.repository.js';
import * as db from '../../db/index.js';
import * as runtime from '../../lib/runtime-client.js';
import { Result } from '@praha/byethrow';
import { RuntimeError } from '../../lib/errors/runtime.error.js';
import { Environment } from '../../domain/environment.entity.js';

const makeFakeStore = (name: string) => ({ id: randomUUID(), name, createdAt: new Date() });
const makeFakeKey = () => ({ plaintext: 'prn_test_faketoken', prefix: 'prn_test_', last4: 'oken' });
const makeFakeApiToken = (environmentId: string) => ({
  id: randomUUID(),
  environmentId,
  prefix: 'prn_test_',
  keyLast4: 'oken',
  createdAt: new Date(),
  rotatedAt: null,
});

describe('create new project', () => {
  let updateEnvironmentSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(db, 'transactional').mockImplementation((callback) =>
      callback({ rollback: vi.fn() } as never),
    );

    vi.spyOn(runtime, 'runtimeClient').mockImplementation(
      () =>
        ({
          createStore: (name: string) => Promise.resolve(makeFakeStore(name)),
          createKey: () => Promise.resolve(makeFakeKey()),
          deleteStore: () => Promise.resolve(null),
          deleteKey: () => Promise.resolve(null),
        }) as never,
    );

    vi.spyOn(projectRepository, 'createProject').mockImplementation((input) =>
      Promise.resolve(
        Result.succeed({
          id: randomUUID(),
          name: input.name,
          slug: input.slug,
          organizationId: input.organizationId,
          createdAt: new Date(),
        }),
      ),
    );

    const createdEnvironments = new Map<string, Environment>();
    vi.spyOn(environmentRepository, 'createEnvironment').mockImplementation(async (input) => {
      const environment = {
        id: randomUUID(),
        name: input.name,
        projectId: input.projectId,
        externalUuid: randomUUID(),
        status: 'pending',
        createdAt: new Date(),
        isProduction: input.name === 'production',
      };
      createdEnvironments.set(environment.id, environment);
      return Result.succeed(environment);
    });

    vi.spyOn(apiTokenRepository, 'insertApiToken').mockImplementation((input) =>
      Promise.resolve(Result.succeed(makeFakeApiToken(input.environmentId))),
    );

    updateEnvironmentSpy = vi
      .spyOn(environmentRepository, 'updateEnvironment')
      .mockImplementation(async (input) =>
        Result.succeed({
          ...createdEnvironments.get(input.id)!,
          status: input.status,
          openfgaStoreId: input.openfgaStoreId,
        }),
      );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when createStore fails', () => {
    it('should return runtime error', async () => {
      const organizationId = randomUUID();
      vi.spyOn(runtime, 'runtimeClient').mockImplementation(
        () =>
          ({
            createStore: () => Promise.reject(new Error('store unavailable')),
            deleteStore: () => Promise.resolve(null),
            deleteKey: () => Promise.resolve(null),
          }) as never,
      );
      const results = await createNewProject({
        organizationId,
        slug: 'test-project',
        name: 'The test',
      });
      assert(Result.isFailure(results));
      expect(results.error).toBeInstanceOf(RuntimeError);
    });
  });

  describe('when createKey fails', () => {
    it('should return runtime error and clean up the store and key', async () => {
      const organizationId = randomUUID();
      const deleteStoreSpy = vi.fn().mockResolvedValue(null);
      const deleteKeySpy = vi.fn().mockResolvedValue(null);
      vi.spyOn(runtime, 'runtimeClient').mockImplementation(
        () =>
          ({
            createStore: (name: string) => Promise.resolve(makeFakeStore(name)),
            createKey: () => Promise.reject(new Error('key service unavailable')),
            deleteStore: deleteStoreSpy,
            deleteKey: deleteKeySpy,
          }) as never,
      );
      const results = await createNewProject({
        organizationId,
        slug: 'test-project',
        name: 'The test',
      });
      assert(Result.isFailure(results));
      expect(results.error).toBeInstanceOf(RuntimeError);
      expect(deleteStoreSpy).toHaveBeenCalled();
      expect(deleteKeySpy).toHaveBeenCalled();
    });
  });

  describe('when the transaction fails after the runtime calls', () => {
    it('still cleans up the runtime and rethrows', async () => {
      const organizationId = randomUUID();
      const deleteStoreSpy = vi.fn().mockResolvedValue(null);
      const deleteKeySpy = vi.fn().mockResolvedValue(null);
      vi.spyOn(runtime, 'runtimeClient').mockImplementation(
        () =>
          ({
            createStore: (name: string) => Promise.resolve(makeFakeStore(name)),
            createKey: () => Promise.resolve(makeFakeKey()),
            deleteStore: deleteStoreSpy,
            deleteKey: deleteKeySpy,
          }) as never,
      );
      vi.spyOn(db, 'transactional').mockImplementation(async (callback) => {
        await callback({} as never);
        throw new Error('COMMIT failed');
      });
      await expect(
        createNewProject({ organizationId, slug: 'test-project', name: 'The test' }),
      ).rejects.toThrow('COMMIT failed');
      expect(deleteKeySpy).toHaveBeenCalledTimes(2);
      expect(deleteStoreSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the rollback cannot revoke a key', () => {
    it('still tries to delete every store it created and keeps the original error', async () => {
      const organizationId = randomUUID();
      const deleteStoreSpy = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'));
      deleteStoreSpy.mockResolvedValue(null);
      const deleteKeySpy = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(runtime, 'runtimeClient').mockImplementation(
        () =>
          ({
            createStore: (name: string) => Promise.resolve(makeFakeStore(name)),
            createKey: () => Promise.resolve(makeFakeKey()),
            deleteStore: deleteStoreSpy,
            deleteKey: deleteKeySpy,
          }) as never,
      );
      vi.spyOn(db, 'transactional').mockImplementation(async (callback) => {
        await callback({} as never);
        throw new Error('COMMIT failed');
      });
      await expect(
        createNewProject({ organizationId, slug: 'test-project', name: 'The test' }),
      ).rejects.toThrow('COMMIT failed');
      expect(deleteKeySpy).toHaveBeenCalledTimes(2);
      expect(deleteStoreSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('when all dependencies succeed', () => {
    it('should return project with bootstrapped environments and plaintext keys', async () => {
      const organizationId = randomUUID();

      const results = await createNewProject({
        organizationId,
        slug: 'test-project',
        name: 'The test',
      });

      assert(Result.isSuccess(results));
      expect(results.value).toMatchObject({
        project: expect.objectContaining({
          organizationId,
          name: 'The test',
          slug: 'test-project',
        }),
        production: expect.objectContaining({
          env: expect.objectContaining({
            name: 'production',
            status: 'active',
            openfgaStoreId: expect.any(String),
          }),
          plaintext: expect.any(String),
        }),
        development: expect.objectContaining({
          env: expect.objectContaining({
            name: 'development',
            status: 'active',
            openfgaStoreId: expect.any(String),
          }),
          plaintext: expect.any(String),
        }),
      });

      expect(updateEnvironmentSpy).toHaveBeenCalledTimes(2);
    });
  });
});
