import { Result } from '@praha/byethrow';
import { ConflictError } from '../errors/conflict.error.js';

export type Environment = {
  id: string;
  name: string;
  createdAt: Date;
  projectId: string;
  openfgaStoreId?: string;
  externalUuid: string;
  status: string;
  isProduction: boolean;
};

export type ActiveEnvironment = Environment & { openfgaStoreId: string };

export function requireActive(
  environment: Environment,
): Result.Result<ActiveEnvironment, ConflictError> {
  const { openfgaStoreId } = environment;
  return openfgaStoreId
    ? Result.succeed({ ...environment, openfgaStoreId })
    : Result.fail(new ConflictError({ reason: 'environment is not active yet' }));
}
