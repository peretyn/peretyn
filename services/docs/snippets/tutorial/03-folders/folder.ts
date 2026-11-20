import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const user = (id: string) => ({ type: 'user', id }) as const;
const document = (id: string) => ({ type: 'document', id }) as const;
const folder = (id: string) => ({ type: 'folder', id }) as const;
const team = (id: string) => ({ type: 'team', id }) as const;
const membersOf = (id: string) => ({ type: 'team', id, relation: 'member' }) as const;

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: folder('product') },
    { subject: user('frank'), relation: 'member', object: team('engineering') },
    { subject: membersOf('engineering'), relation: 'viewer', object: folder('product') },
    { subject: folder('product'), relation: 'parent', object: document('roadmap') },
  ],
});

const results = await authz.batchCheck([
  { subject: user('frank'), relation: 'can_view', object: document('roadmap') },
  { subject: user('frank'), relation: 'can_edit', object: document('roadmap') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
