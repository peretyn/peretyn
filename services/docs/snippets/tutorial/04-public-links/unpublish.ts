import { authz, document, everyone, printVerdicts, user } from './helpers.ts';

await authz.write({
  deletes: [{ subject: everyone, relation: 'viewer', object: document('announcement') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('anonymous'), relation: 'can_view', object: document('announcement') },
    { subject: user('alice'), relation: 'can_view', object: document('announcement') },
  ]),
);
