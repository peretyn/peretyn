import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const results = await authz.batchCheck([
  {
    subject: { type: 'user', id: 'alice' },
    relation: 'can_edit',
    object: { type: 'document', id: 'roadmap' },
  },
  {
    subject: { type: 'user', id: 'bob' },
    relation: 'can_edit',
    object: { type: 'document', id: 'roadmap' },
  },
]);

for (const { check, allowed } of results) {
  console.log(`${check.subject.id}: ${allowed ? 'allowed' : 'denied'}`);
}
