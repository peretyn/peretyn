import { Result } from '@praha/byethrow';
import { Resend, type CreateEmailResponse } from 'resend';
import { DELIVERY_TIMEOUT_MS, type EmailTransport } from './auth-email.js';
import { EmailDeliveryError } from '../errors/email-delivery.error.js';

const toDeliveryError = (error: unknown) =>
  new EmailDeliveryError({ transport: 'resend', error: error as Error });

function checkAccepted({ error }: CreateEmailResponse): Result.Result<void, EmailDeliveryError> {
  return error
    ? Result.fail(toDeliveryError(new Error(`${error.name}: ${error.message}`)))
    : Result.succeed();
}

export function createResendTransport(apiKey: string): EmailTransport {
  const resend = new Resend(apiKey);
  return ({ from, to, subject, text, html }) =>
    Result.pipe(
      Result.try({
        try: () =>
          resend.emails.send(
            { from, to, subject, text, html },
            { signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS) },
          ),
        catch: toDeliveryError,
      }),
      Result.andThen(checkAccepted),
    );
}
