import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const folder = (id: string) => ({ type: 'folder', id }) as const;

await authz.write({
  writes: [
    { subject: folder('product'), relation: 'parent', object: folder('q3') },
    { subject: folder('q3'), relation: 'parent', object: document('launch-plan') },
    { subject: user('alice'), relation: 'owner', object: document('launch-plan') },
  ],
});

const results = await authz.batchCheck([
  { subject: user('frank'), relation: 'can_view', object: folder('q3') },
  { subject: user('frank'), relation: 'can_view', object: document('launch-plan') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
