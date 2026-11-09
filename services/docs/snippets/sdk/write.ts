import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const { written } = await authz.write({
  writes: [
    {
      subject: { type: 'user', id: 'alice' },
      relation: 'owner',
      object: { type: 'document', id: 'roadmap' },
    },
    {
      subject: { type: 'user', id: 'bob' },
      relation: 'viewer',
      object: { type: 'document', id: 'roadmap' },
    },
  ],
});

console.log(`wrote ${written} tuples`);
