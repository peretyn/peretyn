import { authz, user } from './helpers.ts';

const { ids } = await authz.lookupResources({
  subject: user('frank'),
  relation: 'can_view',
  resourceType: 'document',
});

console.log(`frank can view: ${ids.toSorted().join(', ')}`);
