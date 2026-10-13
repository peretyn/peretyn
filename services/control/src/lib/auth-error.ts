import { Result } from '@praha/byethrow';
import { APIError } from 'better-auth/api';
import { DatabaseError } from '../db/database.error.js';
import { SoleOwnerError } from '../errors/sole-owner.error.js';
import { RuntimeError, runtimeFailureMessage } from './errors/runtime.error.js';
import { EmailDeliveryError } from './errors/email-delivery.error.js';
import { RuntimeResponseError } from './runtime-client.js';
import { logError } from './log.js';

type AuthHookError = DatabaseError | RuntimeError | SoleOwnerError | EmailDeliveryError;

const EMAIL_FAILURE_MESSAGE = 'Could not send the email. Try again later.';

function runtimeAuthError(error: RuntimeError): APIError {
  logError('runtime request failed', {
    operation: error.operation,
    status: error.error instanceof RuntimeResponseError ? error.error.status : null,
    error: error.error,
  });
  return new APIError('BAD_GATEWAY', { message: runtimeFailureMessage(error) });
}

function databaseAuthError(error: DatabaseError): APIError {
  logError('database error', {
    entity: error.entity,
    operation: error.operation,
    error: error.error,
  });
  return new APIError('INTERNAL_SERVER_ERROR', { message: 'internal error' });
}

function emailAuthError(error: EmailDeliveryError): APIError {
  logError('auth email delivery failed', { transport: error.transport, error: error.error });
  return new APIError('BAD_GATEWAY', { message: EMAIL_FAILURE_MESSAGE });
}

export function toAuthError(error: AuthHookError): APIError {
  if (error instanceof SoleOwnerError)
    return new APIError('BAD_REQUEST', { message: error.message });
  if (error instanceof RuntimeError) return runtimeAuthError(error);
  if (error instanceof EmailDeliveryError) return emailAuthError(error);
  return databaseAuthError(error);
}

export async function unwrapOrThrowAuthError<T>(
  result: Result.ResultAsync<T, AuthHookError>,
): Promise<T> {
  const settled = await result;
  if (Result.isFailure(settled)) throw toAuthError(settled.error);
  return settled.value;
}
