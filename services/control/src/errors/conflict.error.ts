import { ErrorFactory } from '@praha/error-factory';

export class ConflictError extends ErrorFactory({
  name: 'ConflictError',
  message: ({ reason }) => reason ?? 'conflict',
  fields: ErrorFactory.fields<{ reason?: string }>(),
}) {}
