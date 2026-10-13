import { ErrorFactory } from '@praha/error-factory';

export class ForbiddenError extends ErrorFactory({
  name: 'ForbiddenError',
  message: ({ reason }) => reason ?? 'forbidden',
  fields: ErrorFactory.fields<{ reason?: string }>(),
}) {}
