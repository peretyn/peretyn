import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const organization = (id: string) => ({ type: 'organization', id }) as const;

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'member', object: organization('acme') },
    { subject: user('bob'), relation: 'member', object: organization('acme') },
    { subject: user('gus'), relation: 'editor', object: document('roadmap') },
  ],
});

const results = await authz.batchCheck([
  { subject: user('gus'), relation: 'can_edit', object: document('roadmap') },
  { subject: user('gus'), relation: 'can_share', object: document('roadmap') },
  { subject: user('bob'), relation: 'can_share', object: document('roadmap') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
