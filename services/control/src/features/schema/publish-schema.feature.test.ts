import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Result } from '@praha/byethrow';
import { publishSchema } from './publish-schema.feature.js';
import * as runtime from '../../lib/runtime-client.js';
import * as schemaVersionRepository from '../../repositories/schema-version.repository.js';
import * as db from '../../db/index.js';
import { ConflictError } from '../../errors/conflict.error.js';

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
const model = { schema_version: '1.1', type_definitions: [{ type: 'user' }] };
const input = {
  environment,
  label: 'v1',
  model,
  dsl: 'model\n  schema 1.1\ntype user',
  publishedBy: 'peretyn-cli',
};

const published = (label: string) => ({
  id: randomUUID(),
  environmentId: environment.id,
  label,
  dslSource: input.dsl,
  modelJson: model,
  openfgaAuthorizationModelId: 'model_1',
  publishedAt: new Date(),
  publishedBy: 'peretyn-cli',
});

describe('publishSchema', () => {
  let writeAuthorizationModel: ReturnType<typeof vi.fn>;
  const tx = { name: 'publish-tx' } as unknown as db.Transaction;

  beforeEach(() => {
    vi.spyOn(db, 'transactional').mockImplementation((callback) => callback(tx));
    vi.spyOn(schemaVersionRepository, 'lockEnvironmentPublishes').mockResolvedValue(
      Result.succeed(),
    );
    writeAuthorizationModel = vi.fn().mockResolvedValue({ authorizationModelId: 'model_1' });
    vi.spyOn(runtime, 'runtimeClient').mockReturnValue({
      writeAuthorizationModel,
    } as unknown as ReturnType<typeof runtime.runtimeClient>);
    vi.spyOn(schemaVersionRepository, 'insertSchemaVersion').mockImplementation(async (row) =>
      Result.succeed(published(row.label)),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('rejects a label that is already published without touching the live model', async () => {
    vi.spyOn(schemaVersionRepository, 'getSchemaVersionByLabel').mockResolvedValue(
      Result.succeed(published('v1')),
    );
    const result = await publishSchema(input);
    assert(Result.isFailure(result));
    expect(result.error).toBeInstanceOf(ConflictError);
    expect(writeAuthorizationModel).not.toHaveBeenCalled();
  });

  it('writes the model and records the version under a new label', async () => {
    vi.spyOn(schemaVersionRepository, 'getSchemaVersionByLabel').mockResolvedValue(
      Result.succeed(null),
    );
    const result = await publishSchema(input);
    assert(Result.isSuccess(result));
    expect(writeAuthorizationModel).toHaveBeenCalledWith('store_1', model);
    expect(result.value.label).toBe('v1');
  });

  it('locks the environment before checking the label, all in one transaction', async () => {
    const calls: string[] = [];
    vi.mocked(schemaVersionRepository.lockEnvironmentPublishes).mockImplementation(
      async (environmentId, transaction) => {
        calls.push(`lock ${environmentId} ${transaction === tx}`);
        return Result.succeed();
      },
    );
    vi.spyOn(schemaVersionRepository, 'getSchemaVersionByLabel').mockImplementation(
      async (_environmentId, _label, transaction) => {
        calls.push(`check label ${transaction === tx}`);
        return Result.succeed(null);
      },
    );
    writeAuthorizationModel.mockImplementation(async () => {
      calls.push('write model');
      return { authorizationModelId: 'model_1' };
    });
    vi.mocked(schemaVersionRepository.insertSchemaVersion).mockImplementation(
      async (row, transaction) => {
        calls.push(`record version ${transaction === tx}`);
        return Result.succeed(published(row.label));
      },
    );

    await publishSchema(input);

    expect(calls).toEqual([
      `lock ${environment.id} true`,
      'check label true',
      'write model',
      'record version true',
    ]);
  });
});
