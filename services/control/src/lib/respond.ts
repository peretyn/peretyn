import { StatusCodes } from 'http-status-codes';
import type { Context } from 'hono';
import { Result } from '@praha/byethrow';
import { DatabaseError } from '../db/database.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { RuntimeError, callerFacingStatus, runtimeFailureMessage } from './errors/runtime.error.js';
import { RuntimeResponseError } from './runtime-client.js';
import { logError } from './log.js';

export const foldToResponse = Result.orElse((response: Response) => Result.succeed(response));

type AppError = DatabaseError | NotFoundError | ForbiddenError | ConflictError | RuntimeError;

function runtimeErrorResponse(c: Context, error: RuntimeError): Response {
  const status = callerFacingStatus(error);
  if (status) return c.json({ message: error.error!.message }, status);
  logError('runtime request failed', {
    operation: error.operation,
    status: error.error instanceof RuntimeResponseError ? error.error.status : null,
    error: error.error,
  });
  return c.json({ message: runtimeFailureMessage(error) }, StatusCodes.BAD_GATEWAY);
}

function databaseErrorResponse(c: Context, error: DatabaseError): Response {
  logError('database error', {
    entity: error.entity,
    operation: error.operation,
    error: error.error,
  });
  return c.json({ message: 'internal error' }, StatusCodes.INTERNAL_SERVER_ERROR);
}

export function errorResponse(c: Context, error: AppError): Response {
  if (error instanceof NotFoundError) {
    return c.json({ message: error.message }, StatusCodes.NOT_FOUND);
  }
  if (error instanceof ForbiddenError) {
    return c.json({ message: error.message }, StatusCodes.FORBIDDEN);
  }
  if (error instanceof ConflictError) {
    return c.json({ message: error.message }, StatusCodes.CONFLICT);
  }
  if (error instanceof RuntimeError) return runtimeErrorResponse(c, error);
  return databaseErrorResponse(c, error);
}
