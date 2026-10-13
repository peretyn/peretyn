import { peretyn, type PeretynClient } from '@peretyn/sdk';

const E2E_TIMEOUT_MS = 10_000;

export function connectClient(options: { token: string; baseUrl: string }): PeretynClient {
  return peretyn({ ...options, retries: 0, timeoutMs: E2E_TIMEOUT_MS });
}
