import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

await authz.write({
  writes: [
    {
      subject: { type: 'user', id: 'alice' },
      relation: 'owner',
      object: { type: 'document', id: 'roadmap' },
    },
  ],
});

const { allowed } = await authz.check({
  subject: { type: 'user', id: 'alice' },
  relation: 'can_view',
  object: { type: 'document', id: 'roadmap' },
});

console.log(allowed ? 'allowed' : 'denied');
