import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const roadmap = { type: 'document', id: 'roadmap' } as const;
const user = (id: string) => ({ type: 'user', id }) as const;

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: roadmap },
    { subject: user('bob'), relation: 'viewer', object: roadmap },
  ],
});

const results = await authz.batchCheck([
  { subject: user('alice'), relation: 'can_view', object: roadmap },
  { subject: user('bob'), relation: 'can_view', object: roadmap },
  { subject: user('carol'), relation: 'can_view', object: roadmap },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
