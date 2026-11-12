import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

await authz.write({
  writes: [
    {
      subject: { type: 'user', id: 'mary' },
      relation: 'viewer',
      object: { type: 'project', id: 'billing' },
    },
  ],
});

for (const id of ['billing', 'docs']) {
  const { allowed } = await authz.check({
    subject: { type: 'user', id: 'mary' },
    relation: 'can_view',
    object: { type: 'project', id },
  });
  console.log(`mary can_view project:${id}: ${allowed ? 'allowed' : 'denied'}`);
}
