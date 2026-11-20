import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const roadmap = { type: 'document', id: 'roadmap' } as const;
const user = (id: string) => ({ type: 'user', id }) as const;
const team = (id: string) => ({ type: 'team', id }) as const;
const membersOf = (id: string) => ({ type: 'team', id, relation: 'member' }) as const;

await authz.write({
  writes: [
    { subject: user('dan'), relation: 'member', object: team('brand') },
    { subject: membersOf('brand'), relation: 'member', object: team('design') },
  ],
});

const results = await authz.batchCheck([
  { subject: user('dan'), relation: 'can_view', object: roadmap },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
