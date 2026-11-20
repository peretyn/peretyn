import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const organization = (id: string) => ({ type: 'organization', id }) as const;

await authz.write({
  writes: [
    { subject: user('ivan'), relation: 'admin', object: organization('acme') },
    { subject: organization('acme'), relation: 'organization', object: document('roadmap') },
    { subject: organization('acme'), relation: 'organization', object: document('launch-plan') },
    { subject: organization('acme'), relation: 'organization', object: document('announcement') },
  ],
});

const results = await authz.batchCheck([
  { subject: user('ivan'), relation: 'can_view', object: document('roadmap') },
  { subject: user('ivan'), relation: 'can_view', object: document('launch-plan') },
  { subject: user('ivan'), relation: 'can_edit', object: document('roadmap') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
