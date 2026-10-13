import { Result } from '@praha/byethrow';
import { log, logError } from './log.js';
import type { AuthEmail } from './email/auth-email.js';
import type { EmailDeliveryError } from './errors/email-delivery.error.js';
import { renderAuthEmail } from './email/render.js';
import { selectTransport } from './email/select-transport.js';

const from = process.env.PERETYN_EMAIL_FROM ?? 'no-reply@peretyn.dev';

const production = process.env.NODE_ENV === 'production';

const transport = selectTransport({
  resendApiKey: process.env.PERETYN_RESEND_API_KEY,
  mailpitUrl: process.env.PERETYN_MAILPIT_URL,
});

if (!transport && production) {
  logError('no_email_transport', {
    detail:
      'PERETYN_RESEND_API_KEY is unset: password reset, email verification and ' +
      'organization invitations will not be delivered.',
  });
}

function skipDelivery({ to, subject, url }: AuthEmail): void {
  if (production) {
    logError('auth_email_dropped', { to, subject });
    return;
  }
  log('auth_email_dev', { to, subject, url });
}

export async function sendAuthEmail(
  email: AuthEmail,
): Result.ResultAsync<void, EmailDeliveryError> {
  if (!transport) {
    skipDelivery(email);
    return Result.succeed();
  }
  return Result.pipe(
    transport(renderAuthEmail(email, from)),
    Result.inspect(() => log('auth_email_sent', { to: email.to, subject: email.subject })),
  );
}
