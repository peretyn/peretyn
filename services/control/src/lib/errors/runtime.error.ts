import { StatusCodes } from 'http-status-codes';
import { ErrorFactory } from '@praha/error-factory';
import { RuntimeClient, RuntimeResponseError } from '../runtime-client.js';

export class RuntimeError extends ErrorFactory({
  name: 'RuntimeError',
  fields: ErrorFactory.fields<{ operation: keyof RuntimeClient; error?: Error }>(),
  message: ({ operation }) => `Runtime error on ${operation}`,
}) {}

const CALLER_FACING = [
  StatusCodes.BAD_REQUEST,
  StatusCodes.NOT_FOUND,
  StatusCodes.CONFLICT,
  StatusCodes.UNPROCESSABLE_ENTITY,
] as const;

export function callerFacingStatus(error: RuntimeError): (typeof CALLER_FACING)[number] | null {
  const status = error.error instanceof RuntimeResponseError ? error.error.status : null;
  return CALLER_FACING.find((s) => s === status) ?? null;
}

const FAILURE_MESSAGES: Partial<Record<RuntimeError['operation'], string>> = {
  deleteKey:
    'Could not revoke every API key, so nothing else was deleted. Some keys may already be revoked; retry to finish.',
};
const GENERIC_FAILURE_MESSAGE = 'runtime request failed';

export function runtimeFailureMessage(error: RuntimeError): string {
  return FAILURE_MESSAGES[error.operation] ?? GENERIC_FAILURE_MESSAGE;
}
