import { peretyn, PeretynError } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const FORBIDDEN = 403;

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

function isDenied(error: unknown): boolean {
  return error instanceof PeretynError && error.status === FORBIDDEN;
}

try {
  await authz.assert({
    subject: { type: 'user', id: 'bob' },
    relation: 'can_edit',
    object: { type: 'document', id: 'roadmap' },
  });
  console.log('allowed');
} catch (error) {
  if (!isDenied(error)) throw error;
  console.log('denied');
}
