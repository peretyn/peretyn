import { Result } from '@praha/byethrow';
import { DELIVERY_TIMEOUT_MS, type EmailTransport, type RenderedEmail } from './auth-email.js';
import { EmailDeliveryError } from '../errors/email-delivery.error.js';

const toDeliveryError = (error: unknown) =>
  new EmailDeliveryError({ transport: 'mailpit', error: error as Error });

function toMailpitMessage({ from, to, subject, text, html }: RenderedEmail) {
  return { From: { Email: from }, To: [{ Email: to }], Subject: subject, Text: text, HTML: html };
}

function checkAccepted(res: Response): Result.Result<void, EmailDeliveryError> {
  return res.ok
    ? Result.succeed()
    : Result.fail(toDeliveryError(new Error(`Mailpit answered ${res.status}`)));
}

export function createMailpitTransport(baseUrl: string): EmailTransport {
  const endpoint = new URL('/api/v1/send', baseUrl);
  return (email) =>
    Result.pipe(
      Result.try({
        try: () =>
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toMailpitMessage(email)),
            signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
          }),
        catch: toDeliveryError,
      }),
      Result.andThen(checkAccepted),
    );
}
