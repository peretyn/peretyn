import { authz, document, everyone, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: document('announcement') },
    { subject: everyone, relation: 'viewer', object: document('announcement') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('anonymous'), relation: 'can_view', object: document('announcement') },
    { subject: user('anonymous'), relation: 'can_edit', object: document('announcement') },
    { subject: user('anonymous'), relation: 'can_view', object: document('roadmap') },
  ]),
);
