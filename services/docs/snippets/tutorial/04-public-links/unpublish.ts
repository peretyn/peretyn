import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const everyone = { type: 'user', id: '*' } as const;

await authz.write({
  deletes: [{ subject: everyone, relation: 'viewer', object: document('announcement') }],
});

const results = await authz.batchCheck([
  { subject: user('zoe'), relation: 'can_view', object: document('announcement') },
  { subject: user('alice'), relation: 'can_view', object: document('announcement') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
