import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

await authz.write({
  writes: [
    {
      subject: { type: 'user', id: 'alice' },
      relation: 'member',
      object: { type: 'team', id: 'design' },
    },
    {
      subject: { type: 'team', id: 'design', relation: 'member' },
      relation: 'viewer',
      object: { type: 'folder', id: 'specs' },
    },
    {
      subject: { type: 'folder', id: 'specs' },
      relation: 'parent',
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
