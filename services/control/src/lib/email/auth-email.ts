import type { Result } from '@praha/byethrow';
import type { EmailDeliveryError } from '../errors/email-delivery.error.js';

export type AuthEmail = { to: string; subject: string; url: string };

export type RenderedEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailTransport = (email: RenderedEmail) => Result.ResultAsync<void, EmailDeliveryError>;

export const DELIVERY_TIMEOUT_MS = 10_000;
