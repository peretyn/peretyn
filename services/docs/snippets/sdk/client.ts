import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema';

const authz = peretyn<typeof schema>({
  token: process.env.PERETYN_TOKEN!,
  baseUrl: process.env.PERETYN_RUNTIME_URL,
  timeoutMs: 2000,
});

const { environment } = await authz.me();

console.log(environment);
