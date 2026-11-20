import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const organization = (id: string) => ({ type: 'organization', id }) as const;

await authz.write({
  writes: [{ subject: user('hana'), relation: 'admin', object: organization('globex') }],
});

const results = await authz.batchCheck([
  { subject: user('hana'), relation: 'can_view', object: document('roadmap') },
  { subject: user('ivan'), relation: 'can_view', object: document('roadmap') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
