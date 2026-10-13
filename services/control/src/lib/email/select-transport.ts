import type { EmailTransport } from './auth-email.js';
import { createMailpitTransport } from './mailpit-transport.js';
import { createResendTransport } from './resend-transport.js';

type TransportConfig = { resendApiKey?: string; mailpitUrl?: string };

export function selectTransport({
  resendApiKey,
  mailpitUrl,
}: TransportConfig): EmailTransport | undefined {
  if (resendApiKey && mailpitUrl) {
    throw new Error('set only one of PERETYN_RESEND_API_KEY and PERETYN_MAILPIT_URL');
  }
  if (resendApiKey) return createResendTransport(resendApiKey);
  if (mailpitUrl) return createMailpitTransport(mailpitUrl);
  return undefined;
}
