import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });
const subject = (id: string) => ({ type: 'user', id }) as const;

await authz.write({
  writes: [
    { subject: subject('root'), relation: 'admin', object: { type: 'platform', id: 'main' } },
    { subject: subject('ada'), relation: 'admin', object: { type: 'organization', id: 'acme' } },
    { subject: subject('sam'), relation: 'member', object: { type: 'organization', id: 'acme' } },
    { subject: subject('grace'), relation: 'editor', object: { type: 'project', id: 'billing' } },
    { subject: subject('linus'), relation: 'viewer', object: { type: 'project', id: 'billing' } },
    {
      subject: { type: 'platform', id: 'main' },
      relation: 'platform',
      object: { type: 'project', id: 'billing' },
    },
    {
      subject: { type: 'organization', id: 'acme' },
      relation: 'organization',
      object: { type: 'project', id: 'billing' },
    },
    {
      subject: { type: 'platform', id: 'main' },
      relation: 'platform',
      object: { type: 'project', id: 'docs' },
    },
    {
      subject: { type: 'organization', id: 'acme' },
      relation: 'organization',
      object: { type: 'project', id: 'docs' },
    },
  ],
});

console.log('assigned 9 tuples');
