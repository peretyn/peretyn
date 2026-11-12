import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const project = (id: string) => ({ type: 'project', id }) as const;
const user = (id: string) => ({ type: 'user', id }) as const;

const results = await authz.batchCheck([
  { subject: user('ada'), relation: 'can_manage', object: project('billing') },
  { subject: user('root'), relation: 'can_manage', object: project('docs') },
  { subject: user('grace'), relation: 'can_view', object: project('billing') },
  { subject: user('linus'), relation: 'can_edit', object: project('billing') },
  { subject: user('sam'), relation: 'can_view', object: project('docs') },
  { subject: user('sam'), relation: 'can_edit', object: project('docs') },
]);

for (const { check, allowed } of results) {
  const verdict = allowed ? 'allowed' : 'denied';
  console.log(
    `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
  );
}
