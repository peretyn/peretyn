import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const { ids } = await authz.lookupResources({
  subject: { type: 'user', id: 'mary' },
  relation: 'can_view',
  resourceType: 'project',
});

console.log(`mary can view: ${ids.join(', ')}`);
