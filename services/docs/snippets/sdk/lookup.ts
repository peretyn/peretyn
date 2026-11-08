import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const { ids } = await authz.lookupResources({
  subject: { type: 'user', id: 'bob' },
  relation: 'can_view',
  resourceType: 'document',
});

const { subjects } = await authz.lookupSubjects({
  resource: { type: 'document', id: 'roadmap' },
  relation: 'can_edit',
  subjectType: 'user',
});

console.log(`bob can view: ${ids.join(', ')}`);
console.log(`can edit the roadmap: ${subjects.join(', ')}`);
