import { ErrorFactory } from '@praha/error-factory';

export class NotFoundError extends ErrorFactory({
  name: 'NotFoundError',
  message: ({ entity }) => `${entity} not found`,
  fields: ErrorFactory.fields<{ entity?: string }>(),
}) {}
