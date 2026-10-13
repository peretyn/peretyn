import { ErrorFactory } from '@praha/error-factory';

export type EmailTransportName = 'resend' | 'mailpit';

export class EmailDeliveryError extends ErrorFactory({
  name: 'EmailDeliveryError',
  message: ({ transport }) => `Unable to deliver auth email through ${transport}`,
  fields: ErrorFactory.fields<{ transport: EmailTransportName; error?: Error }>(),
}) {}
